// api/admin.js — Admin data endpoint
// GET /api/admin → returns bookings and leads from Supabase
//
// Each booking is enriched server-side with:
//   - portal_url:    signed 90-day URL to that customer's /portal view
//   - phase:         current implementation phase (Pre-kickoff/Kickoff/Discovery/Build/QA/Live)
//   - phase_eyebrow: human-readable phase label that matches what the portal shows
//   - day_of_thirty: days elapsed since kickoff (null pre-kickoff)
//
// Computed via the shared api/_lib/phase.js so admin + portal always agree.

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { computePhase } from './_lib/phase.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

async function supabase(method, path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': '',
    },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ configured: false, bookings: [], leads: [] });
  }

  const bookingsResult = await supabase('GET', '/bookings?select=*&order=datetime.desc&limit=200');
  const leadsResult    = await supabase('GET', '/leads?select=*&order=created_at.desc&limit=200');
  const mapsResult     = await supabase('GET', '/automation_maps?select=*&order=created_at.desc&limit=200');

  // Enrich each booking with computed phase + signed portal URL.
  // Mints tokens server-side so MAP_LINK_SECRET never leaks to the admin frontend.
  const tokensConfigured = isMapTokenConfigured();
  const bookings = (bookingsResult.ok ? (bookingsResult.data || []) : []).map(b => {
    const phase = computePhase(b.datetime);
    let portal_url = null;
    if (tokensConfigured && b.id) {
      try {
        const { exp, t } = signMapToken(b.id, 60 * 60 * 24 * 90);
        portal_url = `${SITE_URL}/portal?id=${b.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch (_) { /* MAP_LINK_SECRET may be missing — leave portal_url null */ }
    }
    return {
      ...b,
      phase: phase.phase,
      phase_eyebrow: phase.eyebrow,
      phase_step: phase.step,
      day_of_thirty: phase.dayOfThirty,
      portal_url,
    };
  });

  return res.status(200).json({
    configured: true,
    portal_links_enabled: tokensConfigured,
    bookings,
    leads:    leadsResult.ok    ? (leadsResult.data    || []) : [],
    maps:     mapsResult.ok     ? (mapsResult.data     || []) : [],
  });
}
