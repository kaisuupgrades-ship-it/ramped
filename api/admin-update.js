// api/admin-update.js — Update a booking
// POST /api/admin-update?token=VALUE
//
// Body: { id, status?, admin_notes?, name?, email?, company?, datetime?,
//         notes?, tier?, timezone? }
//
// Only fields present in the body are patched. `id` + token are required.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN;

const VALID_STATUSES = new Set(['upcoming', 'completed', 'converted', 'no_show']);
const VALID_TIERS    = new Set(['starter', 'growth', 'enterprise', '']);
const EDITABLE_FIELDS = [
  'status', 'admin_notes', 'name', 'email', 'company',
  'datetime', 'notes', 'tier', 'timezone',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;
  if (!token || !ADMIN_TOKEN || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const body = req.body || {};
  const { id } = body;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field];
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'No editable fields provided' });
  }

  if (patch.status !== undefined && !VALID_STATUSES.has(patch.status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
    });
  }
  if (patch.tier !== undefined && patch.tier !== null && !VALID_TIERS.has(patch.tier)) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  // Normalize empty strings on optional fields to null so they clear cleanly.
  for (const f of ['company', 'notes', 'tier', 'timezone', 'admin_notes']) {
    if (patch[f] === '') patch[f] = null;
  }

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
