// api/contact.js — Save lead + send notification emails

import { esc, isValidEmail, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';

const RESEND_KEY  = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL  = 'bookings@30dayramp.com';

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

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!r.ok) console.error('Resend error:', await r.text());
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests.' });

  let { name, email, company } = req.body || {};

  name    = name    ? truncate(String(name).trim(),    120) : '';
  email   = email   ? truncate(String(email).trim(),   254) : '';
  company = company ? truncate(String(company).trim(), 200) : '';

  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email.' });

  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ name, email, company, source: 'landing_page' }),
    });
    if (!r.ok) console.error('Supabase error:', await r.text());
  } catch (err) {
    console.error('Supabase handler error:', err);
  }

  await sendEmail(OWNER_EMAIL, `New lead: ${name || email}${company ? ` · ${company}` : ''}`,
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New lead from 30dayramp.com</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${name    ? `<tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${esc(name)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
        ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${esc(company)}</td></tr>` : ''}
      </table>
    </div>`
  );

  await sendEmail(email, 'We got your info — talk soon',
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:8px;">Thanks${name ? `, ${esc(name.split(' ')[0])}` : ''}.</p>
      <p style="color:#5B6272;font-size:15px;line-height:1.6;margin-bottom:24px;">We'll follow up within one business day to scope out what AI can do for your business.</p>
      <p style="color:#5B6272;font-size:14px;line-height:1.6;">In the meantime, <a href="https://30dayramp.com/book" style="color:#1F4FFF;font-weight:500;">book a free 30-min discovery call</a> if you'd rather skip the back-and-forth.</p>
      <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
    </div>`
  );

  return res.status(200).json({ success: true });
}
