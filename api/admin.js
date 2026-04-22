// api/admin.js — Admin data endpoint
// GET /api/admin?token=VALUE → returns bookings and leads from Supabase
//
// Env vars needed:
//   SUPABASE_URL          — Supabase project URL
//   SUPABASE_SERVICE_KEY  — Supabase service role key
//   ADMIN_TOKEN           — Secret token for admin access

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN;

// ── Supabase helper ───────────────────────────────────────────────────────────
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth: require matching token ──────────────────────────────────────────
  const { token } = req.query;
  if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Check if Supabase is configured ──────────────────────────────────────
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({
      configured: false,
      bookings: [],
      leads: [],
    });
  }

  // ── Fetch bookings ────────────────────────────────────────────────────────
  const bookingsResult = await supabase(
    'GET',
    '/bookings?select=*&order=datetime.desc&limit=200'
  );

  // ── Fetch leads ───────────────────────────────────────────────────────────
  const leadsResult = await supabase(
    'GET',
    '/leads?select=*&order=created_at.desc&limit=200'
  );

  // ── Handle errors gracefully ──────────────────────────────────────────────
  const bookings = bookingsResult.ok ? (bookingsResult.data || []) : [];
  const leads    = leadsResult.ok    ? (leadsResult.data || [])    : [];

  return res.status(200).json({
    configured: true,
    bookings,
    leads,
  });
}
