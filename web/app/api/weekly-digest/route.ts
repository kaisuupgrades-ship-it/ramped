import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { sendEmail, emailShell } from "@/lib/email";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron — Mondays at 09:00 UTC. Sends each active customer a "what your
 * AI department did last week" digest with hours_saved + per-agent counts.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

interface Customer { id: string; name: string | null; email: string; company: string | null; datetime: string }
interface AgentRun { id: string; agent_id: string; action: string; outcome: string; hours_saved: number | null }
interface Agent { id: string; name: string }

async function fetchJson<T>(url: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  return r.ok ? r.json() : [];
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_KEY) return NextResponse.json({ error: "DB not configured" }, { status: 503 });

  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const customers = await fetchJson<Customer>(
    `${SUPABASE_URL}/rest/v1/bookings?or=(payment_status.eq.subscription_active,payment_status.eq.onboarding_paid)&select=id,name,email,company,datetime`,
  );

  let sent = 0;
  for (const c of customers) {
    if (!c.email) continue;
    const runs = await fetchJson<AgentRun>(
      `${SUPABASE_URL}/rest/v1/agent_runs?booking_id=eq.${c.id}&created_at=gte.${encodeURIComponent(since)}&select=id,agent_id,action,outcome,hours_saved&limit=2000`,
    );
    if (!runs.length) continue;

    const totalHours = runs.reduce((sum, r) => sum + (Number(r.hours_saved) || 0), 0);
    const byOutcome = runs.reduce<Record<string, number>>((m, r) => { const k = r.outcome || "unknown"; m[k] = (m[k] || 0) + 1; return m; }, {});
    const agents = await fetchJson<Agent>(`${SUPABASE_URL}/rest/v1/agents?booking_id=eq.${c.id}&select=id,name`);
    const agentName = (id: string) => agents.find((a) => a.id === id)?.name || "Agent";
    const byAgent = runs.reduce<Record<string, number>>((m, r) => { const k = agentName(r.agent_id); m[k] = (m[k] || 0) + 1; return m; }, {});

    const agentRows = Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([n, count]) => `<tr><td style="padding:8px 12px;font-size:13.5px;color:#c8d0dc;border-bottom:1px solid #262f3f;">${esc(n)}</td><td style="padding:8px 12px;font-size:13.5px;color:#929bab;text-align:right;border-bottom:1px solid #262f3f;font-family:'JetBrains Mono',monospace;">${count}</td></tr>`)
      .join("");

    let portalUrl: string | null = null;
    if (isMapTokenConfigured()) {
      try {
        const { exp, t } = signMapToken(c.id, 60 * 60 * 24 * 90);
        portalUrl = `${SITE_URL}/portal?id=${c.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch { /* ignore */ }
    }

    const firstName = (c.name || "").split(/\s+/)[0] || "there";

    const html = emailShell(`
      <h2 style="margin:0 0 8px;font-size:22px;color:#f4f6fa">${esc(firstName)}, your AI department did the work.</h2>
      <p style="margin:0 0 18px;color:#c8d0dc"><strong style="color:#f4f6fa">${runs.length}</strong> actions · <strong style="color:#f4f6fa">${totalHours.toFixed(1)} hours</strong> saved · last 7 days</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid #262f3f;border-radius:10px;overflow:hidden;">
        <tr><td colspan="2" style="padding:10px 12px;background:#0d121b;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#929bab;">Top agents this week</td></tr>
        ${agentRows || '<tr><td colspan="2" style="padding:10px 12px;font-size:13px;color:#929bab;">No activity to report yet.</td></tr>'}
      </table>
      <p style="margin:16px 0 0;font-size:13.5px;color:#929bab;">Approved: ${byOutcome.approved || 0} · Sent: ${byOutcome.sent || 0} · Rejected: ${byOutcome.rejected || 0} · Skipped: ${byOutcome.skipped || 0}</p>
      ${portalUrl
        ? `<p style="margin:24px 0"><a href="${esc(portalUrl)}" style="display:inline-block;padding:12px 22px;background:linear-gradient(180deg,#fdba74,#fb923c);color:#1a0e05;font-weight:700;text-decoration:none;border-radius:10px">Open my portal →</a></p>`
        : ""
      }
      <p style="margin:0;color:#929bab;font-size:13px">Reply to this email if anything in the report needs human eyes.</p>
    `);

    const r = await sendEmail({
      to: c.email,
      subject: `Your weekly Ramped digest — ${runs.length} actions, ${totalHours.toFixed(1)}h saved`,
      html,
      replyTo: site.email,
    });
    if (r.ok) sent++;
  }

  return NextResponse.json({ ok: true, sent, totalCustomers: customers.length });
}
