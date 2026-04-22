// api/book.js — Booking API (now with Google Calendar + Meet integration)
// GET  /api/book?date=YYYY-MM-DD  → returns booked slots for that date (Supabase + Google Calendar freebusy)
// POST /api/book                  → creates a booking, creates Meet event, emails guest + owner
//
// Env vars:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY, OWNER_EMAIL
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID (optional)

import { isConfigured as gcalConfigured, getBusyRanges, createMeetEvent } from './_lib/google-calendar.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL   = 'bookings@30dayramp.com';

const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'http://localhost:3000',
];
function setCors(req, res, methods) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin || 'http://x').hostname)) {
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
    const { datetime, name, email, company, notes, timezone, tier } = req.body || {};

    if (!datetime || !name || !email) {
      return res.status(400).json({ error: 'datetime, name, and email are required' });
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
    const meetBlock = meetLink
      ? `<p style="font-size:15px;color:#0F7A4B;font-weight:600;margin:12px 0 0;">
           <a href="${meetLink}" style="color:#1F4FFF;text-decoration:none;">▶ Join Google Meet</a>
         </p>
         <p style="color:#5B6272;font-size:13px;margin-top:4px;word-break:break-all;">${meetLink}</p>`
      : `<p style="color:#5B6272;font-size:13px;margin-top:8px;">A Google Meet link will be sent separately before your call.</p>`;

    await sendEmail(email, `Confirmed: Discovery call with Ramped AI — ${dtGuest.dateStr}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:24px;font-weight:800;color:#0B1220;margin-bottom:4px;">You're booked. ✓</p>
        <p style="color:#5B6272;margin-bottom:28px;font-size:15px;">We're looking forward to talking with you, ${name.split(' ')[0]}.</p>
        <div style="background:#F5F8FF;border:1px solid #E6E4DC;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="font-weight:700;font-size:16px;color:#0B1220;margin-bottom:4px;">${dtGuest.dateStr}</p>
          <p style="font-size:15px;color:#1F4FFF;font-weight:600;margin-bottom:8px;">${dtGuest.timeStr}</p>
          <p style="color:#5B6272;font-size:14px;">30 minutes · Google Meet</p>
          ${meetBlock}
        </div>
        <p style="color:#5B6272;font-size:14px;line-height:1.6;">On the call we'll spend time understanding your business, map out where AI agents can deliver the fastest return, and show you exactly what a 30-day deployment would look like for you. No sales pressure — just a real conversation.</p>
        <p style="color:#5B6272;font-size:14px;margin-top:16px;">Need to reschedule? Reply to this email and we'll find another time.</p>
        <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://www.30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
      </div>
    `);

    // ── Notification email to owner ────────────────────────────────────────
    await sendEmail(OWNER_EMAIL, `New booking: ${name} — ${dtHost.full}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New discovery call booked</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${email}" style="color:#1F4FFF;">${email}</a></td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${company}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#5B6272;">Time (Chicago)</td><td style="font-weight:600;color:#0B1220;">${dtHost.timeStr} · ${dtHost.dateStr}</td></tr>
          <tr><td style="padding:8px 0;color:#5B6272;">Time (UTC)</td><td style="color:#5B6272;">${dtUtc}</td></tr>
          ${tier ? `<tr><td style="padding:8px 0;color:#5B6272;">Plan interest</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${tier}</td></tr>` : ''}
          ${notes ? `<tr><td style="padding:8px 0;color:#5B6272;vertical-align:top;">Notes</td><td style="color:#0B1220;">${notes}</td></tr>` : ''}
          ${timezone ? `<tr><td style="padding:8px 0;color:#5B6272;">Timezone</td><td style="color:#5B6272;">${timezone}</td></tr>` : ''}
          ${meetLink ? `<tr><td style="padding:8px 0;color:#5B6272;">Meet</td><td><a href="${meetLink}" style="color:#1F4FFF;">${meetLink}</a></td></tr>` : ''}
        </table>
      </div>
    `);

    return res.status(200).json({ success: true, meet_link: meetLink || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
