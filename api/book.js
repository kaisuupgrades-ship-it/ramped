// api/book.js — Booking API (with Google Calendar + Meet integration)
// GET  /api/book?date=YYYY-MM-DD  → returns booked slots for that date
// POST /api/book                  → creates a booking, creates Meet event, emails guest + owner

import { esc, isValidEmail, isFuture, isWithinBookingWindow, isBusinessHours, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';
import { isConfigured as gcalConfigured, getBusyRanges, createMeetEvent } from './_lib/google-calendar.js';
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff, emailSpacer } from './_lib/email-design.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL   = 'bookings@30dayramp.com';
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

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
  const dateStr = d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' });
  return { dateStr, timeStr, full: `${dateStr} at ${timeStr}` };
}

export default async function handler(req, res) {
  setCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Rate limit: 5 req/min per IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests.' });

  // ── GET: return booked slots for a date ──────────────────────────────────
  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
    }

    const dayStartUtc = new Date(`${date}T00:00:00Z`);
    const dayEndUtc   = new Date(`${date}T23:59:59Z`);
    const winStart    = new Date(dayStartUtc.getTime() - 14 * 3600_000).toISOString();
    const winEnd      = new Date(dayEndUtc.getTime()   + 14 * 3600_000).toISOString();

    const booked = [];

    if (SUPABASE_URL && SUPABASE_KEY) {
      const { ok, data } = await supabase('GET',
        `/bookings?select=datetime&datetime=gte.${encodeURIComponent(winStart)}&datetime=lte.${encodeURIComponent(winEnd)}&order=datetime`
      );
      if (ok) (data || []).forEach(b => booked.push(b.datetime));
    }

    if (gcalConfigured()) {
      try {
        const busy = await getBusyRanges(winStart, winEnd);
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

  // ── POST: create a booking ───────────────────────────────────────────────
  if (req.method === 'POST') {
    let { datetime, name, email, company, notes, timezone, tier, billing } = req.body || {};

    name     = truncate(String(name     || '').trim(), 120);
    email    = truncate(String(email    || '').trim(), 254);
    company  = company  ? truncate(String(company).trim(),  200) : '';
    notes    = notes    ? truncate(String(notes).trim(),    2000) : '';
    timezone = timezone ? truncate(String(timezone).trim(), 64)  : '';
    tier     = tier     ? truncate(String(tier).trim(),     32)  : '';
    billing  = billing  ? truncate(String(billing).trim(),  16)  : '';
    if (billing && billing !== 'monthly' && billing !== 'annual') billing = '';

    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
    if (!isFuture(datetime, 15 * 60_000)) return res.status(400).json({ error: 'Choose a future time (at least 15 min from now).' });
    if (!isWithinBookingWindow(datetime, 90)) return res.status(400).json({ error: 'Please choose a time within the next 90 days.' });
    // Check against dynamic availability settings from Supabase (fall back to hardcoded if unavailable)
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const { ok: aOk, data: aData } = await supabase('GET',
          '/availability_settings?id=eq.1&select=days_available,start_hour,end_hour,slot_duration_min,blocked_dates,timezone'
        );
        if (aOk && aData && aData[0]) {
          const av = aData[0];
          const tz = av.timezone || 'America/Chicago';
          const dt = new Date(datetime);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
          }).formatToParts(dt);
          const wd   = parts.find(p => p.type === 'weekday')?.value;
          const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);
          const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(dt);
          const days = av.days_available || ['Mon','Tue','Wed','Thu','Fri'];
          const blocked = av.blocked_dates || [];
          if (!days.includes(wd)) return res.status(400).json({ error: 'That day is not available for booking.' });
          if (hour < av.start_hour || hour >= av.end_hour) {
            const fmt = h => h === 0 ? '12am' : h < 12 ? h+'am' : h === 12 ? '12pm' : (h-12)+'pm';
            return res.status(400).json({ error: `Please choose a time between ${fmt(av.start_hour)} and ${fmt(av.end_hour)}.` });
          }
          if (blocked.includes(dateStr)) return res.status(400).json({ error: 'That date is not available for booking.' });
        } else {
          const bh = isBusinessHours(datetime, 'America/Chicago');
          if (!bh.ok) return res.status(400).json({ error: bh.reason });
        }
      } catch(e) {
        const bh = isBusinessHours(datetime, 'America/Chicago');
        if (!bh.ok) return res.status(400).json({ error: bh.reason });
      }
    } else {
      const bh = isBusinessHours(datetime, 'America/Chicago');
      if (!bh.ok) return res.status(400).json({ error: bh.reason });
    }

    if (!datetime || !name || !email) {
      return res.status(400).json({ error: 'datetime, name, and email are required' });
    }

    const guestTz = timezone || 'America/Chicago';
    const dtGuest = formatForTz(datetime, guestTz);
    const dtHost  = formatForTz(datetime, 'America/Chicago');

    let bookingId = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
      const { ok, status, data } = await supabase('POST', '/bookings', {
        datetime, name, email,
        company:  company  || null,
        notes:    notes    || null,
        timezone: timezone || null,
        tier:     tier     || null,
        status:   'new',
      });
      if (!ok) {
        if (status === 409) return res.status(409).json({ error: 'That time slot was just booked. Please choose another.' });
        console.error('Supabase insert failed:', status);
        return res.status(500).json({ error: 'Failed to create booking. Please try again.' });
      }
      bookingId = Array.isArray(data) && data[0] ? data[0].id : null;
    }

    // Include booking_id so the standalone /questionnaire page can attach to the
    // right booking unambiguously (audit C2 — no more "most recent by email" guessing).
    const questionnaireUrl = `${SITE_URL}/questionnaire?email=${encodeURIComponent(email)}${bookingId ? `&booking_id=${encodeURIComponent(bookingId)}` : ''}`;

    let meetLink = '';
    let gcalEventId = '';
    if (gcalConfigured()) {
      try {
        const startIso = new Date(datetime).toISOString();
        const endIso   = new Date(new Date(datetime).getTime() + 30 * 60_000).toISOString();
        const ev = await createMeetEvent({
          startIso, endIso,
          summary: `Ramped AI · Discovery call with ${name}${company ? ` (${company})` : ''}`,
          description: `30-minute discovery call.\n\n${notes ? `Guest notes: ${notes}\n\n` : ''}${tier ? `Plan interest: ${tier}\n\n` : ''}Before the call, complete your intake form:\n${questionnaireUrl}\n\nBooked via 30dayramp.com`,
          guestEmail: email,
          guestName:  name,
        });
        if (ev) { meetLink = ev.meetLink || ''; gcalEventId = ev.eventId || ''; }
      } catch (err) {
        console.error('Meet event creation failed:', err.message);
      }

      if (meetLink && bookingId && SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ meet_link: meetLink, gcal_event_id: gcalEventId }),
          });
        } catch (err) { console.error('Failed to persist meet_link:', err.message); }
      }
    }

    // ── Prepare-for-your-call email → guest ──────────────────────────────
    const firstName = esc(name.split(/\s+/)[0]);
    // Mint a 90-day signed portal URL so the customer can bookmark it.
    let portalUrl = '';
    if (bookingId && isMapTokenConfigured()) {
      try {
        const { exp, t } = signMapToken(bookingId, 60 * 60 * 24 * 90);
        portalUrl = `${SITE_URL}/portal?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch (err) {
        console.warn('Could not sign portal token:', err.message);
      }
    }
    const innerRows =
      emailHero({
        eyebrow: 'You\'re booked',
        headline: `${firstName}, your discovery call is locked in.`,
        sub: `<strong style="color:#0B1220;font-weight:600;">${esc(dtGuest.full)}</strong> · 30 minutes`,
      }) +
      emailBody(`Before we meet, take 3 minutes to fill out the intake form. We use your answers to <strong>build your custom automation roadmap before the call</strong> so we can spend the time on what to ship first, not what to ask.`) +
      emailCtaCard({
        eyebrow: 'Step 1 of 1',
        title: 'Complete your intake form',
        body: '10 quick questions. About 3 minutes. Saves us 15 minutes on the call.',
        ctaHref: esc(questionnaireUrl),
        ctaLabel: 'Fill out the form →',
      }) +
      (meetLink ? emailInfoCard({
        eyebrow: 'Your call link',
        title: esc(dtGuest.full),
        body: 'A Google Meet invite is also in your calendar.',
        ctaHref: esc(meetLink),
        ctaLabel: '▶ Join Google Meet',
      }) : '') +
      (portalUrl ? emailInfoCard({
        eyebrow: 'Your client portal',
        title: 'Bookmark this — it\'s your home base',
        body: 'Live status, your roadmap, and (after go-live) the agents running and time saved. Valid for 90 days, renewed automatically.',
        ctaHref: esc(portalUrl),
        ctaLabel: 'Open my portal →',
      }) : '') +
      emailSignoff({
        name: 'Jon',
        extra: 'Questions before the call? Just reply to this email — it goes straight to me.',
      });
    await sendEmail(email, `You're booked — one quick step before your call`, wrapEmail({
      subject: 'You\'re booked — one quick step before your call',
      preheader: `Your call: ${dtGuest.full}. 3-minute intake form before we meet.`,
      innerRows,
      siteUrl: SITE_URL,
    }));

    // ── Owner notification ───────────────────────────────────────────────────
    await sendEmail(OWNER_EMAIL, `New booking: ${name} — ${dtHost.full}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New discovery call booked</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${esc(name)}</td></tr>
          <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${esc(company)}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#5B6272;">Time (Chicago)</td><td style="font-weight:600;color:#0B1220;">${esc(dtHost.full)}</td></tr>
          ${tier ? `<tr><td style="padding:8px 0;color:#5B6272;">Plan interest</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${esc(tier)}</td></tr>` : ''}
          ${notes ? `<tr><td style="padding:8px 0;color:#5B6272;vertical-align:top;">Notes</td><td style="color:#0B1220;">${esc(notes)}</td></tr>` : ''}
          ${meetLink ? `<tr><td style="padding:8px 0;color:#5B6272;">Meet</td><td><a href="${esc(meetLink)}" style="color:#1F4FFF;">${esc(meetLink)}</a></td></tr>` : ''}
        </table>
      </div>
    `);

    return res.status(200).json({ success: true, booking_id: bookingId || null, meet_link: meetLink || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
