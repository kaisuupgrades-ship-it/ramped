// api/generate-map.js — AI-powered automation map generator
// POST /api/generate-map

import { isValidEmail, truncate, checkRateLimit, getClientIp, esc } from './_lib/validate.js';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY    = process.env.RESEND_API_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL    = 'maps@30dayramp.com';
const SITE_URL      = process.env.SITE_URL || 'https://www.30dayramp.com';

const ALLOWED_ORIGINS = [
  'https://30dayramp.com', 'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

function setCors(req, res) {
  const o = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(o)) { res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function supabaseInsert(table, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, data: t ? JSON.parse(t) : null };
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) return;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) console.error('Resend error:', r.status, await r.text());
}

const SYSTEM_PROMPT = `You are Ramped AI's automation map generator. You analyze SMB intake questionnaire answers and output a precise, data-rich custom automation map — exactly what a senior implementation consultant would hand-deliver before a 60-minute Map Call.

## DECISION LOGIC

### Time Sink → Skill Priority
- Lead follow-up → Channel-triage + CRM log skill (effort M = 3–5 days)
- Answering repetitive questions → FAQ-from-docs + routing skill (effort S = 2–3 days)
- Scheduling → Calendar-proposal + follow-up skill (effort S)
- Quotes & proposals → Quote-draft skill pulls CRM + pricing (effort L = 5–10 days)
- Order/invoice processing → Order-triage + anomaly-flag skill (effort M)
- Customer support → Tier-1 answer + handoff-to-human skill (effort M)
- Data entry & reporting → Recurring-report + CRM sync (effort M)
- Employee onboarding → Buddy-bot internal (effort S)
Sprint build budget = 20 days. Select top 3–5 skills that fit.

### Industry → Persona Presets
- Cannabis: Retail-compliant, conservative → IG DM triage + order triage
- Healthcare: HIPAA-aware, polite, no diagnosis → Appointment ops + FAQ
- Field services / PE: Operator-terse, metric-first → Dispatch triage + daily ops digest
- Real estate: Warm, fast, lead-specific → Inquiry triage + showing scheduler
- Law: Formal, precise, no advice → Intake qualifier + scheduling
- E-commerce: Energetic, on-brand → Shopify order triage + WISMO
- Default: Operator persona

### Team Size → Deployment
- 1–25: 1 channel, founder-led (Fly.io shared-cpu-1x 1GB)
- 26–50: 3 channels, 2 depts (shared-cpu-2x 2GB)
- 51–100: 5+ channels, role-based routing (shared-cpu-4x 4GB)
- 100+: 10+ channels, SSO, HA (performance-2x 8GB + HA)

### Revenue → Pricing Tier
- Under $300K → Starter ($27,500/yr + $2,500 onboarding)
- $300K–$1M → Starter or Growth
- $1M–$5M → Growth ($55,000/yr + $3,500 onboarding) — core ICP
- $5M+ → Enterprise (custom)

### Integration Order
- Wk 1: Slack (always first), primary inbox (email or IG DM)
- Wk 2: CRM, Shopify, Google Calendar
- Wk 3: Specialty APIs, SMS/Twilio, additional channels
- Wk 4: Full rollout, monitoring, training

### Time Sink → Realistic Hours/Week (SMB averages)
- Lead follow-up: 12–20 hrs/wk
- Customer support (repetitive Qs): 8–15 hrs/wk
- Scheduling: 3–6 hrs/wk
- Quotes & proposals: 5–10 hrs/wk
- Order processing: 5–12 hrs/wk
- Data entry & reporting: 4–8 hrs/wk

Fully-loaded cost: $45/hr blended. Expected Sprint outcome: 58–65% reduction.

## PROSPECT GRADING

Grade each prospect A–D for sales qualification. Be honest — this is internal-only, the prospect never sees it.

### Grade A — Strong fit, fast close
All of: revenue $1M+, 3+ clear time sinks, motivated founder/ops lead, realistic timeline, stack is integrable, no legal/compliance blockers. Projected savings justify Growth or Enterprise tier easily.

### Grade B — Good fit, needs qualifying
Revenue $300K–$1M OR 2 clear time sinks OR mild compliance concern. Solid ROI story but may need education on budget or timeline. Worth a focused discovery call.

### Grade C — Borderline, high effort
Revenue under $300K OR only 1 time sink OR stack is too fragmented OR answers are vague. Could convert with the right pitch but deal size may not justify full Sprint. Consider a lighter package.

### Grade D — Poor fit, deprioritize
Revenue under $100K, no clear pain, or significant red flags (legal blockers, unrealistic expectations, no budget signal, or just kicking tires). Not worth investing a full Map Call slot.

## OUTPUT

Return ONLY valid JSON (no markdown fences, no explanation):

{
  "bot_name": "string",
  "bot_handle": "string",
  "persona": "string (1 sentence)",
  "time_sinks": [
    { "label": "string", "hours_per_week": number, "description": "string (specific, sounds like you shadowed their team)" }
  ],
  "opportunity": {
    "total_hours_per_week": number,
    "weekly_cost": number,
    "annual_cost": number,
    "projected_recovery_pct": number,
    "projected_savings_annual": number
  },
  "skills": [
    { "name": "string", "description": "string", "week_built": number, "effort": "S"|"M"|"L", "integration": "string" }
  ],
  "integrations": ["string"],
  "channels": ["string"],
  "sprint_plan": [
    { "week": number, "theme": "string", "deliverables": ["string"] }
  ],
  "metrics": [
    { "label": "string", "baseline": "string", "day30_target": "string" }
  ],
  "pricing": {
    "tier": "Starter"|"Growth"|"Enterprise",
    "annual": number|"Custom",
    "onboarding": number|"Custom",
    "fly_io_monthly": "string",
    "anthropic_monthly": "string"
  },
  "red_flags": ["string"],
  "next_step": "string",
  "grade": "A"|"B"|"C"|"D",
  "grade_summary": "string (2–3 sentences internal analyst note: why this grade, key signals that drove it, what to watch for on the call)"
}`;

async function generateMap(answers) {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const userPrompt = `Generate a custom automation map for this prospect:

Company: ${answers.company}
Industry: ${answers.industry}
Team size: ${answers.team_size}
Annual revenue: ${answers.revenue}
Primary channels: ${[answers.channels].flat().join(', ')}
Platforms: ${[answers.platforms].flat().join(', ')}
OS: ${answers.os}
CRM: ${answers.crm}
Email: ${answers.email_provider}
Existing AI: ${answers.existing_ai}
Top time sinks: ${[answers.time_sinks].flat().join(', ')}
${answers.notes ? `Notes: ${answers.notes}` : ''}

Be specific and concrete. Invent realistic workflow details. Make time sink descriptions sound like you shadowed their team.`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 4096, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userPrompt }] }),
  });

  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const result = await r.json();
  let text = result.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(text);
}

const GRADE_COLORS = { A: '#15803d', B: '#1a56db', C: '#b45309', D: '#dc2626' };
const GRADE_BG     = { A: '#f0fdf4', B: '#eff6ff', C: '#fffbeb', D: '#fef2f2' };

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 3, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests.' });

  if (!ANTHROPIC_KEY) return res.status(503).json({ error: 'Map generation not available.' });

  // Normalize camelCase → snake_case so both questionnaire and direct API callers work
  const raw = req.body || {};
  const body = {
    ...raw,
    time_sinks:     raw.time_sinks     || raw.timeSinks     || [],
    team_size:      raw.team_size      || raw.teamSize       || '',
    email_provider: raw.email_provider || raw.emailProvider  || '',
    existing_ai:    raw.existing_ai    || raw.aiTools        || raw.existingAi || '',
  };

  let { company, name, email, industry, team_size, revenue, channels, platforms, os, crm, email_provider, existing_ai, time_sinks, notes } = body;

  company        = truncate(String(company        || '').trim(), 200);
  name           = truncate(String(name           || '').trim(), 120);
  email          = truncate(String(email          || '').trim(), 254);
  industry       = truncate(String(industry       || '').trim(), 200);
  team_size      = truncate(String(team_size      || '').trim(), 50);
  revenue        = truncate(String(revenue        || '').trim(), 50);
  os             = truncate(String(os             || '').trim(), 50);
  crm            = truncate(String(crm            || '').trim(), 100);
  email_provider = truncate(String(email_provider || '').trim(), 100);
  existing_ai    = truncate(String(existing_ai    || '').trim(), 200);
  notes          = notes ? truncate(String(notes).trim(), 1000) : '';

  if (!isValidEmail(email)) return res.status(400).json({ error: 'Valid email required.' });
  if (!company || !industry || !time_sinks) return res.status(400).json({ error: 'company, industry, and time_sinks are required.' });

  let mapData;
  try {
    mapData = await generateMap({ company, name, email, industry, team_size, revenue, channels, platforms, os, crm, email_provider, existing_ai, time_sinks, notes });
  } catch (err) {
    console.error('Map generation failed:', err.message);
    return res.status(500).json({ error: 'Map generation failed. Please try again.' });
  }

  const grade        = mapData.grade        || 'C';
  const gradeSummary = mapData.grade_summary || '';

  let mapId = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    const baseRow = {
      company, name, email, industry, team_size, revenue,
      channels: [channels].flat().filter(Boolean),
      platforms: [platforms].flat().filter(Boolean),
      os, crm, email_provider, existing_ai,
      time_sinks: [time_sinks].flat().filter(Boolean),
      notes: notes || null,
      map_data: mapData,
      status: 'generated',
    };
    // Try with grade fields first; fall back without them if columns don't exist yet
    let result = await supabaseInsert('automation_maps', { ...baseRow, grade, grade_summary: gradeSummary });
    if (!result.ok) {
      console.warn('Insert with grade failed, retrying without grade fields:', result.status);
      result = await supabaseInsert('automation_maps', baseRow);
    }
    if (result.ok && result.data?.[0]) mapId = result.data[0].id;
  }

  const mapUrl = mapId ? `${SITE_URL}/map/${mapId}` : null;

  if (mapUrl) {
    const firstName = esc(name.split(' ')[0]);
    await sendEmail(email, `Your custom automation map — ${company}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:24px;font-weight:800;color:#0B1220;margin-bottom:4px;">Your map is ready, ${firstName}.</p>
        <p style="color:#5B6272;margin-bottom:28px;font-size:15px;">We built a custom automation map for ${esc(company)} before our call. Review it, then let's talk.</p>
        <div style="background:#F5F8FF;border:1px solid #E6E4DC;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="font-weight:700;font-size:16px;color:#0B1220;margin-bottom:8px;">What's in your map</p>
          <ul style="color:#5B6272;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
            <li>Your top time sinks — quantified in hours and dollars</li>
            <li>Your named AI coworker and what it does on day 1</li>
            <li>Week-by-week 30-day Sprint plan</li>
            <li>Day-30 performance targets</li>
            <li>Recommended plan and investment</li>
          </ul>
        </div>
        <a href="${esc(mapUrl)}" style="display:inline-block;background:#1F4FFF;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;text-decoration:none;">View your automation map →</a>
        <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://www.30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
      </div>
    `);

    const gradeColor = GRADE_COLORS[grade] || '#5B6272';
    const gradeBg    = GRADE_BG[grade]    || '#f9fafb';
    await sendEmail(OWNER_EMAIL, `[${grade}] New map: ${company} (${name}) — ${mapData.pricing?.tier || '?'}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:16px;">New automation map generated</p>
        <div style="background:${gradeBg};border:2px solid ${gradeColor};border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
          <span style="font-size:36px;font-weight:900;color:${gradeColor};line-height:1;">${grade}</span>
          <div>
            <p style="font-weight:700;font-size:14px;color:#0B1220;margin:0 0 4px;">Prospect Grade</p>
            <p style="font-size:13px;color:#5B6272;margin:0;">${esc(gradeSummary)}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:6px 0;color:#5B6272;width:110px;">Company</td><td style="font-weight:600;">${esc(company)}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Name</td><td>${esc(name)}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Industry</td><td>${esc(industry)}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Revenue</td><td>${esc(revenue)}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Tier fit</td><td style="font-weight:700;color:#1F4FFF;">${esc(mapData.pricing?.tier || 'TBD')}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Savings/yr</td><td style="font-weight:700;color:#0B1220;">$${(mapData.opportunity?.projected_savings_annual || 0).toLocaleString()}</td></tr>
          <tr><td style="padding:6px 0;color:#5B6272;">Map link</td><td><a href="${esc(mapUrl)}" style="color:#1F4FFF;">View map →</a></td></tr>
        </table>
        ${mapData.red_flags?.length ? `<p style="margin-top:16px;padding:12px;background:#FFF3CD;border-radius:8px;font-size:13px;color:#856404;"><strong>⚠ Red flags:</strong> ${esc(mapData.red_flags.join('; '))}</p>` : ''}
      </div>
    `);
  }

  return res.status(200).json({ success: true, map_id: mapId, map_url: mapUrl, map: mapData });
}
