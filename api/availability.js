// api/availability.js
// GET  /api/availability  — public, returns current availability settings
// PUT  /api/availability  — admin only, updates settings

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'PATCH' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET — public, no auth required
  if (req.method === 'GET') {
    const { ok, data } = await supabase('GET', '/availability_settings?id=eq.1&select=days_available,start_hour,end_hour,slot_duration_min,blocked_dates,timezone');
    if (!ok || !data || data.length === 0) {
      // Return safe defaults if table is empty
      return res.status(200).json({
        days_available: ['Mon','Tue','Wed','Thu','Fri'],
        start_hour: 8,
        end_hour: 18,
        slot_duration_min: 30,
        blocked_dates: [],
        timezone: 'America/Chicago',
      });
    }
    return res.status(200).json(data[0]);
  }

  // PUT — admin only
  if (req.method === 'PUT') {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

    const { days_available, start_hour, end_hour, slot_duration_min, blocked_dates, timezone } = req.body || {};

    // Validate
    const VALID_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    if (!Array.isArray(days_available) || !days_available.every(d => VALID_DAYS.includes(d))) {
      return res.status(400).json({ error: 'Invalid days_available.' });
    }
    if (typeof start_hour !== 'number' || typeof end_hour !== 'number' || start_hour >= end_hour || start_hour < 0 || end_hour > 24) {
      return res.status(400).json({ error: 'Invalid start_hour / end_hour.' });
    }
    if (![15, 30, 60].includes(slot_duration_min)) {
      return res.status(400).json({ error: 'slot_duration_min must be 15, 30, or 60.' });
    }
    if (!Array.isArray(blocked_dates)) {
      return res.status(400).json({ error: 'blocked_dates must be an array.' });
    }
    // Validate date strings YYYY-MM-DD
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (!blocked_dates.every(d => typeof d === 'string' && DATE_RE.test(d))) {
      return res.status(400).json({ error: 'blocked_dates must be YYYY-MM-DD strings.' });
    }

    const patch = {
      days_available,
      start_hour,
      end_hour,
      slot_duration_min,
      blocked_dates,
      timezone: typeof timezone === 'string' ? timezone : 'America/Chicago',
      updated_at: new Date().toISOString(),
    };

    const { ok, data } = await supabase('PATCH', '/availability_settings?id=eq.1', patch);
    if (!ok) return res.status(500).json({ error: 'Failed to save settings.' });
    return res.status(200).json(Array.isArray(data) ? data[0] : data);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
