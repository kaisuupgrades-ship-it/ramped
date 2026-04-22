// api/admin-update.js — Update booking status or admin notes
// POST /api/admin-update?token=VALUE
//
// Body: { id, status?, admin_notes? }
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key
//   ADMIN_TOKEN          — Secret token for admin access

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN;

const VALID_STATUSES = new Set(['upcoming', 'completed', 'converted', 'no_show']);

// ── Supabase helper ───────────────────────────────────────────────────────────
async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth: require matching token ──────────────────────────────────────────
  const { token } = req.query;
  if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id, status, admin_notes } = req.body || {};

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  // Must have at least one field to update
  if (status === undefined && admin_notes === undefined) {
    return res.status(400).json({ error: 'At least one of status or admin_notes is required' });
  }

  // ── Validate status if provided ───────────────────────────────────────────
  if (status !== undefined && !VALID_STATUSES.has(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
    });
  }

  // ── Build patch payload ───────────────────────────────────────────────────
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (admin_notes !== undefined) patch.admin_notes = admin_notes;

  // ── PATCH the booking ─────────────────────────────────────────────────────
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(patch),
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error('Supabase PATCH error:', patchRes.status, errText);
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  return res.status(200).json({ success: true });
}
