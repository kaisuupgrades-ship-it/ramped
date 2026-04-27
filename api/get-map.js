// api/get-map.js — retrieve a generated automation map by ID
// GET /api/get-map?id=UUID&exp=<unix>&t=<hmac>
//
// Auth: HMAC-signed expiring token (see api/_lib/map-token.js). Required.
// Pre-2026-04-27 emails contained un-signed links; if MAP_LINK_SECRET is unset
// the endpoint returns 503 to fail closed instead of silently exposing data.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = [
  'https://30dayramp.com', 'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid map ID' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Not configured' });

  // Fail closed if the signing secret isn't configured.
  if (!isMapTokenConfigured()) {
    return res.status(503).json({ error: 'Map link signing not configured' });
  }
  if (!verifyMapToken(id, exp, t)) {
    return res.status(403).json({ error: 'This link is invalid or has expired. Please request a new one.' });
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_maps?id=eq.${encodeURIComponent(id)}&select=id,created_at,company,name,industry,map_data,status`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return res.status(500).json({ error: 'Database error' });
  const data = await r.json();
  if (!data?.[0]) return res.status(404).json({ error: 'Map not found' });

  return res.status(200).json(data[0]);
}
