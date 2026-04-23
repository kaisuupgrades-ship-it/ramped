// api/questionnaire.js — Attach questionnaire answers to a booking
// POST /api/questionnaire   Body: { email, bottleneck, industry, team_size, tools, customer_channel, tier }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, bottleneck, industry, team_size, tools, customer_channel, tier } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured — skipping questionnaire save');
    return res.status(200).json({ success: true, updated: false });
  }

  const findResult = await supabase(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`
  );
  if (!findResult.ok || !findResult.data || findResult.data.length === 0) {
    return res.status(200).json({ success: true, updated: false });
  }

  const booking = findResult.data[0];
  const patch = {
    questionnaire: {
      bottleneck: bottleneck || null,
      industry: industry || null,
      team_size: team_size || null,
      tools: tools || [],
      customer_channel: customer_channel || null,
    },
  };
  if (tier && !booking.tier) patch.tier = tier;

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking.id}`, {
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
    console.error('Supabase PATCH error:', patchRes.status, await patchRes.text());
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  return res.status(200).json({ success: true, updated: true });
}
