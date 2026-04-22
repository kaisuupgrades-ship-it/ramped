const RESEND_KEY  = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL  = 'bookings@30dayramp.com';

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) console.error('Resend error:', await r.text());
}

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

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, company } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Save lead to Supabase
  try {
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/leads`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ name, email, company, source: 'landing_page' }),
      }
    );
    if (!response.ok) {
      console.error('Supabase error:', await response.text());
      // Don't block the response — still send the notification email
    }
  } catch (err) {
    console.error('Supabase handler error:', err);
  }

  // Notify owner
  await sendEmail(
    OWNER_EMAIL,
    `New lead: ${name || email}${company ? ` · ${company}` : ''}`,
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New lead from 30dayramp.com</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${name    ? `<tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${name}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${email}" style="color:#1F4FFF;">${email}</a></td></tr>
        ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${company}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#5B6272;">Source</td><td style="color:#5B6272;">Homepage form</td></tr>
      </table>
      <div style="margin-top:24px;">
        <a href="mailto:${email}" style="display:inline-block;padding:10px 20px;background:#0B1220;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Reply to ${name ? name.split(' ')[0] : 'lead'} →</a>
      </div>
    </div>`
  );

  // Send confirmation to the lead
  await sendEmail(
    email,
    'We got your info — talk soon',
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:8px;">Thanks${name ? `, ${name.split(' ')[0]}` : ''}.</p>
      <p style="color:#5B6272;font-size:15px;line-height:1.6;margin-bottom:24px;">We'll follow up within one business day to scope out what AI can do for your business.</p>
      <p style="color:#5B6272;font-size:14px;line-height:1.6;">In the meantime, you can <a href="https://30dayramp.com/book" style="color:#1F4FFF;font-weight:500;">book a free 30-min discovery call</a> directly if you'd rather skip the back-and-forth.</p>
      <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
    </div>`
  );

  return res.status(200).json({ success: true });
}
