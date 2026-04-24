// api/admin.js — Admin data endpoint
// GET /api/admin → returns bookings and leads from Supabase

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

  return res.status(200).json({
    configured: true,
    bookings: bookingsResult.ok ? (bookingsResult.data || []) : [],
    leads:    leadsResult.ok    ? (leadsResult.data    || []) : [],
    maps:     mapsResult.ok     ? (mapsResult.data     || []) : [],
  });
}
