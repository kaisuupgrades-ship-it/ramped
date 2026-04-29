// api/reminders.js — Vercel Cron: send 24h and 1h booking reminders
// Runs every 30 minutes via Vercel Cron (see vercel.json)
// GET /api/reminders
//
// Idempotency (audit H3): each booking carries `reminded_24h_at` and `reminded_1h_at`
// timestamps. The cron filters them out before sending so a booking can never get
// the same reminder twice — even when its time falls into two adjacent ±15 min
// cron windows.

import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff } from './_lib/email-design.js';
import { isCronAuthorized } from './_lib/cron-auth.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = 'bookings@30dayramp.com';
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_KEY not set — skipping reminder to', to); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  const body = await r.text();
  if (!r.ok) console.error('Resend error for', to, ':', r.status, body);
  else console.log('Reminder sent →', to);
}

function formatTime(iso, tz) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  return `${date} at ${time}`;
}

async function fetchBookings(start, end, alreadySentColumn) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  // Skip bookings that already received this reminder stage. PostgREST: `is.null` filter.
  const idempotencyFilter = alreadySentColumn ? `&${alreadySentColumn}=is.null` : '';
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?datetime=gte.${encodeURIComponent(start)}&datetime=lte.${encodeURIComponent(end)}${idempotencyFilter}&select=id,email,name,datetime,timezone,meet_link,reminded_24h_at,reminded_1h_at`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) {
    // Pre-migration fallback: if the reminded_*_at columns don't exist yet,
    // PostgREST returns 400. Retry without the filter and the new columns so
    // the cron keeps working until the migration lands. (Audit H3.)
    if (r.status === 400) {
      console.warn('reminded_*_at columns missing — falling back to non-idempotent fetch. Run db/migrations/002_bookings_constraints.sql ASAP.');
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?datetime=gte.${encodeURIComponent(start)}&datetime=lte.${encodeURIComponent(end)}&select=id,email,name,datetime,timezone,meet_link`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      if (!r2.ok) { console.error('Supabase fetch failed (fallback):', r2.status); return []; }
      return r2.json();
    }
    console.error('Supabase fetch failed:', r.status);
    return [];
  }
  return r.json();
}

async function markReminderSent(bookingId, column) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ [column]: new Date().toISOString() }),
      }
    );
    if (!r.ok && r.status !== 400) {
      // 400 = column doesn't exist yet (pre-migration). Logged in fetchBookings.
      console.error('Failed to mark', column, 'for booking', bookingId, ':', r.status);
    }
  } catch (err) {
    console.error('markReminderSent error:', err.message);
  }
}

function buildSignedRoadmapLink(bookingId) {
  if (!isMapTokenConfigured()) return ''; // omit link rather than ship unsigned
  const { exp, t } = signMapToken(bookingId);
  return `${SITE_URL}/roadmap?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  // Audit C2-1 (2026-04-29): cron endpoint must be auth-gated. Vercel Cron will
  // auto-attach Authorization: Bearer ${CRON_SECRET}. Anything else (manual GET,
  // attacker) gets 401. The reminded_*_at columns prevent duplicate sends, but
  // an unauthenticated trigger still fires *one* off-schedule reminder per
  // booking — that one email is enough to torch sender reputation and customer
  // trust.
  if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const now    = Date.now();
  const WINDOW = 15 * 60 * 1000; // ±15 min — cron runs every 30 min so each booking hits exactly once

  const results = { sent_24h: [], sent_1h: [], errors: [] };

  // ── 24h reminder ──────────────────────────────────────────────────────────
  const bookings24 = await fetchBookings(
    new Date(now + 24 * 3600_000 - WINDOW).toISOString(),
    new Date(now + 24 * 3600_000 + WINDOW).toISOString(),
    'reminded_24h_at'
  );

  for (const b of bookings24) {
    const tz        = b.timezone || 'America/Chicago';
    const timeStr   = formatTime(b.datetime, tz);
    const firstName = esc((b.name || b.email).split(/\s+/)[0]);
    const roadmapLink = buildSignedRoadmapLink(b.id);

    const innerRows24 =
      emailHero({
        eyebrow: 'Tomorrow',
        headline: `See you tomorrow, ${firstName}.`,
        sub: `<strong style="color:#0B1220;font-weight:600;">${esc(timeStr)}</strong> · 30-minute discovery call`,
      }) +
      (b.meet_link
        ? emailInfoCard({
            eyebrow: 'Your call link',
            title: 'Google Meet ready',
            body: 'Join from this link or your calendar invite — both work.',
            ctaHref: esc(b.meet_link),
            ctaLabel: '▶ Join Google Meet',
          })
        : emailInfoCard({
            eyebrow: 'Heads up',
            title: 'Your Google Meet link is coming separately.',
            body: 'It will arrive in your calendar invite before the call.',
          })) +
      emailBody(`We'll walk through your automation roadmap and figure out the highest-impact thing to build first. Come with questions — this is a working session, not a pitch.`) +
      (roadmapLink
        ? emailCtaCard({
            eyebrow: 'Recommended',
            title: 'Skim your roadmap first',
            body: 'Reading it once before the call lets us spend our 30 minutes on what to ship, not what to ask.',
            ctaHref: esc(roadmapLink),
            ctaLabel: 'View your roadmap →',
          })
        : '') +
      emailSignoff({
        name: 'Jon',
        extra: `Need to reschedule? <a href="${esc(SITE_URL)}/book" style="color:#1F4FFF;text-decoration:underline;">Pick a new time →</a>`,
      });

    try {
      await sendEmail(b.email, `Tomorrow: your discovery call with Ramped AI`, wrapEmail({
        subject: 'Tomorrow: your discovery call with Ramped AI',
        preheader: `${timeStr} · 30 minutes · Ramped AI discovery call.`,
        innerRows: innerRows24,
        siteUrl: SITE_URL,
      }));
      results.sent_24h.push(b.email);
      await markReminderSent(b.id, 'reminded_24h_at');
    } catch (err) {
      console.error('24h reminder failed:', b.email, err.message);
      results.errors.push({ email: b.email, type: '24h', error: err.message });
    }
  }

  // ── 1h reminder ───────────────────────────────────────────────────────────
  const bookings1h = await fetchBookings(
    new Date(now + 3600_000 - WINDOW).toISOString(),
    new Date(now + 3600_000 + WINDOW).toISOString(),
    'reminded_1h_at'
  );

  for (const b of bookings1h) {
    const tz        = b.timezone || 'America/Chicago';
    const timeStr   = formatTime(b.datetime, tz);
    const firstName = esc((b.name || b.email).split(/\s+/)[0]);

    const innerRows1h =
      emailHero({
        eyebrow: '1 hour out',
        headline: `${firstName}, we're on in an hour.`,
        sub: `<strong style="color:#0B1220;font-weight:600;">${esc(timeStr)}</strong>`,
      }) +
      (b.meet_link
        ? emailCtaCard({
            eyebrow: 'Call link',
            title: 'Join Google Meet',
            body: 'Or use the link in your calendar invite.',
            ctaHref: esc(b.meet_link),
            ctaLabel: '▶ Join now',
          })
        : '') +
      emailBody(`See you soon. If you haven't skimmed your automation roadmap yet, take 60 seconds — we'll use it as our starting point.`) +
      emailSignoff({ name: 'Jon', extra: 'Questions? Just reply.' });

    try {
      await sendEmail(b.email, `Your call is in 1 hour`, wrapEmail({
        subject: 'Your call is in 1 hour',
        preheader: `${timeStr} · we're on in an hour.`,
        innerRows: innerRows1h,
        siteUrl: SITE_URL,
      }));
      results.sent_1h.push(b.email);
      await markReminderSent(b.id, 'reminded_1h_at');
    } catch (err) {
      console.error('1h reminder failed:', b.email, err.message);
      results.errors.push({ email: b.email, type: '1h', error: err.message });
    }
  }

  console.log('Cron reminders complete:', JSON.stringify(results));
  return res.status(200).json({ ok: true, ...results });
}
