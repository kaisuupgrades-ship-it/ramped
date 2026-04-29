// api/resources.js — GET /api/resources
// Returns latest AI resources from Supabase, public endpoint.
//
// Audit M2-9 (2026-04-29): replaced `Access-Control-Allow-Origin: *` with the
// project allowlist used by other endpoints. Resources data is intentionally
// public, but `*` invites third-party widgets to embed our endpoint silently.

const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
    return res.status(200).json([]);
  }

  try {
    const url = `${supabaseUrl}/rest/v1/ai_resources?order=published_at.desc&limit=50`;
    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Supabase error:', response.status, text);
      return res.status(200).json([]);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Failed to fetch from Supabase:', err);
    return res.status(200).json([]);
  }
}
