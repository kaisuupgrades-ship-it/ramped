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
const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'http://localhost:3000',
];
function setCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin || 'http://x').hostname)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, bottleneck, industry, team_size, tools, customer_channel, tier } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  // Gracefully no-op when Supabase isn't configured — the questionnaire UX
  // shouldn't fail for the user even if we can't persist their answers.
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured — skipping questionnaire save');
    return res.status(200).json({ success: true, updated: false });
  }

  // Find the booking this questionnaire belongs to: the user just submitted
  // the booking form, so pick the most recently CREATED record for this email.
  const findResult = await supabase(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`
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
      tools: tools || [],          // array now, not string
      customer_channel: customer_channel || null,
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
