// api/questionnaire.js — Attach questionnaire answers to a booking + grade prospect
// POST /api/questionnaire
//
// Body: { email, pain_points, automation_goal, industry, team_size, revenue,
//         inbound, customer_channel, device_os, crm, email_provider,
//         integrations, ai_tools, tools, bottleneck, tier }
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key
//   ANTHROPIC_API_KEY    — Claude API key (optional, enables prospect grading)
//   RESEND_API_KEY       — Resend key (optional, sends graded lead notification)

import { isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL    = 'bookings@30dayramp.com';

const MAX_FIELD = 500;
const MAX_TOOLS = 50;

// ── Supabase helper ──────────────────────────────────────────────────────────
async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'PATCH' ? 'return=minimal' : (method === 'POST' ? 'return=representation' : ''),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { ok: res.ok, status: res.status, data };
}

// ── HTML escape (for emails) ─────────────────────────────────────────────────
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Claude prospect grading ──────────────────────────────────────────────────
async function gradeProspect({ name, company, industry, team_size, bottleneck,
  pain_points, customer_channel, tools, tier, revenue, notes }) {
  if (!ANTHROPIC_KEY) return { grade: null, gradeSummary: null };

  const painText  = Array.isArray(pain_points) ? pain_points.join(', ') : (pain_points || bottleneck || '');
  const toolsText = Array.isArray(tools)        ? tools.join(', ')       : (tools || '');

  const prompt = `You are an expert B2B sales consultant grading a prospect for Ramped AI, a done-for-you AI automation agency. Grade this prospect A, B, C, or D based on fit and budget signal.

GRADING CRITERIA:
A (Hot): Clear specific pain, 10+ person team OR $500K+ revenue, decision-maker signal, premium tier interest, concrete use case
B (Warm): Good pain awareness, 5-10 person team, $100K-$500K revenue, clear use case, some budget signal
C (Lukewarm): Some pain but vague, 2-5 person team, early stage, unclear budget
D (Poor fit): Solo founder, no budget signal, no clear pain

Prospect data:
- Name: ${name || '—'}
- Company: ${company || '—'}
- Industry: ${industry || '—'}
- Team size: ${team_size || '—'}
- Annual revenue: ${revenue || '—'}
- Pain points: ${painText || '—'}
- Customer channel: ${customer_channel || '—'}
- Tools/integrations: ${toolsText || '—'}
- Tier interest: ${tier || '—'}
- Notes: ${notes || '—'}

Respond with ONLY valid JSON — no markdown, no explanation outside the JSON:
{"grade":"A","grade_summary":"2-3 sentence explanation of the grade and key signals"}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) { console.error('Claude grading failed:', r.status); return { grade: null, gradeSummary: null }; }
    const json = await r.json();
    const raw  = json.content?.[0]?.text || '';
    const parsed = JSON.parse(raw.trim());
    const grade  = String(parsed.grade || '').toUpperCase().charAt(0) || null;
    return { grade: ['A','B','C','D'].includes(grade) ? grade : null, gradeSummary: parsed.grade_summary || null };
  } catch (e) {
    console.error('Claude grading error:', e.message);
    return { grade: null, gradeSummary: null };
  }
}

// ── Email helper ─────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) return;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) console.error('Resend error:', r.status, await r.text());
}

// ── CORS ─────────────────────────────────────────────────────────────────────
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

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 10, windowMs: 60_000 });
  if (!rl.ok) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  const body = req.body || {};
  let { email, tier } = body;

  if (!email) return res.status(400).json({ error: 'email is required' });
  email = truncate(String(email).trim(), 254);
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  tier = tier ? truncate(String(tier).trim(), 32) : null;

  // Sanitize helpers
  const t = (v, max = MAX_FIELD) => v ? truncate(String(v).trim(), max) : null;
  const arr = (v) => {
    if (Array.isArray(v)) return v.slice(0, MAX_TOOLS).map(x => truncate(String(x).trim(), 120)).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [truncate(v.trim(), 120)];
    return [];
  };

  // Collect all questionnaire fields — accept both old and new field names
  const qData = {
    pain_points:      arr(body.pain_points),
    automation_goal:  t(body.automation_goal),
    industry:         t(body.industry),
    team_size:        t(body.team_size, 64),
    revenue:          t(body.revenue, 64),
    inbound:          t(body.inbound || body.customer_channel),
    customer_channel: t(body.customer_channel || body.inbound),
    device_os:        t(body.device_os, 64),
    crm:              t(body.crm, 64),
    email_provider:   t(body.email_provider, 64),
    integrations:     arr(body.integrations || body.tools),
    ai_tools:         arr(body.ai_tools),
    bottleneck:       t(body.bottleneck),
    tools:            arr(body.tools || body.integrations),
  };

  // Gracefully no-op when Supabase is not configured
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured — skipping questionnaire save');
    return res.status(200).json({ success: true, updated: false });
  }

  // Find the most recent booking for this email
  const findResult = await supabase(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1&select=id,name,company,notes,tier`
  );

  if (!findResult.ok || !Array.isArray(findResult.data) || !findResult.data.length) {
    console.warn('No booking found for email:', email);
    // Return success so the UX does not break — the questionnaire was filled even if we can't link it
    return res.status(200).json({ success: true, updated: false });
  }

  const booking   = findResult.data[0];
  const bookingId = booking.id;

  // Grade the prospect
  const { grade, gradeSummary } = await gradeProspect({
    name:             booking.name,
    company:          booking.company,
    industry:         qData.industry,
    team_size:        qData.team_size,
    bottleneck:       qData.bottleneck,
    pain_points:      qData.pain_points,
    customer_channel: qData.customer_channel || qData.inbound,
    tools:            qData.integrations,
    tier:             tier || booking.tier,
    revenue:          qData.revenue,
    notes:            booking.notes,
  });

  // Build update payload — store questionnaire as JSONB column + grade columns
  const baseUpdate = {
    questionnaire: qData,
    ...(tier ? { tier } : {}),
  };

  // Try with grade columns first; fall back silently if columns don't exist yet
  if (grade) {
    const withGrade = { ...baseUpdate, grade, grade_summary: gradeSummary };
    const r1 = await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, withGrade);
    if (!r1.ok) {
      console.warn('PATCH with grade columns failed (may not exist yet), retrying without:', r1.status);
      await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, baseUpdate);
    }
  } else {
    await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, baseUpdate);
  }

  // Send graded lead notification to owner
  if (grade && RESEND_KEY) {
    const gc     = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' }[grade] || '#5B6272';
    const tools  = qData.integrations.length ? qData.integrations.join(', ') : '—';
    const pains  = qData.pain_points.length  ? qData.pain_points.join(', ')  : (qData.bottleneck || '—');
    const qName  = booking.name || email;
    await sendEmail(
      OWNER_EMAIL,
      `[${grade}] Discovery call questionnaire — ${qName}`,
      `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:16px;">Booking questionnaire complete</p>
        <div style="background:${gc};color:#fff;display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:10px;font-size:26px;font-weight:900;margin-bottom:12px;">${esc(grade)}</div>
        <p style="color:#374151;font-size:14px;margin-bottom:24px;line-height:1.6;">${esc(gradeSummary || '')}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Name</td><td style="color:#0B1220;">${esc(booking.name || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6B7280;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
          ${qData.industry ? `<tr><td style="padding:6px 0;color:#6B7280;">Industry</td><td style="color:#0B1220;">${esc(qData.industry)}</td></tr>` : ''}
          ${qData.team_size ? `<tr><td style="padding:6px 0;color:#6B7280;">Team size</td><td style="color:#0B1220;">${esc(qData.team_size)}</td></tr>` : ''}
          ${qData.revenue ? `<tr><td style="padding:6px 0;color:#6B7280;">Revenue</td><td style="color:#0B1220;">${esc(qData.revenue)}</td></tr>` : ''}
          ${pains !== '—' ? `<tr><td style="padding:6px 0;color:#6B7280;vertical-align:top;">Pain points</td><td style="color:#0B1220;">${esc(pains)}</td></tr>` : ''}
          ${(qData.customer_channel || qData.inbound) ? `<tr><td style="padding:6px 0;color:#6B7280;">Channel</td><td style="color:#0B1220;">${esc(qData.customer_channel || qData.inbound || '')}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6B7280;">Tools</td><td style="color:#0B1220;">${esc(tools)}</td></tr>
          ${(tier || booking.tier) ? `<tr><td style="padding:6px 0;color:#6B7280;">Tier</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${esc(tier || booking.tier || '')}</td></tr>` : ''}
        </table>
      </div>`
    );
  }

  return res.status(200).json({ success: true, updated: true, grade: grade || null });
}
