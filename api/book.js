// api/book.js — Booking API (now with Google Calendar + Meet integration)
// GET  /api/book?date=YYYY-MM-DD  → returns booked slots for that date (Supabase + Google Calendar freebusy)
// POST /api/book                  → creates a booking, creates Meet event, emails guest + owner
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, OWNER_EMAIL
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID (optional)

import { isConfigured as gcalConfigured, getBusyRanges, createMeetEvent } from './_lib/google-calendar.js';
import { esc, isValidEmail, isFuture, isWithinBookingWindow, isBusinessHours, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL   = 'bookings@30dayramp.com';

// Explicit allowlist — regex matching *.vercel.app previously allowed any
// preview deployment from any Vercel account to hit this API.
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

// ── Supabase helper ──────────────────────────────────────────────────────────
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

// ── Resend helper ────────────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) console.error('Resend error:', r.status, await r.text());
}

function formatForTz(isoString, tz) {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString('en-US', {
    timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  });
  return { dateStr, timeStr, full: `${dateStr} at ${timeStr}` };
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: return booked slots for a date ────────────────────────────────────
  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
    }

    // Query window: cover all of the visitor's local day across timezones (±14h).
    const dayStartUtc = new Date(`${date}T00:00:00Z`);
    const dayEndUtc   = new Date(`${date}T23:59:59Z`);
    const winStart    = new Date(dayStartUtc.getTime() - 14 * 3600_000).toISOString();
    const winEnd      = new Date(dayEndUtc.getTime()   + 14 * 3600_000).toISOString();

    const booked = [];

    // Supabase bookings
    if (SUPABASE_URL && SUPABASE_KEY) {
      const { ok, data } = await supabase(
        'GET',
        `/bookings?select=datetime&datetime=gte.${encodeURIComponent(winStart)}&datetime=lte.${encodeURIComponent(winEnd)}&order=datetime`
      );
      if (ok) (data || []).forEach(b => booked.push(b.datetime));
    }

    // Google Calendar busy ranges — treat each range as blocking any slot that starts within it.
    if (gcalConfigured()) {
      try {
        const busy = await getBusyRanges(winStart, winEnd);
        // Convert each busy block's start into the ISO string (book.html tolerates ±60s match)
        busy.forEach(b => booked.push(new Date(b.start).toISOString()));
        // Also include 30-minute grid slots that fall inside each busy range
        busy.forEach(b => {
          const s = new Date(b.start).getTime();
          const e = new Date(b.end).getTime();
          for (let t = s; t < e; t += 30 * 60_000) {
            booked.push(new Date(t).toISOString());
          }
        });
      } catch (err) {
        console.error('Google freebusy failed:', err.message);
      }
    }

    return res.status(200).json({ booked });
  }

  // ── POST: create a booking ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Per-IP rate limit: 5 bookings / minute from the same address.
    const ip = getClientIp(req);
    const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
    if (!rl.ok) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }

    let { datetime, name, email, company, notes, timezone, tier } = req.body || {};

    // Basic presence check
    if (!datetime || !name || !email) {
      return res.status(400).json({ error: 'Your name, email, and a selected time are required.' });
    }

    // Trim & length-cap everything that's going into email/Supabase.
    name     = truncate(String(name).trim(), 120);
    email    = truncate(String(email).trim(), 254);
    company  = company  ? truncate(String(company).trim(),  200)  : '';
    notes    = notes    ? truncate(String(notes).trim(),    2000) : '';
    timezone = timezone ? truncate(String(timezone).trim(), 64)   : '';
    tier     = tier     ? truncate(String(tier).trim(),     32)   : '';

    if (name.length < 2) {
      return res.status(400).json({ error: 'Please enter your name.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!isFuture(datetime, 15 * 60_000)) {
      return res.status(400).json({ error: 'Please choose a time at least 15 minutes in the future.' });
    }

    // Upper bound — bookings >90 days out are almost always abuse / spam.
    if (!isWithinBookingWindow(datetime, 90)) {
      return res.status(400).json({ error: 'Please choose a time within the next 90 days.' });
    }

    // Business-hours backstop. The calendar UI already restricts this, but a
    // direct API call can bypass the UI — reject off-hours here.
    const bh = isBusinessHours(datetime, 'America/Chicago');
    if (!bh.ok) {
      return res.status(400).json({ error: bh.reason });
    }

    const guestTz = timezone || 'America/Chicago';
    const dtGuest = formatForTz(datetime, guestTz);
    const dtHost  = formatForTz(datetime, 'America/Chicago');
    const dtUtc   = new Date(datetime).toUTCString();

    // ── Insert into Supabase (if configured) ───────────────────────────────
    let bookingId = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      const { ok, status, data } = await supabase('POST', '/bookings', {
        datetime,
        name,
        email,
        company:  company  || null,
        notes:    notes    || null,
        timezone: timezone || null,
        tier:     tier     || null,
        status:   'upcoming',
      });
      if (!ok) {
        if (status === 409) {
          return res.status(409).json({ error: 'That time slot was just booked. Please choose another.' });
        }
        console.error('Supabase insert failed:', status);
        return res.status(500).json({ error: 'Failed to create booking. Please try again.' });
      }
      bookingId = Array.isArray(data) && data[0] ? data[0].id : null;
    }

    // ── Create Google Calendar event with Meet link ────────────────────────
    // Note: calendar summary/description are plain text (Google's API handles
    // sanitisation), so we pass raw `name`/`notes` here — HTML escape is only
    // applied to the Resend email templates below.
    let meetLink = '';
    let gcalEventId = '';
    if (gcalConfigured()) {
      try {
        const startIso = new Date(datetime).toISOString();
        const endIso   = new Date(new Date(datetime).getTime() + 30 * 60_000).toISOString();
        const ev = await createMeetEvent({
          startIso, endIso,
          summary: `Ramped AI · Discovery call with ${name}${company ? ` (${company})` : ''}`,
          description:
            `30-minute discovery call.\n\n` +
            (notes ? `Guest notes: ${notes}\n\n` : '') +
            (tier ? `Plan interest: ${tier}\n\n` : '') +
            `Booked via 30dayramp.com`,
          guestEmail: email,
          guestName:  name,
        });
        if (ev) {
          meetLink    = ev.meetLink || '';
          gcalEventId = ev.eventId  || '';
        }
      } catch (err) {
        console.error('Meet event creation failed:', err.message);
      }

      // If we got a meet link + have Supabase, persist it on the booking
      if (meetLink && bookingId && SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ meet_link: meetLink, gcal_event_id: gcalEventId }),
          });
        } catch (err) {
          console.error('Failed to persist meet_link:', err.message);
        }
      }
    }

    // ── Confirmation email to guest ────────────────────────────────────────
    // All user-supplied fields MUST go through esc() before HTML interpolation.
    // meetLink comes from Google's API (safe URL) but still escape it for defence in depth.
    const firstName = (name.split(' ')[0] || name);
    const meetBlock = meetLink
      ? `<p style="font-size:15px;color:#0F7A4B;font-weight:600;margin:12px 0 0;">
           <a href="${esc(meetLink)}" style="color:#1F4FFF;text-decoration:none;">▶ Join Google Meet</a>
         </p>
         <p style="color:#5B6272;font-size:13px;margin-top:4px;word-break:break-all;">${esc(meetLink)}</p>`
      : `<p style="color:#5B6272;font-size:13px;margin-top:8px;">A Google Meet link will be sent separately before your call.</p>`;

    await sendEmail(email, `Confirmed: Discovery call with Ramped AI — ${dtGuest.dateStr}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:24px;font-weight:800;color:#0B1220;margin-bottom:4px;">You're booked. ✓</p>
        <p style="color:#5B6272;margin-bottom:28px;font-size:15px;">We're looking forward to talking with you, ${esc(firstName)}.</p>
        <div style="background:#F5F8FF;border:1px solid #E6E4DC;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="font-weight:700;font-size:16px;color:#0B1220;margin-bottom:4px;">${esc(dtGuest.dateStr)}</p>
          <p style="font-size:15px;color:#1F4FFF;font-weight:600;margin-bottom:8px;">${esc(dtGuest.timeStr)}</p>
          <p style="color:#5B6272;font-size:14px;">30 minutes · Google Meet</p>
          ${meetBlock}
        </div>
        <p style="color:#5B6272;font-size:14px;line-height:1.6;">On the call we'll spend time understanding your business, map out where AI agents can deliver the fastest return, and show you exactly what a 30-day deployment would loo