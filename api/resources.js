// api/resources.js — GET /api/resources
// Returns latest AI resources from Supabase, public endpoint

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
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
