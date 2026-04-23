// api/questionnaire.js — Save questionnaire answers to Supabase
// POST /api/questionnaire
// Body: { email, pain_points, automation_goal, industry, team_size, revenue,
//         inbound, integrations, device_os, crm, email_provider, ai_tools, tier }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function sbFetch(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
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

  const {
    email,
    pain_points,
    automation_goal,
    industry,
    team_size,
    revenue,
    inbound,
    integrations,
    device_os,
    crm,
    email_provider,
    ai_tools,
    tier,
  } = req.body || {};

  if (!email) return res.status(400).json({ error: 'email is required' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured — skipping questionnaire save');
    return res.status(200).json({ success: true, saved: false });
  }

  // Build the questionnaire payload
  const questionnaire = {
    pain_points:     Array.isArray(pain_points) ? pain_points : (pain_points ? [pain_points] : []),
    automation_goal: automation_goal || null,
    industry:        industry        || null,
    team_size:       team_size       || null,
    revenue:         revenue         || null,
    inbound:         inbound         || null,
    integrations:    Array.isArray(integrations) ? integrations : (integrations ? [integrations] : []),
    device_os:       device_os       || null,
    crm:             crm             || null,
    email_provider:  email_provider  || null,
    ai_tools:        Array.isArray(ai_tools) ? ai_tools : (ai_tools ? [ai_tools] : []),
    submitted_at:    new Date().toISOString(),
  };

  // 1. Try to find and update the most recent booking for this email
  const findRes = await sbFetch(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1`
  );

  let bookingUpdated = false;
  if (findRes.ok && findRes.data && findRes.data.length > 0) {
    const booking = findRes.data[0];
    const patch = { questionnaire };
    if (tier && !booking.tier) patch.tier = tier;

    const patchRes = await sbFetch(
      'PATCH',
      `/bookings?id=eq.${booking.id}`,
      patch
    );
    if (patchRes.ok) bookingUpdated = true;
    else console.error('Supabase PATCH error:', patchRes.status, patchRes.data);
  }

  // 2. Always log to questionnaire_responses table for full audit trail
  try {
    await sbFetch('POST', '/questionnaire_responses', {
      email,
      tier:          tier || null,
      booking_found: bookingUpdated,
      answers:       questionnaire,
      created_at:    new Date().toISOString(),
    });
  } catch (err) {
    // Table may not exist yet — non-fatal
    console.warn('questionnaire_responses insert failed (table may not exist):', err.message);
  }

  return res.status(200).json({ success: true, booking_updated: bookingUpdated });
}
