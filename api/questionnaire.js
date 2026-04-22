// api/questionnaire.js — Attach questionnaire answers to a booking
// POST /api/questionnaire
//
// Body: { email, bottleneck, industry, team_size, tools, tier }
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ── Supabase helper ───────────────────────────────────────────────────────────
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, bottleneck, industry, team_size, tools, tier } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  // ── Find most recent booking for this email ───────────────────────────────
  const findResult = await supabase(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=datetime.desc&limit=1`
  );

  if (!findResult.ok || !findResult.data || findResult.data.length === 0) {
    // No booking found — return gracefully without error
    return res.status(200).json({ success: true, updated: false });
  }

  const booking = findResult.data[0];
  const bookingId = booking.id;

  // ── Build patch payload ───────────────────────────────────────────────────
  const patch = {
    questionnaire: {
      bottleneck: bottleneck || null,
      industry: industry || null,
      team_size: team_size || null,
      tools: tools || null,
    },
  };

  // Only set tier if provided and not already set on the booking
  if (tier && !booking.tier) {
    patch.tier = tier;
  }

  // ── PATCH the booking ─────────────────────────────────────────────────────
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`, {
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
    const errText = await patchRes.text();
    console.error('Supabase PATCH error:', patchRes.status, errText);
    return res.status(500).json({ error: 'Failed to update booking' });
  }

  return res.status(200).json({ success: true, updated: true });
}
