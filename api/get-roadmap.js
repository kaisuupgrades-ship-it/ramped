// api/get-roadmap.js — public roadmap viewer
// GET /api/get-roadmap?id=BOOKING_UUID
// Returns only client-safe roadmap data — no grade, no email, no admin fields

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(o)) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(503).json({ error: 'Not configured' });
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=id,name,company,datetime,automation_map,questionnaire`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) return res.status(500).json({ error: 'Database error' });
  const data = await r.json();
  if (!data?.[0]) return res.status(404).json({ error: 'Roadmap not found' });

  const b = data[0];
  if (!b.automation_map) return res.status(404).json({ error: 'Roadmap not yet generated for this booking' });

  // Only return public fields — never expose grade, email, admin_notes, tier
  return res.status(200).json({
    id:       b.id,
    name:     b.name     || null,
    company:  b.company  || null,
    industry: b.questionnaire?.industry || null,
    datetime: b.datetime || null,
    roadmap:  b.automation_map,
  });
}
