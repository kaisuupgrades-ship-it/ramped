// api/admin-delete.js — Delete a booking
// POST /api/admin-delete   Body: { id }

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { logAdminAction } from './_lib/audit-log.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  setAdminCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id is required' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal',
    },
  });

  if (!r.ok) {
    console.error('Supabase DELETE error:', r.status, await r.text());
    logAdminAction(req, { action: 'booking.delete', target_table: 'bookings', target_id: id, result_status: 500 }).catch(() => {});
    return res.status(500).json({ error: 'Failed to delete booking' });
  }

  logAdminAction(req, { action: 'booking.delete', target_table: 'bookings', target_id: id, result_status: 200 }).catch(() => {});
  return res.status(200).json({ success: true });
}
