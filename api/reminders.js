// api/reminders.js — Vercel Cron: send 24h and 1h booking reminders
// Runs every 30 minutes via Vercel Cron (see vercel.json)
// GET /api/reminders

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

async function fetchBookings(start, end) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?datetime=gte.${encodeURIComponent(start)}&datetime=lte.${encodeURIComponent(end)}&select=id,email,name,datetime,timezone,meet_link`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) { console.error('Supabase fetch failed:', r.status); return []; }
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const now    = Date.now();
  const WINDOW = 15 * 60 * 1000; // ±15 min — cron runs every 30 min so each booking hits exactly once

  const results = { sent_24h: [], sent_1h: [], errors: [] };

  // ── 24h reminder ──────────────────────────────────────────────────────────
  const bookings24 = await fetchBookings(
    new Date(now + 24 * 3600_000 - WINDOW).toISOString(),
    new Date(now + 24 * 3600_000 + WINDOW).toISOString()
  );

  for (const b of bookings24) {
    const tz        = b.timezone || 'America/Chicago';
    const timeStr   = formatTime(b.datetime, tz);
    const firstName = (b.name || b.email).split(/\s+/)[0];
    const meetBlock = b.meet_link
      ? `<a href="${esc(b.meet_link)}" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px;margin-top:12px;">▶ Join Google Meet</a>
         <p style="font-size:12px;color:#6B7280;margin:6px 0 0;word-break:break-all;">${esc(b.meet_link)}</p>`
      : `<p style="font-size:13px;color:#6B7280;margin:10px 0 0;">A Google Meet link will be sent before your call.</p>`;
    const roadmapLink = `${SITE_URL}/roadmap?id=${b.id}`;

    try {
      await sendEmail(b.email, `Tomorrow: your discovery call with Ramped AI`, `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;">
  <div style="background:#0B1220;padding:24px 28px;">
    <div style="display:inline-block;background:#1F4FFF;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;margin-bottom:12px;">RAMPED AI</div>
    <p style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.2;">See you tomorrow, ${esc(firstName)} 👋</p>
  </div>
  <div style="background:#FAFAFA;padding:24px 28px;">
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">YOUR CALL</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#0B1220;">${esc(timeStr)}</p>
      <p style="margin:6px 0 12px;font-size:13px;color:#374151;">30-minute discovery call · Ramped AI</p>
      ${meetBlock}
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">We'll walk through your automation roadmap and figure out the highest-impact thing to build first. Come with questions — this is a working session.</p>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">📋 <a href="${esc(roadmapLink)}" style="color:#1F4FFF;font-weight:600;">View your roadmap before the call →</a></p>
    <p style="font-size:13px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:16px;margin:0;">Need to reschedule? <a href="${esc(SITE_URL)}/book" style="color:#1F4FFF;">Pick a new time →</a><br><strong style="color:#0B1220;">Jon</strong> · Ramped AI · <a href="mailto:jon@30dayramp.com" style="color:#1F4FFF;">jon@30dayramp.com</a></p>
  </div>
  <div style="padding:12px 28px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">Ramped AI · 30dayramp.com</p>
  </div>
</div>
</body>
</html>`);
      results.sent_24h.push(b.email);
    } catch (err) {
      console.error('24h reminder failed:', b.email, err.message);
      results.errors.push({ email: b.email, type: '24h', error: err.message });
    }
  }

  // ── 1h reminder ───────────────────────────────────────────────────────────
  const bookings1h = await fetchBookings(
    new Date(now + 3600_000 - WINDOW).toISOString(),
    new Date(now + 3600_000 + WINDOW).toISOString()
  );

  for (const b of bookings1h) {
    const tz        = b.timezone || 'America/Chicago';
    const timeStr   = formatTime(b.datetime, tz);
    const firstName = (b.name || b.email).split(/\s+/)[0];
    const meetBlock = b.meet_link
      ? `<a href="${esc(b.meet_link)}" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px;margin-top:10px;">▶ Join Google Meet now</a>
         <p style="font-size:12px;color:#6B7280;margin:6px 0 0;word-break:break-all;">${esc(b.meet_link)}</p>`
      : '';

    try {
      await sendEmail(b.email, `Your call is in 1 hour ⏰`, `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;">
  <div style="background:#0B1220;padding:24px 28px;">
    <div style="display:inline-block;background:#1F4FFF;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;margin-bottom:12px;">RAMPED AI</div>
    <p style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.2;">1 hour, ${esc(firstName)} ⏰</p>
  </div>
  <div style="background:#FAFAFA;padding:24px 28px;">
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:18px 20px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">TODAY AT</p>
      <p style="margin:0;font-size:20px;font-weight:800;color:#0B1220;">${esc(timeStr)}</p>
      ${meetBlock}
    </div>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px;">We're on in an hour. If you haven't reviewed your automation roadmap yet, take a quick look — we'll use it as our starting point.</p>
    <p style="font-size:13px;color:#6B7280;border-top:1px solid #E5E7EB;padding-top:16px;margin:0;">Questions? Just reply.<br><strong style="color:#0B1220;">Jon</strong> · Ramped AI</p>
  </div>
</div>
</body>
</html>`);
      results.sent_1h.push(b.email);
    } catch (err) {
      console.error('1h reminder failed:', b.email, err.message);
      results.errors.push({ email: b.email, type: '1h', error: err.message });
    }
  }

  console.log('Cron reminders complete:', JSON.stringify(results));
  return res.status(200).json({ ok: true, ...results });
}
