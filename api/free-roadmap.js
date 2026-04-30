// api/free-roadmap.js — anonymous standalone roadmap generator (M1-4 lead magnet).
// POST /api/free-roadmap
//
// Lets a cold visitor get a personalized AI automation roadmap WITHOUT booking.
// Writes the roadmap to a NEW automation_maps row (no booking_id), emails the
// roadmap to the prospect (with a "Book a discovery call →" primary CTA), and
// pings the owner's inbox with the lead grade.
//
// Differs from /api/questionnaire (which is booking-scoped):
//   - No booking_id required
//   - Tighter rate limit (3/hr/IP vs 10/min) — Claude calls cost real money
//   - Result lands in automation_maps + leads, not bookings
//   - Email's primary CTA is the booking link, not a roadmap viewer
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
//               RESEND_API_KEY, MAP_LINK_SECRET (for the signed roadmap link).

import { isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff } from './_lib/email-design.js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OWNER_EMAIL   = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const RESEND_KEY    = process.env.RESEND_API_KEY;
const FROM_EMAIL    = 'bookings@30dayramp.com';
const SITE_URL      = process.env.SITE_URL || 'https://www.30dayramp.com';

const MAX_FIELD = 500;
const MAX_ITEMS = 50;

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

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : (method === 'PATCH' ? 'return=minimal' : ''),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  return { ok: res.ok, status: res.status, data };
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('[free-roadmap] RESEND_API_KEY not set — skipping email to', to); return { ok: false }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) { console.error('[free-roadmap] Resend error:', r.status, await r.text().catch(() => '')); return { ok: false }; }
  return { ok: true };
}

async function analyzeProspect({ name, company, qData, tier }) {
  if (!ANTHROPIC_KEY) return { grade: null, gradeSummary: null, roadmap: null };
  const painText  = (qData.pain_points || []).join(', ') || qData.bottleneck || '—';
  const toolsText = (qData.integrations || qData.tools || []).join(', ') || '—';
  const prompt = `You are an AI automation consultant at Ramped AI. Ramped AI builds done-for-you AI agent implementations for small and mid-size businesses.

Each AI agent we build:
- Lives inside the client's existing tools (Slack, email, CRM, etc.) — no new apps to learn
- Handles repetitive tasks automatically: follow-ups, reporting, scheduling, responses
- Saves the team hours each week by removing manual busywork

Your job: produce a grade + a personalized roadmap for this prospect. They are an ANONYMOUS visitor (haven't booked a call yet) — the goal is a high-quality preview that motivates them to book a discovery call. NEVER mention NanoClaw or any internal platform name.

GRADING CRITERIA: A=Hot · B=Warm · C=Lukewarm · D=Poor fit (revenue, team size, pain clarity).

PROSPECT DATA:
- Name: ${name || '—'}
- Company: ${company || '—'}
- Industry: ${qData.industry || '—'}
- Team size: ${qData.team_size || '—'}
- Annual revenue: ${qData.revenue || '—'}
- Pain points: ${painText}
- Tools: ${toolsText}
- Tier interest: ${tier || '—'}
- Goal: ${qData.automation_goal || '—'}

Respond ONLY with valid JSON:
{
  "grade": "A",
  "grade_summary": "2-3 sentences",
  "roadmap": {
    "summary": "2-3 sentences in business-outcome language",
    "top_agents": [
      { "name": "...", "channel": "...", "what_it_does": "...", "trigger": "...", "integrations": ["..."], "hours_saved": "X-Y hours/week" }
    ],
    "quick_wins": ["...", "...", "..."],
    "week_1_focus": "single most impactful thing to ship first and why",
    "recommended_tier": "starter|growth|enterprise"
  }
}

Rules: 3-5 top_agents, prioritized by pain. Be SPECIFIC with their tools.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) { console.error('[free-roadmap] Claude failed:', r.status); return { grade: null, gradeSummary: null, roadmap: null }; }
    const json = await r.json();
    const raw = json.content?.[0]?.text || '';
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const grade = String(parsed.grade || '').toUpperCase().charAt(0) || null;
    return {
      grade: ['A','B','C','D'].includes(grade) ? grade : null,
      gradeSummary: parsed.grade_summary || null,
      roadmap: parsed.roadmap || null,
    };
  } catch (e) {
    console.error('[free-roadmap] Claude error:', e.message);
    return { grade: null, gradeSummary: null, roadmap: null };
  }
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Tighter rate limit: 3/hr/IP. Each call costs ~$0.05–0.20 in Claude tokens.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return res.status(429).json({ error: "You've requested 3 roadmaps recently. Please wait an hour, or book a discovery call to skip the queue." });

  const body = req.body || {};
  let { name, email, company, tier } = body;
  name    = name    ? truncate(String(name).trim(), 120)    : '';
  email   = email   ? truncate(String(email).trim(), 254)   : '';
  company = company ? truncate(String(company).trim(), 200) : '';
  tier    = tier    ? truncate(String(tier).trim(), 32)     : null;

  if (!name)               return res.status(400).json({ error: 'Name is required.' });
  if (!email)              return res.status(400).json({ error: 'Email is required.' });
  if (!isValidEmail(email))return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!company)            return res.status(400).json({ error: 'Company is required.' });

  const t = (v, max = MAX_FIELD) => v ? truncate(String(v).trim(), max) : null;
  const arr = (v) => {
    if (Array.isArray(v)) return v.slice(0, MAX_ITEMS).map(x => truncate(String(x).trim(), 120)).filter(Boolean);
    if (typeof v === 'string' && v.trim()) return [truncate(v.trim(), 120)];
    return [];
  };
  const qData = {
    pain_points:      arr(body.pain_points),
    automation_goal:  t(body.automation_goal),
    industry:         t(body.industry),
    team_size:        t(body.team_size, 64),
    revenue:          t(body.revenue, 64),
    integrations:     arr(body.integrations || body.tools),
    bottleneck:       t(body.bottleneck),
    tools:            arr(body.tools || body.integrations),
  };

  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Service not configured. Email jon@30dayramp.com.' });
  if (!ANTHROPIC_KEY)                 return res.status(503).json({ error: 'AI not configured. Email jon@30dayramp.com.' });

  // Generate the roadmap via Claude.
  const { grade, gradeSummary, roadmap } = await analyzeProspect({ name, company, qData, tier });
  if (!roadmap) return res.status(502).json({ error: 'Could not generate your roadmap right now. Please try again in a minute, or book a call directly.' });

  // Persist into automation_maps (anonymous — no booking_id). One row per lead.
  const insertResult = await supabase('POST', '/automation_maps', {
    name,
    company,
    industry: qData.industry || null,
    map_data: { roadmap, grade, grade_summary: gradeSummary, qData, source: 'free-roadmap', email, tier },
    status: 'free_lead',
  });
  const mapId = insertResult.ok && insertResult.data?.[0]?.id;

  // Also insert a row into `leads` so the prospect surfaces in admin pipeline.
  await supabase('POST', '/leads', {
    name, email, company,
    source: 'free-roadmap',
  }).catch(() => {});

  // Build the customer roadmap email — primary CTA is the discovery call.
  const firstName  = (name).split(/\s+/)[0];
  const agentCount = roadmap.top_agents?.length || 0;

  const agentRows = (roadmap.top_agents || []).map((a, i) =>
    `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin-bottom:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:42px;vertical-align:top;padding-right:14px;">
            <div style="width:32px;height:32px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:32px;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;">
            <div style="font-size:15px;font-weight:700;color:#0B1220;">${esc(a.name)}${a.channel ? `<span style="font-weight:400;color:#6B7280;font-size:12px;"> · ${esc(a.channel)}</span>` : ''}</div>
            <p style="font-size:13px;color:#374151;line-height:1.6;margin:6px 0 6px;">${esc(a.what_it_does)}</p>
            ${a.hours_saved ? `<span style="display:inline-block;background:#ECFDF5;color:#059669;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;">⏱ Saves ${esc(a.hours_saved)}</span>` : ''}
          </td>
        </tr>
      </table>
    </div>`
  ).join('');

  // Discovery-call CTA URL — the primary close on this email.
  const bookUrl = `${SITE_URL}/book?utm_source=free_roadmap&utm_medium=email&tier=${esc((roadmap.recommended_tier || tier || 'starter').toLowerCase())}`;
  // Optional: include a signed read-only link to the map result if MAP_LINK_SECRET is set.
  let mapUrl = '';
  if (mapId && isMapTokenConfigured()) {
    const { exp, t: token } = signMapToken(mapId);
    mapUrl = `${SITE_URL}/map/${mapId}?exp=${exp}&t=${encodeURIComponent(token)}`;
  }

  const innerRows =
    emailHero({
      eyebrow: 'Your roadmap',
      headline: `${esc(firstName)}, here's your AI automation roadmap.`,
      sub: `Built specifically for ${esc(company)} based on what you told us. ${agentCount} agents, prioritized.`,
    }) +
    (roadmap.summary ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#EEF3FF;border-radius:12px;border-left:4px solid #1F4FFF;">
        <tr><td class="einfo-pad-in" style="padding:18px 22px;">
          <p style="margin:0 0 6px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">Your opportunity</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14.5px;color:#0B1220;line-height:1.65;font-style:italic;">"${esc(roadmap.summary)}"</p>
        </td></tr>
      </table>
    </td></tr>` : '') +
    (agentRows ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 8px;">
      <p style="margin:0 0 14px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#5B6272;">What we'd build for you</p>
      ${agentRows}
    </td></tr>` : '') +
    (roadmap.week_1_focus ? `<tr><td class="ep" style="background:#FFFFFF;padding:0 36px 24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#0B1220;border-radius:12px;">
        <tr><td class="einfo-pad-in" style="padding:20px 22px;">
          <p style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#1F4FFF;">⚡ Where we'd start</p>
          <p style="margin:0;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#F9FAFB;line-height:1.65;">${esc(roadmap.week_1_focus)}</p>
        </td></tr>
      </table>
    </td></tr>` : '') +
    emailCtaCard({
      eyebrow: 'Next step',
      title: 'Book a 30-min discovery call',
      body: 'Free. No commitment. We\'ll walk through this roadmap together and figure out what to ship first. If we don\'t go live in 30 days from kickoff, full refund — no fine print.',
      ctaHref: bookUrl,
      ctaLabel: 'Book a discovery call →',
    }) +
    (mapUrl ? emailInfoCard({
      eyebrow: 'Reference',
      title: 'View this roadmap in your browser',
      body: 'Easier to skim, share, or read on a phone. Link valid 30 days.',
      ctaHref: esc(mapUrl),
      ctaLabel: 'View roadmap →',
    }) : '') +
    emailSignoff({
      name: 'Jon',
      extra: 'Questions? Reply to this email — it lands in my inbox.',
    });

  await sendEmail(email, `Your automation roadmap, ${firstName}`, wrapEmail({
    subject: `Your automation roadmap, ${firstName}`,
    preheader: `${agentCount} AI agents · 30-day go-live guarantee · full refund if we miss.`,
    innerRows,
    siteUrl: SITE_URL,
  }));

  // Owner notification (lighter than the questionnaire flow — no big grade banner).
  if (grade && RESEND_KEY) {
    await sendEmail(OWNER_EMAIL, `[free-roadmap ${grade}] ${name} · ${company}`,
      `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <p style="font-size:18px;font-weight:800;color:#0B1220;margin:0 0 12px;">New free-roadmap lead — Grade ${esc(grade)}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
          <tr><td style="padding:5px 0;color:#5B6272;width:90px;">Name</td><td style="font-weight:600;color:#0B1220;">${esc(name)}</td></tr>
          <tr><td style="padding:5px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${esc(company)}</td></tr>
          <tr><td style="padding:5px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
          <tr><td style="padding:5px 0;color:#5B6272;">Industry</td><td>${esc(qData.industry || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:#5B6272;">Team</td><td>${esc(qData.team_size || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:#5B6272;vertical-align:top;">Pain</td><td style="color:#0B1220;">${esc(qData.pain_points.join(', ') || qData.bottleneck || '—')}</td></tr>
        </table>
        ${gradeSummary ? `<p style="margin:14px 0 0;padding:12px 14px;background:#F5F5F3;border-radius:8px;font-size:13px;color:#0B1220;">${esc(gradeSummary)}</p>` : ''}
        <p style="margin:14px 0 0;font-size:12px;color:#5B6272;">No call booked yet — they'll see the roadmap and decide. Source: free-roadmap landing page.</p>
      </div>`
    );
  }

  return res.status(200).json({
    success: true,
    grade: grade || null,
    map_id: mapId || null,
    book_url: bookUrl,
  });
}
