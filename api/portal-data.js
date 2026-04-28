// api/portal-data.js — Client portal data endpoint.
// GET /api/portal-data?id=BOOKING_UUID&exp=<unix>&t=<hmac>
//
// Auth: same HMAC-signed expiring token as /api/get-roadmap (see api/_lib/map-token.js).
// We use a 90-day TTL when minting these tokens (signMapToken(id, 7776000)) so customers
// can bookmark their portal link and have it work for the duration of the engagement.
//
// Returns a payload optimized for portal.html — only client-safe fields, never exposing
// grade, admin_notes, or other internal data.
//
// Phase 1 (this file): booking + automation_map + computed phase string + next call info.
// Phase 2 (todo): join in agents / agent_runs / agent_drafts tables once the runtime exists.
// Phase 3 (todo): fold in Stripe customer + invoices.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { computePhase } from './_lib/phase.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtCallTime(iso, tz) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  if (tz) opts.timeZone = tz;
  return d.toLocaleString('en-US', opts);
}

export default async function handler(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Not configured' });
  }
  if (!isMapTokenConfigured()) {
    return res.status(503).json({ error: 'Portal link signing not configured' });
  }
  if (!verifyMapToken(id, exp, t)) {
    return res.status(403).json({ error: 'This link is invalid or has expired. Email jon@30dayramp.com to get a fresh one.' });
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=id,name,company,email,tier,status,datetime,timezone,meet_link,automation_map,questionnaire,payment_status,onboarding_completed_at,created_at`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) return res.status(500).json({ error: 'Database error' });
  const data = await r.json();
  if (!data?.[0]) return res.status(404).json({ error: 'Booking not found' });
  const b = data[0];

  // Pull pending drafts + recent agent activity (best-effort; tables may not exist on older deploys)
  let drafts = [];
  let agents = [];
  let activity = [];
  try {
    const [dr, ar, rr] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/agent_drafts?booking_id=eq.${encodeURIComponent(id)}&status=eq.pending&select=id,subject,body,recipient,channel,created_at&order=created_at.desc&limit=20`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/agents?booking_id=eq.${encodeURIComponent(id)}&status=neq.archived&select=id,name,channel,description,status&order=created_at.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/agent_runs?booking_id=eq.${encodeURIComponent(id)}&select=id,agent_id,action,outcome,hours_saved,created_at&order=created_at.desc&limit=20`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
    ]);
    drafts   = dr.ok ? await dr.json() : [];
    agents   = ar.ok ? await ar.json() : [];
    activity = rr.ok ? await rr.json() : [];
  } catch (_) { /* tables not yet migrated, leave empty */ }

  // Kickoff = discovery call datetime. Go-live = +30 days.
  const kickoffISO = b.datetime;
  const goliveISO = kickoffISO ? new Date(new Date(kickoffISO).getTime() + 30 * 86400000).toISOString() : null;
  const phaseInfo = computePhase(kickoffISO);

  // Build the welcome subhead from automation_map summary if available; otherwise a fallback.
  const agentCount = b.automation_map?.top_agents?.length || 0;
  const welcomeSub = b.automation_map?.summary
    ? b.automation_map.summary
    : (agentCount
        ? `${agentCount} agents identified, build kicked off. You'll see live data here the moment they're running.`
        : `We're scoping your AI department. Discovery call coming up.`);

  return res.status(200).json({
    booking: {
      id: b.id,
      name: b.name || null,
      company: b.company || null,
      tier: b.tier || null,
      status: b.status || null,
      payment_status: b.payment_status || null,
      onboarding_completed_at: b.onboarding_completed_at || null,
    },
    payment_status: b.payment_status || null,
    phase_eyebrow: phaseInfo.eyebrow,
    phase: phaseInfo.phase,
    phase_step: phaseInfo.step,
    day_of_thirty: phaseInfo.dayOfThirty,
    welcome_sub: welcomeSub,
    kickoff_date: fmtDate(kickoffISO),
    golive_date: fmtDate(goliveISO),
    next_call: {
      when: fmtCallTime(kickoffISO, b.timezone),
      what: phaseInfo.phase === 'Live' ? 'Monthly strategy call · 30 min' : 'Weekly check-in · 30 min',
      meet_url: b.meet_link || null,
    },
    automation_map: b.automation_map || null,
    agents,
    activity,
    drafts,
  });
}
