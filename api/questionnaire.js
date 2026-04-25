// api/questionnaire.js — Attach questionnaire answers to a booking + grade + generate automation roadmap
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

  const prompt = `You are an AI automation consultant at Ramped AI. Ramped AI builds done-for-you AI agent implementations for small and mid-size businesses.

Each AI agent we build:
- Lives inside the client's existing tools (Slack, email, CRM, etc.) — no new apps to learn
- Handles repetitive tasks automatically: follow-ups, reporting, scheduling, responses
- Is triggered by real business events (new CRM contact, form submission, daily schedule, etc.)
- Saves the team hours each week by removing manual busywork

Your job: analyze this prospect and produce a grade + a personalized automation roadmap for their discovery call. Write everything from the client's perspective — focus on outcomes and time saved, not technology. NEVER mention "NanoClaw" or any internal platform names — use plain language like "AI agent", "automation", or "assistant".

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
    "summary": "2-3 sentences describing their biggest automation opportunity in plain language — focus on the business outcome, not technology",
    "top_agents": [
      {
        "name": "Specific agent name e.g. Lead Response Agent",
        "channel": "WhatsApp / Slack / Telegram / etc",
        "what_it_does": "1-2 sentences written to the client about what this agent does for their business — use outcomes and their actual pain points, not technical jargon",
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
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      console.error('Claude analysis failed:', r.status, errBody);
      return { grade: null, gradeSummary: null, roadmap: null };
    }
    const json = await r.json();
    const raw  = json.content?.[0]?.text || '';
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
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
  if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set — skipping email to', to); return { ok: false, error: 'no_key' }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  const body = await r.text();
  if (!r.ok) {
    console.error('Resend error sending to', to, ':', r.status, body);
    return { ok: false, status: r.status, error: body };
  }
  console.log('Email sent to', to, ':', r.status, body);
  return { ok: true };
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
    const gc         = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' }[grade] || '#5B6272';
    const gradeLabel = { A: 'Hot lead 🔥', B: 'Warm lead', C: 'Lukewarm', D: 'Poor fit' }[grade] || '';
    const pains      = qData.pain_points.length ? qData.pain_points.join(', ') : (qData.bottleneck || '—');
    const tools      = qData.integrations.length ? qData.integrations.join(', ') : '—';
    const qName      = booking.name || email;

    const agentRowsHTML = roadmap?.top_agents?.slice(0, 3).map((a, i) =>
      `<tr>
        <td style="padding:10px 0;border-top:1px solid #F3F4F6;vertical-align:top;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:28px;vertical-align:top;padding-right:10px;">
                <div style="width:22px;height:22px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:22px;">${i + 1}</div>
              </td>
              <td style="vertical-align:top;">
                <div style="font-size:13px;font-weight:700;color:#0B1220;">${esc(a.name)}<span style="font-weight:400;color:#6B7280;font-size:12px;"> · ${esc(a.channel || '')}</span></div>
                <div style="font-size:12px;color:#374151;line-height:1.5;margin-top:2px;">${esc(a.what_it_does)}</div>
                ${a.hours_saved ? `<div style="margin-top:3px;font-size:11px;color:#059669;font-weight:600;">⏱ ${esc(a.hours_saved)}</div>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    ).join('') || '';

    await sendEmail(
      OWNER_EMAIL,
      `[${grade}] ${gradeLabel} — ${qName}`,
      `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;">

  <!-- Grade banner -->
  <div style="background:${gc};padding:24px 28px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:68px;vertical-align:middle;padding-right:16px;">
          <div style="width:56px;height:56px;border-radius:12px;background:rgba(255,255,255,0.2);color:#fff;font-size:32px;font-weight:900;text-align:center;line-height:56px;">${esc(grade)}</div>
        </td>
        <td style="vertical-align:middle;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.7);margin-bottom:3px;">RAMPED AI · SCORECARD</div>
          <div style="font-size:20px;font-weight:800;color:#fff;line-height:1.2;">${esc(gradeLabel)} — ${esc(qName)}</div>
          ${gradeSummary ? `<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:6px;line-height:1.5;">${esc(gradeSummary)}</div>` : ''}
        </td>
      </tr>
    </table>
  </div>

  <!-- Body -->
  <div style="background:#FAFAFA;padding:24px 28px;">

    <!-- Prospect details card -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Prospect Details</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:5px 0;color:#6B7280;width:110px;">Name</td><td style="color:#0B1220;font-weight:600;">${esc(booking.name || '—')}</td></tr>
        <tr><td style="padding:5px 0;color:#6B7280;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;text-decoration:none;">${esc(email)}</a></td></tr>
        ${qData.industry ? `<tr><td style="padding:5px 0;color:#6B7280;">Industry</td><td style="color:#0B1220;">${esc(qData.industry)}</td></tr>` : ''}
        ${qData.team_size ? `<tr><td style="padding:5px 0;color:#6B7280;">Team size</td><td style="color:#0B1220;">${esc(qData.team_size)}</td></tr>` : ''}
        ${qData.revenue ? `<tr><td style="padding:5px 0;color:#6B7280;">Revenue</td><td style="color:#0B1220;font-weight:600;">${esc(qData.revenue)}</td></tr>` : ''}
        ${pains !== '—' ? `<tr><td style="padding:5px 0;color:#6B7280;vertical-align:top;">Pain points</td><td style="color:#0B1220;">${esc(pains)}</td></tr>` : ''}
        <tr><td style="padding:5px 0;color:#6B7280;vertical-align:top;">Tools</td><td style="color:#0B1220;">${esc(tools)}</td></tr>
        ${effectiveTier ? `<tr><td style="padding:5px 0;color:#6B7280;">Tier interest</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${esc(effectiveTier)}</td></tr>` : ''}
      </table>
    </div>

    ${roadmap?.summary ? `
    <!-- Roadmap summary -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-left:4px solid #1F4FFF;border-radius:0 12px 12px 0;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">Automation Opportunity</p>
      <p style="margin:0;font-size:13px;color:#0B1220;line-height:1.6;">${esc(roadmap.summary)}</p>
    </div>` : ''}

    ${agentRowsHTML ? `
    <!-- Top agents card -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Top Agents for This Prospect</p>
      <table style="width:100%;border-collapse:collapse;">
        ${agentRowsHTML}
      </table>
    </div>` : ''}

    ${roadmap?.week_1_focus ? `
    <!-- Week 1 focus -->
    <div style="background:#0B1220;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">⚡ Where to Start</p>
      <p style="margin:0;font-size:13px;color:#F9FAFB;line-height:1.6;">${esc(roadmap.week_1_focus)}</p>
    </div>` : ''}

    <!-- Admin CTA -->
    <div style="text-align:center;padding-top:4px;">
      <a href="https://30dayramp.com/admin" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 24px;border-radius:8px;">View in Admin Panel →</a>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:14px 28px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Ramped AI · Internal scorecard · Do not forward</p>
  </div>

</div>
</body>
</html>`
    );
  }

  // Client roadmap email — send their personalized automation plan before the call
  if (roadmap && RESEND_KEY) {
    const SITE_URL    = process.env.SITE_URL || 'https://www.30dayramp.com';
    const roadmapUrl  = `${SITE_URL}/roadmap?id=${bookingId}`;
    const firstName   = (booking.name || email).split(/\s+/)[0];
    const agentCount  = roadmap.top_agents?.length || 0;

    const clientAgentsHTML = roadmap.top_agents?.map((a, i) =>
      `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin-bottom:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:42px;vertical-align:top;padding-right:14px;">
              <div style="width:32px;height:32px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:32px;">${i + 1}</div>
            </td>
            <td style="vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="font-size:15px;font-weight:700;color:#0B1220;">${esc(a.name)}</span>
                  </td>
                  ${a.channel ? `<td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:8px;">
                    <span style="display:inline-block;background:#E8F0FE;color:#1F4FFF;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">${esc(a.channel)}</span>
                  </td>` : ''}
                </tr>
              </table>
              <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 8px;">${esc(a.what_it_does)}</p>
              ${a.hours_saved ? `<span style="display:inline-block;background:#ECFDF5;color:#059669;font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;">⏱ Saves ${esc(a.hours_saved)}</span>` : ''}
            </td>
          </tr>
        </table>
      </div>`
    ).join('') || '';

    await sendEmail(
      email,
      `Your automation roadmap is ready, ${firstName}`,
      `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:580px;margin:0 auto;">

  <!-- Hero header -->
  <div style="background:#0B1220;padding:32px 32px 28px;">
    <div style="display:inline-block;background:#1F4FFF;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;margin-bottom:14px;">RAMPED AI</div>
    <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#fff;line-height:1.2;">Your automation roadmap<br>is ready, ${esc(firstName)} ✦</p>
    <p style="margin:0;font-size:14px;color:#9CA3AF;line-height:1.5;">Based on your answers — we'll walk through this together on the call.</p>
  </div>

  <!-- Body -->
  <div style="background:#FAFAFA;padding:28px 32px;">

    ${roadmap.summary ? `
    <!-- Summary callout -->
    <div style="background:#fff;border-left:4px solid #1F4FFF;padding:16px 18px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">YOUR OPPORTUNITY</p>
      <p style="margin:0;font-size:14px;color:#0B1220;line-height:1.7;font-style:italic;">"${esc(roadmap.summary)}"</p>
    </div>` : ''}

    <!-- Stats bar -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#fff;border:1px solid #E5E7EB;">
      <tr>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #E5E7EB;width:33%;">
          <div style="font-size:28px;font-weight:900;color:#1F4FFF;line-height:1;">${agentCount}</div>
          <div style="font-size:10px;color:#6B7280;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">AI Agents</div>
        </td>
        <td style="text-align:center;padding:16px 8px;border-right:1px solid #E5E7EB;width:33%;">
          <div style="font-size:28px;font-weight:900;color:#1F4FFF;line-height:1;">30</div>
          <div style="font-size:10px;color:#6B7280;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Day Go-Live</div>
        </td>
        <td style="text-align:center;padding:16px 8px;width:33%;">
          <div style="font-size:28px;font-weight:900;color:#059669;line-height:1;">$0</div>
          <div style="font-size:10px;color:#6B7280;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">If We Miss It</div>
        </td>
      </tr>
    </table>

    ${clientAgentsHTML ? `
    <!-- Agent cards -->
    <p style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">What we'd build for you</p>
    ${clientAgentsHTML}` : ''}

    ${roadmap.week_1_focus ? `
    <!-- Week 1 focus -->
    <div style="background:#0B1220;border-radius:12px;padding:20px 22px;margin-bottom:24px;margin-top:16px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">⚡ WHERE WE'D START</p>
      <p style="margin:0;font-size:14px;color:#F9FAFB;line-height:1.7;">${esc(roadmap.week_1_focus)}</p>
    </div>` : ''}

    <!-- View online CTA -->
    <div style="text-align:center;margin-bottom:20px;">
      <a href="${esc(roadmapUrl)}" style="display:inline-block;background:#F3F4F6;color:#0B1220;font-size:13px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:8px;border:1px solid #E5E7EB;">🔗 View this roadmap online →</a>
    </div>

    <!-- Closing note -->
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 24px;">This is a starting point — on the call we'll make sure it fits your actual workflow and prioritize what makes the most sense to ship first. No pressure, no pitch.</p>

    <!-- Sign-off card -->
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 22px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:52px;vertical-align:middle;padding-right:14px;">
            <div style="width:40px;height:40px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:18px;font-weight:800;text-align:center;line-height:40px;">J</div>
          </td>
          <td style="vertical-align:middle;">
            <div style="font-size:14px;font-weight:700;color:#0B1220;line-height:1.2;">Jon</div>
            <div style="font-size:12px;color:#6B7280;">Founder, Ramped AI</div>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <a href="mailto:jon@30dayramp.com" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:8px;">Reply to Jon</a>
          </td>
        </tr>
      </table>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Ramped AI · <a href="https://30dayramp.com" style="color:#9CA3AF;text-decoration:none;">30dayramp.com</a> · Questions? <a href="mailto:jon@30dayramp.com" style="color:#9CA3AF;text-decoration:none;">jon@30dayramp.com</a></p>
  </div>

</div>
</body>
</html>`
    );
  }

  return res.status(200).json({ success: true, updated: true, grade: grade || null, emails_sent: !!RESEND_KEY });
}


