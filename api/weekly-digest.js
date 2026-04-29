// api/weekly-digest.js — Vercel cron, Mondays 9am UTC. Sends each active customer a
// "what your AI department did last week" digest. Aggregates agent_runs from the past
// 7 days, computes hours_saved + per-agent counts, sends via Resend.
//
// Cron schedule is defined in vercel.json: "0 9 * * 1"

import { wrapEmail, emailHero, emailBody, emailInfoCard, emailSignoff } from './_lib/email-design.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { isCronAuthorized } from './_lib/cron-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';
const FROM_EMAIL   = 'reports@30dayramp.com';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function fetchJson(url) {
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  return r.ok ? await r.json() : [];
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to: [to], reply_to: 'jon@30dayramp.com', subject, html }),
    });
    return r.ok;
  } catch (e) { console.warn('digest send failed:', e.message); return false; }
}

export default async function handler(req, res) {
  // Audit H2-2 (2026-04-29): the previous User-Agent fast-path was trivially
  // bypassable — UA is client-controlled. Both Vercel Cron and manual GETs
  // must now present Authorization: Bearer ${CRON_SECRET}. Vercel Cron
  // auto-attaches this header when CRON_SECRET is set on the project.
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'DB not configured' });

  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  // Customers who are post-go-live (subscription_active OR onboarding_paid w/ kickoff older than 30 days)
  const customers = await fetchJson(
    `${SUPABASE_URL}/rest/v1/bookings?or=(payment_status.eq.subscription_active,payment_status.eq.onboarding_paid)&select=id,name,email,company,datetime`
  );

  let sent = 0;
  for (const c of customers) {
    if (!c.email) continue;
    // Aggregate runs in the past 7 days
    const runs = await fetchJson(
      `${SUPABASE_URL}/rest/v1/agent_runs?booking_id=eq.${c.id}&created_at=gte.${encodeURIComponent(since)}&select=id,agent_id,action,outcome,hours_saved&limit=2000`
    );
    if (!runs.length) continue;

    const totalHours = runs.reduce((sum, r) => sum + (Number(r.hours_saved) || 0), 0);
    const byOutcome = runs.reduce((m, r) => { m[r.outcome || 'unknown'] = (m[r.outcome || 'unknown'] || 0) + 1; return m; }, {});

    // Agent name lookup
    const agents = await fetchJson(
      `${SUPABASE_URL}/rest/v1/agents?booking_id=eq.${c.id}&select=id,name`
    );
    const agentName = id => agents.find(a => a.id === id)?.name || 'Agent';
    const byAgent = runs.reduce((m, r) => {
      const k = agentName(r.agent_id);
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {});
    const agentRows = Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([n, c]) => `<tr><td style="padding:8px 12px;font-size:13.5px;color:#0B1220;border-bottom:1px solid #E6E4DC;">${esc(n)}</td><td style="padding:8px 12px;font-size:13.5px;color:#5B6272;text-align:right;border-bottom:1px solid #E6E4DC;font-family:'JetBrains Mono',monospace;">${c}</td></tr>`)
      .join('');

    let portalUrl = null;
    if (isMapTokenConfigured()) {
      try {
        const { exp, t } = signMapToken(c.id, 60 * 60 * 24 * 90);
        portalUrl = `${SITE_URL}/portal?id=${c.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch { /* ignore */ }
    }

    const firstName = (c.name || '').split(/\s+/)[0] || 'there';
    const innerRows =
      emailHero({
        eyebrow: 'Weekly digest',
        headline: `${esc(firstName)}, your AI department did the work.`,
        sub: `<strong>${runs.length}</strong> actions · <strong>${totalHours.toFixed(1)} hours</strong> saved · last 7 days`,
      }) +
      emailBody(`<p style="margin:0 0 14px;font-size:14.5px;color:#0B1220;">Here's what your stack handled this week.</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid #E6E4DC;border-radius:10px;overflow:hidden;">
          <tr><td colspan="2" style="padding:10px 12px;background:#F5F5F3;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#5B6272;">Top agents this week</td></tr>
          ${agentRows || '<tr><td colspan="2" style="padding:10px 12px;font-size:13px;color:#5B6272;">No activity to report yet.</td></tr>'}
        </table>
        <p style="margin:16px 0 0;font-size:13.5px;color:#5B6272;line-height:1.6;">Approved: ${byOutcome.approved || 0} · Sent: ${byOutcome.sent || 0} · Rejected: ${byOutcome.rejected || 0} · Skipped: ${byOutcome.skipped || 0}</p>`) +
      (portalUrl ? emailInfoCard({
        eyebrow: 'See the details',
        title: 'Open your portal',
        body: 'Per-agent breakdown, drafts awaiting approval, full activity log.',
        ctaHref: esc(portalUrl),
        ctaLabel: 'Open my portal →',
      }) : '') +
      emailSignoff({ name: 'Jon', extra: 'Reply to this email if anything in the report needs human eyes.' });

    const ok = await sendEmail(c.email, `Your weekly Ramped digest — ${runs.length} actions, ${totalHours.toFixed(1)}h saved`, wrapEmail({
      subject: `Your weekly Ramped digest`,
      preheader: `${runs.length} actions · ${totalHours.toFixed(1)}h saved this week.`,
      innerRows, siteUrl: SITE_URL,
    }));
    if (ok) sent++;
  }

  return res.status(200).json({ ok: true, sent, totalCustomers: customers.length });
}
