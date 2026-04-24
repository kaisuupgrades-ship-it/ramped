// api/get-map.js — retrieve a generated automation map by ID
// GET /api/get-map?id=UUID

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

  const { id } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Invalid map ID' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Not configured' });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/automation_maps?id=eq.${encodeURIComponent(id)}&select=id,created_at,company,name,industry,map_data,status`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return res.status(500).json({ error: 'Database error' });
  const data = await r.json();
  if (!data?.[0]) return res.status(404).json({ error: 'Map not found' });

  return res.status(200).json(data[0]);
}
