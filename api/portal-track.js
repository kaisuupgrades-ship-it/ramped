// api/portal-track.js — Portal activity beacon.
// POST /api/portal-track?id=…&exp=…&t=…
// Body: { event: 'view' | 'click_roadmap' | 'click_meet' | ..., path?: string, metadata?: object }
//
// Auth: HMAC-signed portal token (same as /api/portal-data).
// Side effects:
//   1. INSERT a row into portal_events
//   2. UPDATE bookings.portal_last_seen_at + portal_visit_count
// Best-effort: returns 200 even when one of the two writes fails — this is a beacon, not a transaction.
//
// Privacy: we hash the IP with IP_HASH_SALT before storing (raw IPs never land in the DB).

import crypto from 'crypto';
import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const IP_SALT      = process.env.IP_HASH_SALT || 'ramped-default-salt-rotate-me';

const ALLOWED_EVENTS = new Set([
  'view', 'click_roadmap', 'click_meet', 'click_team_email',
  'submit_ticket', 'view_ticket', 'click_quick_link',
]);

function ipHash(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(String(ip) + ':' + IP_SALT).digest('hex').slice(0, 16);
}

function uaHint(ua) {
  if (!ua) return null;
  if (/iPhone|iPad|iPod/i.test(ua)) return /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua) ? 'iOS Safari' : 'iOS browser';
  if (/Android/i.test(ua))          return /Chrome/i.test(ua) ? 'Android Chrome' : 'Android browser';
  if (/Macintosh.*Safari/i.test(ua) && !/Chrome/i.test(ua))  return 'macOS Safari';
  if (/Chrome/i.test(ua))           return 'Chrome desktop';
  if (/Firefox/i.test(ua))          return 'Firefox desktop';
  return 'Other';
}

async function readJsonBody(req) {
  // Vercel parses application/json automatically; sendBeacon ships as Blob with JSON content-type.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  // If no parsed body (e.g. sendBeacon Blob path on some runtimes), read raw stream
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))      return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())                  return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))              return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)           return res.status(503).json({ error: 'Database not configured' });

  const body = await readJsonBody(req);
  const event = ALLOWED_EVENTS.has(body.event) ? body.event : 'view';
  const path = typeof body.path === 'string' ? body.path.slice(0, 200) : null;
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};

  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : null) || req.headers['x-real-ip'] || null;
  const ua = req.headers['user-agent'] || null;

  // Insert event row (best-effort)
  fetch(`${SUPABASE_URL}/rest/v1/portal_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      booking_id: id,
      event,
      path,
      ip_hash: ipHash(ip),
      ua_hint: uaHint(ua),
      metadata,
    }),
  }).catch(err => console.warn('portal_events insert failed:', err.message));

  // Bump bookings.portal_last_seen_at + portal_visit_count via PATCH (best-effort).
  // Supabase REST doesn't support UPDATE-and-increment atomically without an RPC, so we read
  // current count then PATCH. Race is acceptable for an analytics counter.
  try {
    const cur = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=portal_visit_count`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (cur.ok) {
      const arr = await cur.json();
      const next = ((arr?.[0]?.portal_visit_count) || 0) + 1;
      fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ portal_last_seen_at: new Date().toISOString(), portal_visit_count: next }),
      }).catch(err => console.warn('bookings last_seen PATCH failed:', err.message));
    }
  } catch (err) {
    console.warn('portal-track update failed:', err.message);
  }

  return res.status(204).end();
}
