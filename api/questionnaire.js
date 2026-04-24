// api/questionnaire.js — Attach questionnaire answers to a booking + grade + generate NanoClaw roadmap
// POST /api/questionnaire
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key
//   ANTHROPIC_API_KEY    — Claude API key (grading + roadmap generation)
//   RESEND_API_KEY       — Resend key (owner notification email)

import { isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL    = 'bookings@30dayramp.com';

const MAX_FIELD = 500;
const MAX_ITEMS = 50;

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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Claude: grade + roadmap ──────────────────────────────────────────────────
async function analyzeProspect(booking, qData) {
  if (!ANTHROPIC_KEY) return { grade: null, gradeSummary: null, roadmap: null };

  const painText  = (qData.pain_points || []).join(', ') || qData.bottleneck || '—';
  const toolsText = (qData.integrations || qData.tools || []).join(', ') || '—';
  const aiText    = (qData.ai_tools || []).join(', ') || '—';

  const prompt = `You are a NanoClaw implementation specialist and B2B sales consultant at Ramped AI. Ramped AI sells done-for-you NanoClaw AI agent implementations to businesses.

NanoClaw is an AI agent platform that:
- Connects Claude AI to WhatsApp, Telegram, Slack, Discord, and other messaging channels
- Runs scheduled tasks (cron jobs) for automated reports, follow-ups, and alerts
- Integrates with CRMs, calendars, email providers, and business tools via APIs
- Handles inbound conversations, triggers workflows, and automates multi-step processes
- Each "agent" is a Claude-powered bot that lives in the client's existing channels

Your job: analyze this prospect and produce a grade + a specific NanoClaw roadmap for their discovery call.

GRADING CRITERIA:
A (Hot): Clear specific pain, 10+ team OR $500K+ revenue, decision-maker signal, premium tier interest, concrete use case
B (Warm): Good pain awareness, 5-10 team, $100K-$500K revenue, clear use case, some budget signal
C (Lukewarm): Vague pain, 2-5 team, early stage, unclear budget
D (Poor fit): Solo, no budget signal, no clear pain

PROSPECT DATA:
- Name: ${booking.name || '—'}
- Company: ${booking.company || '—'}
- Industry: ${qData.industry || '—'}
- Team size: ${qData.team_size || '—'}
- Annual revenue: ${qData.revenue || '—'}
- How clients find them: ${qData.lead_source || '—'}
- How customers contact them: ${(qData.inbound || qData.customer_channel) || '—'}
- Pain points: ${painText}
- Platforms & integrations: ${toolsText}
- CRM: ${qData.crm || '—'}
- Email provider: ${qData.email_provider || '—'}
- OS: ${qData.device_os || '—'}
- AI tools already using: ${aiText}
- Tier interest: ${(booking.tier) || '—'}
- What they want AI to handle first: ${qData.automation_goal || '—'}
- Notes: ${booking.notes || '—'}

Respond with ONLY valid JSON — no markdown, no text outside the JSON:
{
  "grade": "A",
  "grade_summary": "2-3 sentence explanation of grade and key signals",
  "roadmap": {
    "summary": "2-3 sentences describing their biggest automation opportunity and what NanoClaw will do for them specifically",
    "top_agents": [
      {
        "name": "Specific agent name e.g. Lead Response Agent",
        "channel": "WhatsApp / Slack / Telegram / etc",
        "what_it_does": "1-2 specific sentences about what this agent does for THIS business — use their actual tools and pain points",
        "trigger": "What triggers it e.g. New form submission, Daily at 8am, New CRM contact",
        "integrations": ["Tool1", "Tool2"],
        "hours_saved": "X-Y hours/week"
      }
    ],
    "quick_wins": ["Specific win 1 using their tools", "Specific win 2", "Specific win 3"],
    "week_1_focus": "The single most impactful agent to build first and why",
    "recommended_tier": "starter or growth or enterprise"
  }
}

Rules:
- Include 3-5 top_agents — prioritize by pain points and existing channels
- Be SPECIFIC: if they use HubSpot + WhatsApp, name those. If their pain is lead follow-up, make that agent #1
- quick_wins should be things they can see value from in week 1
- recommended_tier: starter = small team basic automation, growth = multi-agent multi-channel, enterprise = large org complex workflows`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) { console.error('Claude analysis failed:', r.status); return { grade: null, gradeSummary: null, roadmap: null }; }
    const json = await r.json();
    const raw  = json.content?.[0]?.text || '';
    const parsed = JSON.parse(raw.trim());
    const grade  = String(parsed.grade || '').toUpperCase().charAt(0) || null;
    return {
      grade: ['A','B','C','D'].includes(grade) ? grade : null,
      gradeSummary: parsed.grade_summary || null,
      roadmap: parsed.roadmap || null,
    };
  } catch (e) {
    console.error('Claude analysis error:', e.message);
    return { grade: null, gradeSummary: null, roadmap: null };
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 10, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });

  const body = req.body || {};
  let { email, tier } = body;

  if (!email) return res.status(400).json({ error: 'email is required' });
  email = truncate(String(email).trim(), 254);
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  tier = tier ? truncate(String(tier).trim(), 32) : null;

  // Sanitize helpers
  const t = (v, max = MAX_FIELD) => v ? truncate(String(v).trim(), max) : null;
  const arr = (v) => {
    if (Array.isArray(v)) return v.slice(0, MAX_ITEMS).map(x => truncate(String(x).trim(), 120)).filter(Boolean);
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
    lead_source:      t(body.lead_source, 64),
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase not configured — skipping save');
    return res.status(200).json({ success: true, updated: false });
  }

  // Find most recent booking for this email
  const findResult = await supabase(
    'GET',
    `/bookings?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=1&select=id,name,company,notes,tier`
  );

  if (!findResult.ok || !Array.isArray(findResult.data) || !findResult.data.length) {
    console.warn('No booking found for email:', email);
    return res.status(200).json({ success: true, updated: false });
  }

  const booking   = findResult.data[0];
  const bookingId = booking.id;
  const effectiveTier = tier || booking.tier;

  // Analyze: grade + roadmap (single Claude call)
  const { grade, gradeSummary, roadmap } = await analyzeProspect(
    { ...booking, tier: effectiveTier },
    qData
  );

  // Build update payload — store questionnaire as JSONB + grade + roadmap
  const baseUpdate = {
    questionnaire: qData,
    ...(tier ? { tier } : {}),
  };

  // Try with grade + roadmap columns; fall back if columns don't exist yet
  const withAnalysis = {
    ...baseUpdate,
    ...(grade ? { grade, grade_summary: gradeSummary } : {}),
    ...(roadmap ? { automation_map: roadmap } : {}),
  };

  const r1 = await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, withAnalysis);
  if (!r1.ok) {
    console.warn('Full PATCH failed (columns may not exist), trying base only:', r1.status);
    await supabase('PATCH', `/bookings?id=eq.${encodeURIComponent(bookingId)}`, baseUpdate);
  }

  // Owner notification email with grade + roadmap summary
  if (grade && RESEND_KEY) {
    const gc       = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' }[grade] || '#5B6272';
    const pains    = qData.pain_points.length ? qData.pain_points.join(', ') : (qData.bottleneck || '—');
    const tools    = qData.integrations.length ? qData.integrations.join(', ') : '—';
    const qName    = booking.name || email;
    const agentsHTML = roadmap?.top_agents?.slice(0, 3).map(a =>
      `<tr><td style="padding:6px 0;color:#6B7280;vertical-align:top;width:140px;">${esc(a.name)}</td><td style="color:#0B1220;font-size:13px;">${esc(a.what_it_does)} <span style="color:#6B7280;">(${esc(a.channel)})</span></td></tr>`
    ).join('') || '';

    await sendEmail(
      OWNER_EMAIL,
      `[${grade}] Roadmap ready — ${qName}`,
      `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:16px;">Booking questionnaire + roadmap complete</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <tr>
            <td style="width:60px;vertical-align:middle;padding-right:12px;">
              <div style="background:${gc};color:#fff;width:48px;height:48px;border-radius:10px;font-size:26px;font-weight:900;text-align:center;line-height:48px;">${esc(grade)}</div>
            </td>
            <td style="vertical-align:middle;">
              <p style="color:#374151;font-size:14px;margin:0;line-height:1.5;">${esc(gradeSummary || '')}</p>
            </td>
          </tr>
        </table>
        ${roadmap?.summary ? `<p style="font-size:13px;color:#0B1220;background:#F5F8FF;border-left:3px solid #1F4FFF;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:16px;">${esc(roadmap.summary)}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#6B7280;width:140px;">Name</td><td style="color:#0B1220;">${esc(booking.name || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6B7280;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
          ${qData.industry ? `<tr><td style="padding:6px 0;color:#6B7280;">Industry</td><td style="color:#0B1220;">${esc(qData.industry)}</td></tr>` : ''}
          ${qData.team_size ? `<tr><td style="padding:6px 0;color:#6B7280;">Team size</td><td style="color:#0B1220;">${esc(qData.team_size)}</td></tr>` : ''}
          ${qData.revenue ? `<tr><td style="padding:6px 0;color:#6B7280;">Revenue</td><td style="color:#0B1220;">${esc(qData.revenue)}</td></tr>` : ''}
          ${pains !== '—' ? `<tr><td style="padding:6px 0;color:#6B7280;vertical-align:top;">Pain points</td><td style="color:#0B1220;">${esc(pains)}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6B7280;">Tools</td><td style="color:#0B1220;">${esc(tools)}</td></tr>
          ${effectiveTier ? `<tr><td style="padding:6px 0;color:#6B7280;">Tier</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${esc(effectiveTier)}</td></tr>` : ''}
        </table>
        ${agentsHTML ? `<p style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Top agents for this prospect</p><table style="width:100%;border-collapse:collapse;">${agentsHTML}</table>` : ''}
        ${roadmap?.week_1_focus ? `<p style="margin-top:16px;font-size:13px;color:#0B1220;"><strong>Week 1 focus:</strong> ${esc(roadmap.week_1_focus)}</p>` : ''}
      </div>`
    );
  }

  return res.status(200).json({ success: true, updated: true, grade: grade || null });
}

