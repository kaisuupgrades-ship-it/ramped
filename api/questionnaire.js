// api/questionnaire.js — Attach questionnaire answers to a booking + grade + generate automation roadmap
// POST /api/questionnaire
//
// Env vars needed:
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key
//   ANTHROPIC_API_KEY    — Claude API key (grading + roadmap generation)
//   RESEND_API_KEY       — Resend key (owner notification email)

import { isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff } from './_lib/email-design.js';
// Single source of truth for questionnaire fields. The frontend renders the
// form from the same module — a field rename can't half-ship.
import { buildPromptContext, validatePayload } from '../lib/questionnaire-schema.js';

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
  if (!ANTHROPIC_KEY) {
    console.warn('[questionnaire] ANTHROPIC_API_KEY not set — skipping analysis');
    return { grade: null, gradeSummary: null, roadmap: null, failure: 'no_key' };
  }

  // The prospect-summary block is built by the centralized schema so the
  // prompt always reflects the same field set the form posted. No more
  // form/prompt drift (audit 2026-05-02).
  const prospectBlock = buildPromptContext(qData, booking);

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
${prospectBlock}

Even if some fields are blank ("—"), do your best with what's available. The prospect may have skipped questions — infer reasonably and note any gaps in grade_summary.

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
      console.error('[questionnaire] Anthropic API non-200:', r.status, errBody.slice(0, 500));
      return { grade: null, gradeSummary: null, roadmap: null, failure: `api_${r.status}` };
    }
    const json = await r.json();
    const raw  = json.content?.[0]?.text || '';
    if (!raw) {
      console.error('[questionnaire] Anthropic returned empty content', { stop_reason: json.stop_reason });
      return { grade: null, gradeSummary: null, roadmap: null, failure: 'empty_response' };
    }
    // Strip markdown code fences if Claude wraps the JSON
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[questionnaire] Anthropic JSON.parse failed:', e.message, '— raw response:', cleaned.slice(0, 800));
      return { grade: null, gradeSummary: null, roadmap: null, failure: 'parse_error' };
    }
    const grade  = String(parsed.grade || '').toUpperCase().charAt(0) || null;
    const roadmap = parsed.roadmap || null;
    if (!roadmap) {
      console.error('[questionnaire] Anthropic returned no roadmap field — keys:', Object.keys(parsed));
      return { grade: null, gradeSummary: null, roadmap: null, failure: 'no_roadmap' };
    }
    return {
      grade: ['A','B','C','D'].includes(grade) ? grade : null,
      gradeSummary: parsed.grade_summary || null,
      roadmap,
      failure: null,
    };
  } catch (e) {
    console.error('[questionnaire] Anthropic call threw:', e.message);
    return { grade: null, gradeSummary: null, roadmap: null, failure: 'exception' };
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
  let { email, tier, booking_id } = body;

  if (!email) return res.status(400).json({ error: 'email is required' });
  email = truncate(String(email).trim(), 254);
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  tier = tier ? truncate(String(tier).trim(), 32) : null;
  // booking_id is preferred — passed by book.html after a successful /api/book.
  // It guarantees the questionnaire attaches to the right booking even if the
  // visitor has multiple pending bookings under the same email.
  booking_id = booking_id ? String(booking_id).trim() : null;
  if (booking_id && !/^[0-9a-f-]{36}$/i.test(booking_id)) booking_id = null;

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

  // Audit HIGH-4 (2026-04-29): booking_id is now REQUIRED. The email-only
  // fallback was an attack vector — anyone could submit a questionnaire for any
  // email and trigger a Claude call + Resend email + grade alert to the owner
  // inbox. Anonymous prospects who want a roadmap without booking should use
  // /api/free-roadmap (M1-4) — that surface is rate-limited harder and writes
  // to a separate `automation_maps` row instead of mutating an existing booking.
  if (!booking_id) {
    return res.status(400).json({
      error: 'booking_id is required. Submit the questionnaire from the booking confirmation page, or use /free-roadmap if you don\'t have a booking yet.',
    });
  }
  let findResult = await supabase(
    'GET',
    `/bookings?id=eq.${encodeURIComponent(booking_id)}&select=id,name,company,notes,tier,email`
  );
  // Defense-in-depth: the email submitted with the questionnaire must match the
  // email on the looked-up booking. Stops a UUID-guessing attacker from forcing
  // questionnaire data onto someone else's booking.
  if (findResult.ok && Array.isArray(findResult.data) && findResult.data.length) {
    const found = findResult.data[0];
    if (found.email && found.email.toLowerCase() !== email.toLowerCase()) {
      console.warn('Booking_id email mismatch — refusing to attach questionnaire', { booking_id, email });
      return res.status(403).json({ error: 'Booking does not match the submitted email.' });
    }
  }

  if (!findResult.ok || !Array.isArray(findResult.data) || !findResult.data.length) {
    console.warn('No booking found for', booking_id ? `id=${booking_id}` : `email=${email}`);
    return res.status(200).json({ success: true, updated: false });
  }

  const booking   = findResult.data[0];
  const bookingId = booking.id;
  const effectiveTier = tier || booking.tier;

  // Analyze: grade + roadmap (single Claude call). The `failure` field tells
  // us why a missing roadmap happened so the fallback path can give the owner
  // a useful alert instead of "something failed".
  const { grade, gradeSummary, roadmap, failure } = await analyzeProspect(
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
    // Sign the roadmap URL with an HMAC token so the link can't be brute-forced
    // and expires after 30 days. See api/_lib/map-token.js.
    let roadmapUrl;
    if (isMapTokenConfigured()) {
      const { exp, t } = signMapToken(bookingId);
      roadmapUrl = `${SITE_URL}/roadmap?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
    } else {
      // If MAP_LINK_SECRET isn't set, omit the link rather than ship an unsigned URL.
      console.warn('MAP_LINK_SECRET not configured — skipping roadmap link in customer email');
      roadmapUrl = '';
    }
    const firstName   = (booking.name || email).split(/\s+/)[0];
    const agentCount  = roadmap.top_agents?.length || 0;

    const clientAgentsHTML = roadmap.top_agents?.map((a, i) =>
      `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin-bottom:10px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td class="eagent-icon-cell" style="width:42px;vertical-align:top;padding-right:14px;">
              <div class="eagent-icon" style="width:32px;height:32px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:32px;">${i + 1}</div>
            </td>
            <td style="vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
                <tr>
                  <td class="eagent-name-cell" style="vertical-align:middle;">
                    <span class="eagent-name" style="font-size:15px;font-weight:700;color:#0B1220;">${esc(a.name)}</span>
                  </td>
                  ${a.channel ? `<td class="eagent-pill-cell" style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:8px;">
                    <span class="eagent-pill" style="display:inline-block;background:#E8F0FE;color:#1F4FFF;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;">${esc(a.channel)}</span>
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

    // Build the agent cards block (kept as a custom inner row since it has rich content)
    const agentsRow = clientAgentsHTML ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 8px;">
      <p style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5B6272;">What we'd build for you</p>
      ${clientAgentsHTML}
    </td></tr>` : '';

    const summaryRow = roadmap.summary ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#EEF3FF;border-radius:12px;border-left:4px solid #1F4FFF;">
        <tr><td class="einfo-pad-in" style="padding:18px 22px;">
          <p style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">Your opportunity</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14.5px;color:#0B1220;line-height:1.65;font-style:italic;">"${esc(roadmap.summary)}"</p>
        </td></tr>
      </table>
    </td></tr>` : '';

    // Three-stat band (agent count, 30 days, $0)
    const statsRow = `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid #E6E4DC;border-radius:12px;background:#FAFAF7;">
        <tr>
          <td class="estat-cell" style="text-align:center;padding:18px 8px;border-right:1px solid #E6E4DC;width:33.33%;">
            <div class="estat-num" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:900;color:#1F4FFF;line-height:1;">${agentCount}</div>
            <div class="estat-lab" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#5B6272;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">AI Agents</div>
          </td>
          <td class="estat-cell" style="text-align:center;padding:18px 8px;border-right:1px solid #E6E4DC;width:33.33%;">
            <div class="estat-num" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:900;color:#1F4FFF;line-height:1;">30</div>
            <div class="estat-lab" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#5B6272;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Day Go-Live</div>
          </td>
          <td class="estat-cell" style="text-align:center;padding:18px 8px;width:33.33%;">
            <div class="estat-num" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:900;color:#0F7A4B;line-height:1;">$0</div>
            <div class="estat-lab" style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;color:#5B6272;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">If We Miss It</div>
          </td>
        </tr>
      </table>
    </td></tr>`;

    // Week 1 focus block (dark navy, accent eyebrow)
    const week1Row = roadmap.week_1_focus ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#0B1220;border-radius:12px;">
        <tr><td class="einfo-pad-in" style="padding:20px 22px;">
          <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">⚡ Where we'd start</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#F9FAFB;line-height:1.65;">${esc(roadmap.week_1_focus)}</p>
        </td></tr>
      </table>
    </td></tr>` : '';

    const innerRows =
      emailHero({
        eyebrow: 'Your roadmap',
        headline: `${esc(firstName)}, your automation roadmap is ready.`,
        sub: 'Based on your answers — we\'ll walk through this together on the call.',
      }) +
      summaryRow +
      statsRow +
      agentsRow +
      week1Row +
      (roadmapUrl ? emailInfoCard({
        eyebrow: 'View online',
        title: 'Open the full roadmap in your browser',
        body: 'Easier to skim, share with your team, or read on a phone.',
        ctaHref: esc(roadmapUrl),
        ctaLabel: 'View roadmap →',
      }) : '') +
      (isMapTokenConfigured() ? (() => {
        try {
          const { exp: pExp, t: pT } = signMapToken(bookingId, 60 * 60 * 24 * 90);
          const portalUrl = `${SITE_URL}/portal?id=${bookingId}&exp=${pExp}&t=${encodeURIComponent(pT)}`;
          return emailInfoCard({
            eyebrow: 'Your client portal',
            title: 'Track the build, see your agents, watch hours saved',
            body: 'Bookmark this link — it\'s your dashboard from kickoff through go-live and beyond. Valid 90 days.',
            ctaHref: esc(portalUrl),
            ctaLabel: 'Open my portal →',
          });
        } catch { return ''; }
      })() : '') +
      emailBody(`This is a starting point — on the call we'll make sure it fits your actual workflow and prioritize what makes the most sense to ship first. No pressure, no pitch.`) +
      emailSignoff({ name: 'Jon', extra: 'Have a question before the call? Just reply.' });

    await sendEmail(email, `Your automation roadmap is ready, ${firstName}`, wrapEmail({
      subject: `Your automation roadmap is ready, ${firstName}`,
      preheader: `${agentCount} AI agents · 30-day go-live · full refund if we miss it.`,
      innerRows,
      siteUrl: SITE_URL,
    }));
  }

  // Silent-failure fallback. If the AI call failed for any reason, the
  // customer used to get nothing — confused why they filled out a form for no
  // result. Now they always get a graceful message + Andrew gets an alert he
  // can manually act on.
  if (!roadmap && RESEND_KEY) {
    const firstName = (booking.name || email).split(/\s+/)[0];
    const fallbackInner =
      emailHero({
        eyebrow: 'Got it',
        headline: `Thanks, ${esc(firstName)}. We've got your prep.`,
        sub: 'Your automation roadmap is being prepared.',
      }) +
      emailBody(`We received your responses. Andrew is personally reviewing what you sent and will get a tailored automation roadmap to your inbox before your call. If you don't see it within 24 hours, just reply to this email and we'll send it manually.`) +
      emailInfoCard({
        eyebrow: 'In the meantime',
        title: 'Have something to share before the call?',
        body: 'A doc, a screenshot, an example email — anything that would help us prep further. Just reply to this thread.',
      }) +
      emailSignoff({ name: 'Jon', extra: 'See you on the call.' });
    await sendEmail(email, `We've got your prep, ${firstName}`, wrapEmail({
      subject: `We've got your prep, ${firstName}`,
      preheader: 'Your automation roadmap is being prepared — arriving before your call.',
      innerRows: fallbackInner,
      siteUrl: SITE_URL,
    }));

    // Internal alert so Andrew/Jon can intervene before the call instead of
    // discovering the gap on the call itself.
    const alertBody =
      `<h2 style="margin:0 0 12px;font-size:18px;color:#0B1220">⚠ Automation map generation failed</h2>` +
      `<p style="margin:0 0 8px"><strong>Customer:</strong> ${esc(booking.name || '—')} (${esc(email)})</p>` +
      `<p style="margin:0 0 8px"><strong>Company:</strong> ${esc(booking.company || '—')}</p>` +
      `<p style="margin:0 0 8px"><strong>Booking ID:</strong> ${esc(bookingId)}</p>` +
      `<p style="margin:0 0 8px"><strong>Failure mode:</strong> <code>${esc(failure || 'unknown')}</code></p>` +
      `<p style="margin:0 0 12px;color:#5B6272">The customer got the graceful fallback email. Build their roadmap manually before the call — questionnaire data is in the bookings.questionnaire JSONB column.</p>` +
      `<p style="margin:0;text-align:center"><a href="https://www.30dayramp.com/admin" style="display:inline-block;padding:10px 22px;background:#1F4FFF;color:#fff;font-weight:700;border-radius:8px;text-decoration:none">Open admin →</a></p>`;
    await sendEmail(OWNER_EMAIL, `[ALERT] Roadmap generation failed for ${booking.company || email}`, alertBody);
  }

  return res.status(200).json({
    success: true,
    updated: true,
    grade: grade || null,
    roadmap_generated: !!roadmap,
    failure: failure || null,
    emails_sent: !!RESEND_KEY,
  });
}


