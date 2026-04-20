// api/book.js — Booking API
// GET  /api/book?date=YYYY-MM-DD  → returns booked slots for that date
// POST /api/book                  → creates a booking
//
// Env vars needed:
//   SUPABASE_URL          — Supabase project URL
//   SUPABASE_SERVICE_KEY  — Supabase service role key
//   RESEND_API_KEY        — Resend API key
//   OWNER_EMAIL           — Where to send booking notifications (e.g. jon@rampedai.co)
//   GOOGLE_CLIENT_ID      — (when ready) Google Calendar OAuth client ID
//   GOOGLE_CLIENT_SECRET  — (when ready) Google Calendar OAuth client secret
//   GOOGLE_REFRESH_TOKEN  — (when ready) Google Calendar refresh token

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL   = 'bookings@30dayramp.com';

// ── Supabase helper ───────────────────────────────────────────────────────────
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

// ── Resend email helper ───────────────────────────────────────────────────────
async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email');
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
}

// ── Format datetime for display ───────────────────────────────────────────────
function formatDateTime(datetime) {
  // datetime is stored as "YYYY-MM-DDTHH:MM:00" in America/Chicago local time
  const [datePart, timePart] = datetime.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  const date = new Date(y, m - 1, d);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const ampm = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 || 12;
  const timeStr = `${hour12}:${String(min).padStart(2, '0')} ${ampm} CST`;
  return { dateStr, timeStr, full: `${dateStr} at ${timeStr}` };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: return booked slots for a date ─────────────────────────────────────
  if (req.method === 'GET') {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
    }

    const { ok, data } = await supabase(
      'GET',
      `/bookings?select=datetime&datetime=gte.${date}T00:00:00&datetime=lte.${date}T23:59:59&order=datetime`
    );

    if (!ok) return res.status(500).json({ error: 'Failed to fetch bookings' });

    const booked = (data || []).map(b => b.datetime);
    return res.status(200).json({ booked });
  }

  // ── POST: create a booking ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { datetime, name, email, company, notes, timezone } = req.body || {};

    if (!datetime || !name || !email) {
      return res.status(400).json({ error: 'datetime, name, and email are required' });
    }

    // Insert into Supabase (unique constraint on datetime prevents double-booking)
    const { ok, status, data } = await supabase('POST', '/bookings', {
      datetime,
      name,
      email,
      company: company || null,
      notes: notes || null,
      timezone: timezone || null,
    });

    if (!ok) {
      if (status === 409) {
        return res.status(409).json({ error: 'That time slot was just booked. Please choose another.' });
      }
      return res.status(500).json({ error: 'Failed to create booking. Please try again.' });
    }

    const dt = formatDateTime(datetime);

    // ── Confirmation email to guest ───────────────────────────────────────────
    await sendEmail(email, `Confirmed: Discovery call with Ramped AI — ${dt.dateStr}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:24px;font-weight:800;color:#0B1220;margin-bottom:4px;">You're booked. ✓</p>
        <p style="color:#5B6272;margin-bottom:28px;font-size:15px;">We're looking forward to talking with you, ${name.split(' ')[0]}.</p>
        <div style="background:#F5F8FF;border:1px solid #E6E4DC;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
          <p style="font-weight:700;font-size:16px;color:#0B1220;margin-bottom:8px;">${dt.full}</p>
          <p style="color:#5B6272;font-size:14px;">30 minutes · Google Meet</p>
          <p style="color:#5B6272;font-size:13px;margin-top:8px;">A Google Meet link will be sent separately before your call.</p>
        </div>
        <p style="color:#5B6272;font-size:14px;line-height:1.6;">On the call we'll spend time understanding your business, map out where AI agents can deliver the fastest return, and show you exactly what a 30-day deployment would look like for you. No sales pressure — just a real conversation.</p>
        <p style="color:#5B6272;font-size:14px;margin-top:16px;">Need to reschedule? Reply to this email and we'll find another time.</p>
        <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
      </div>
    `);

    // ── Notification email to owner ───────────────────────────────────────────
    await sendEmail(OWNER_EMAIL, `New booking: ${name} — ${dt.full}`, `
      <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
        <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New discovery call booked</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${email}" style="color:#1F4FFF;">${email}</a></td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${company}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#5B6272;">Time</td><td style="font-weight:600;color:#0B1220;">${dt.full}</td></tr>
          ${notes ? `<tr><td style="padding:8px 0;color:#5B6272;vertical-align:top;">Notes</td><td style="color:#0B1220;">${notes}</td></tr>` : ''}
          ${timezone ? `<tr><td style="padding:8px 0;color:#5B6272;">Timezone</td><td style="color:#5B6272;">${timezone}</td></tr>` : ''}
        </table>
      </div>
    `);

    // ── Google Calendar (stubbed — add when credentials are ready) ────────────
    // await createCalendarEvent({ datetime, name, email, notes });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
