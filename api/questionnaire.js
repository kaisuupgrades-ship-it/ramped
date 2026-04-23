// api/questionnaire.js — Attach questionnaire answers to a booking
// POST /api/questionnaire
//
// Body: { email, bottleneck, industry, team_size, tools, tier }
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key

import { isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Cap the length of free-text fields coming from the client.
const MAX_FIELD = 500;
const MAX_TOOLS = 50;

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
// Explicit allowlist — a *.vercel.app regex would let any preview deployment
// from any Vercel account hit this API.
const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];
function setCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
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

  // Per-IP rate limit so the questionnaire endpoint can't be spammed either.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  let { email, bottleneck, industry, team_size, tools, customer_channel, tier } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  email = truncate(String(email).trim(), 254);
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Trim & cap every free-text field before it goes to Supabase.
  bottleneck       = bottleneck       ? truncate(String(bottleneck).trim(),       MAX_FIELD) : null;
  industry         = industry         ? truncate(String(industry).trim(),         MAX_FIELD) : null;
  team_size        = team_size        ? truncate(String(team_size).trim(),        64)        : null;
  customer_channel = customer_channel ? truncate(String(customer_channel).trim(), MAX_FIELD) : null;
  tier             = tier             ? truncate(String(tier).trim(),             32)        : null;

  // `tools` is expected to be an array; tolerate string input, cap items + lengths.
  if (Array.isArray(tools)) {
    tools = tools.slice(0, MAX_TOOLS).map(t => truncate(String(t).trim(), 120));
  } else if (typeof tools === 'string' && tools.trim()) {
    tools = [truncate(tools.trim(), 120)];
  } else {
    tools = [];
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
    `/bookings?email=eq.${encodeURIComponent(email)}&order=