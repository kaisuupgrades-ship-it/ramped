// api/send-followup.js — send a post-call follow-up email to a prospect
// POST /api/send-followup  { bookingId: string }
// Auth: same Bearer token as every other admin endpoint (ADMIN_TOKEN env var,
// constant-time compared in api/_lib/admin-auth.js).

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL    = 'bookings@30dayramp.com';
const SITE_URL      = process.env.SITE_URL || 'https://www.30dayramp.com';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function supabase(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'PATCH' ? 'return=minimal' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_KEY not set'); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  const body = await r.text();
  if (!r.ok) { console.error('Resend error:', r.status, body); return false; }
  console.log('Follow-up sent to', to);
  return true;
}

export default async function handler(req, res) {
  setAdminCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth — shared helper (constant-time compare against ADMIN_TOKEN). Audit H4
  // replaced this file's bespoke ADMIN_PASSWORD check so admin endpoints share
  // one env var.
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { bookingId } = req.body || {};
  if (!bookingId || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return res.status(400).json({ error: 'Invalid bookingId' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Not configured' });

  // Fetch the booking
  const { ok, data } = await supabase('GET',
    `/bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,name,email,company,datetime,timezone,automation_map,followup_sent_at`
  );
  if (!ok || !data?.[0]) return res.status(404).json({ error: 'Booking not found' });

  const b = data[0];

  if (!b.automation_map) return res.status(400).json({ error: 'No roadmap found for this booking — run the questionnaire first.' });
  if (b.followup_sent_at) return res.status(409).json({ error: 'Follow-up already sent', sent_at: b.followup_sent_at });
  if (!RESEND_KEY) return res.status(503).json({ error: 'Email not configured' });

  const roadmap    = b.automation_map;
  const firstName  = (b.name || b.email).split(/\s+/)[0];
  // Audit H2-6 (2026-04-29): the previous unsigned URL always 403'd because
  // /api/get-roadmap requires an HMAC token. Sign it now so the customer can
  // actually open the page.
  let roadmapUrl = '';
  if (isMapTokenConfigured()) {
    const { exp, t } = signMapToken(b.id);
    roadmapUrl = `${SITE_URL}/roadmap?id=${b.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
  } else {
    console.warn('MAP_LINK_SECRET not configured — omitting roadmap link from followup email');
  }

  // Top 2 agent cards for the email
  const agentCardsHTML = roadmap.top_agents?.slice(0, 2).map((a, i) =>
    `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 18px;margin-bottom:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:40px;vertical-align:top;padding-right:12px;">
            <div style="width:30px;height:30px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:13px;font-weight:800;text-align:center;line-height:30px;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
              <tr>
                <td style="vertical-align:middle;"><span style="font-size:14px;font-weight:700;color:#0B1220;">${esc(a.name)}</span></td>
                ${a.channel ? `<td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:8px;"><span style="display:inline-block;background:#E8F0FE;color:#1F4FFF;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${esc(a.channel)}</span></td>` : ''}
              </tr>
            </table>
            <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 6px;">${esc(a.what_it_does)}</p>
            ${a.hours_saved ? `<span style="display:inline-block;background:#ECFDF5;color:#059669;font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px;">⏱ Saves ${esc(a.hours_saved)}</span>` : ''}
          </td>
        </tr>
      </table>
    </div>`
  ).join('') || '';

  // Tier badge
  const tierColors = { starter: '#374151', growth: '#1F4FFF', enterprise: '#7C3AED' };
  const tierBg     = { starter: '#F3F4F6', growth: '#EEF2FF', enterprise: '#F5F3FF' };
  const tier       = roadmap.recommended_tier || 'growth';
  const tierLabel  = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tierColor  = tierColors[tier] || '#374151';
  const tierBgCol  = tierBg[tier] || '#F3F4F6';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:580px;margin:0 auto;">

  <!-- Hero -->
  <div style="background:#0B1220;padding:32px 32px 28px;">
    <div style="display:inline-block;background:#1F4FFF;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;margin-bottom:14px;">RAMPED AI</div>
    <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">Great talking with you, ${esc(firstName)} 👋</p>
    <p style="margin:0;font-size:14px;color:#9CA3AF;line-height:1.5;">Here's a summary of what we covered and the clearest path forward.</p>
  </div>

  <!-- Body -->
  <div style="background:#FAFAFA;padding:28px 32px;">

    ${roadmap.summary ? `
    <!-- Opportunity summary -->
    <div style="background:#fff;border-left:4px solid #1F4FFF;padding:16px 18px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">WHAT WE DISCUSSED</p>
      <p style="margin:0;font-size:14px;color:#0B1220;line-height:1.7;">${esc(roadmap.summary)}</p>
    </div>` : ''}

    <!-- Top 2 agents -->
    ${agentCardsHTML ? `
    <p style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">Where we'd start</p>
    ${agentCardsHTML}` : ''}

    ${roadmap.week_1_focus ? `
    <!-- Week 1 -->
    <div style="background:#0B1220;border-radius:12px;padding:18px 22px;margin-bottom:24px;margin-top:8px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">⚡ WEEK 1 PRIORITY</p>
      <p style="margin:0;font-size:14px;color:#F9FAFB;line-height:1.7;">${esc(roadmap.week_1_focus)}</p>
    </div>` : ''}

    <!-- What happens next -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 22px;margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#0B1220;text-transform:uppercase;letter-spacing:0.04em;">What happens next</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:32px;vertical-align:top;padding-right:12px;padding-bottom:14px;">
            <div style="width:24px;height:24px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:24px;">1</div>
          </td>
          <td style="vertical-align:top;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">
            <div style="font-size:13px;font-weight:700;color:#0B1220;margin-bottom:2px;">Reply to confirm you're in</div>
            <div style="font-size:12px;color:#6B7280;">One email back to this thread is all it takes — I'll handle the rest.</div>
          </td>
        </tr>
        <tr>
          <td style="width:32px;vertical-align:top;padding-right:12px;padding-top:14px;padding-bottom:14px;">
            <div style="width:24px;height:24px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:24px;">2</div>
          </td>
          <td style="vertical-align:top;padding-top:14px;padding-bottom:14px;border-bottom:1px solid #F3F4F6;">
            <div style="font-size:13px;font-weight:700;color:#0B1220;margin-bottom:2px;">Kickoff call (30 min)</div>
            <div style="font-size:12px;color:#6B7280;">We lock in the exact build plan, integrations, and go-live date.</div>
          </td>
        </tr>
        <tr>
          <td style="width:32px;vertical-align:top;padding-right:12px;padding-top:14px;">
            <div style="width:24px;height:24px;border-radius:50%;background:#059669;color:#fff;font-size:12px;font-weight:800;text-align:center;line-height:24px;">3</div>
          </td>
          <td style="vertical-align:top;padding-top:14px;">
            <div style="font-size:13px;font-weight:700;color:#0B1220;margin-bottom:2px;">Day 1 — your agent goes live</div>
            <div style="font-size:12px;color:#6B7280;">Inside your existing tools. No new software to learn.</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Recommended tier + CTA -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 22px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Recommended plan</p>
      <span style="display:inline-block;background:${tierBgCol};color:${tierColor};font-size:16px;font-weight:800;padding:6px 18px;border-radius:8px;margin-bottom:16px;text-transform:capitalize;">${esc(tierLabel)}</span>
      <br>
      <a href="${esc(roadmapUrl)}" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;margin-bottom:12px;">View your full roadmap →</a>
      <br>
      <span style="font-size:13px;color:#6B7280;">Or just reply to this email to get started.</span>
    </div>

    <!-- Sign-off -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:52px;vertical-align:middle;padding-right:14px;">
            <div style="width:40px;height:40px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;">J</div>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:14px;font-weight:700;color:#0B1220;">Jon</div>
            <div style="font-size:12px;color:#6B7280;">Founder, Ramped AI</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="mailto:jon@30dayramp.com" style="display:inline-block;background:#0B1220;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:8px;">Reply to Jon</a>
          </td>
        </tr>
      </table>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Ramped AI · <a href="https://30dayramp.com" style="color:#9CA3AF;text-decoration:none;">30dayramp.com</a></p>
  </div>

</div>
</body>
</html>`;

  const sent = await sendEmail(b.email, `Following up, ${firstName} — your roadmap + next step`, html);
  if (!sent) return res.status(500).json({ error: 'Failed to send email — check Resend configuration.' });

  // Stamp followup_sent_at on the booking
  await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    followup_sent_at: new Date().toISOString(),
  });

  return res.status(200).json({ success: true, sent_to: b.email });
}
