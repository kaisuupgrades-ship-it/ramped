// api/portal-profile.js — customer profile read/write.
//   GET  /api/portal-profile?id=…&exp=…&t=…   → returns name, email, phone, timezone, notification_prefs
//   POST /api/portal-profile?id=…&exp=…&t=…   → updates allowed fields
//
// Auth: HMAC-signed portal token. Only allowed fields can be written; everything else is ignored.
//
// Email change behavior: we set the new email immediately AND fire a verification email to the
// new address with a fresh signed portal URL. The customer must click that link from the new
// inbox to "confirm" — we don't gate the change on confirmation since the existing token already
// proves they own the booking, but the verification email signals to them it landed.

import { verifyMapToken, isMapTokenConfigured, signMapToken } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailInfoCard, emailSignoff } from './_lib/email-design.js';
import { isValidEmail } from './_lib/validate.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';
const FROM_EMAIL   = 'jon@30dayramp.com';

const ALLOWED_PREF_KEYS = new Set([
  'email_weekly_digest',
  'email_ticket_replies',
  'email_billing',
  'email_agent_drafts',
  'email_milestones',
]);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise(r => {
    let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); req.on('error', () => r({}));
  });
}

async function sendEmail(to, subject, html) {
  if (!RESEND_KEY || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
  } catch (e) { console.warn('profile email send failed:', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))    return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())                return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))            return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)         return res.status(503).json({ error: 'DB not configured' });

  // ── Read ────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // Try full SELECT first; fall back if migration 005 hasn't been run
    let r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company,phone,timezone,notification_prefs,profile_updated_at`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!r.ok) {
      r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company,timezone`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    }
    if (!r.ok) return res.status(500).json({ error: 'DB error' });
    const arr = await r.json();
    const b = arr?.[0];
    if (!b) return res.status(404).json({ error: 'Booking not found' });
    return res.status(200).json({
      name: b.name || null,
      email: b.email || null,
      company: b.company || null,
      phone: b.phone || null,
      timezone: b.timezone || null,
      notification_prefs: b.notification_prefs || {},
      profile_updated_at: b.profile_updated_at || null,
    });
  }

  // ── Write ───────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const patch = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      patch.name = body.name.trim().slice(0, 200);
    }
    if (typeof body.company === 'string') {
      patch.company = body.company.trim().slice(0, 200) || null;
    }
    if (typeof body.phone === 'string') {
      patch.phone = body.phone.trim().slice(0, 40) || null;
    }
    if (typeof body.timezone === 'string' && /^[A-Za-z_]+\/[A-Za-z_/]+$/.test(body.timezone)) {
      patch.timezone = body.timezone;
    }

    let emailChanged = false;
    let oldEmail = null;
    if (typeof body.email === 'string' && body.email.trim() && isValidEmail(body.email.trim())) {
      // Look up old email so we can notify both addresses
      const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=email,name`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      const arr = r.ok ? await r.json() : [];
      oldEmail = arr?.[0]?.email || null;
      if (oldEmail && oldEmail.toLowerCase() !== body.email.trim().toLowerCase()) {
        emailChanged = true;
        patch.email = body.email.trim().toLowerCase();
      } else if (!oldEmail) {
        patch.email = body.email.trim().toLowerCase();
      }
    }

    if (body.notification_prefs && typeof body.notification_prefs === 'object') {
      const clean = {};
      for (const [k, v] of Object.entries(body.notification_prefs)) {
        if (ALLOWED_PREF_KEYS.has(k) && typeof v === 'boolean') clean[k] = v;
      }
      if (Object.keys(clean).length) patch.notification_prefs = clean;
    }

    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    patch.profile_updated_at = new Date().toISOString();

    const u = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!u.ok) {
      const t = await u.text();
      return res.status(500).json({ error: 'Update failed', detail: t.slice(0, 200) });
    }

    // Email-change confirmation: notify both old + new with a fresh portal link
    if (emailChanged && patch.email && oldEmail) {
      try {
        const { exp: ex, t: tk } = signMapToken(id, 60 * 60 * 24 * 90);
        const portalUrl = `${SITE_URL}/portal?id=${id}&exp=${ex}&t=${encodeURIComponent(tk)}`;

        const verifyHtml = wrapEmail({
          subject: 'Your Ramped AI portal email was updated',
          preheader: 'New portal access link enclosed.',
          innerRows:
            emailHero({ eyebrow: 'Email updated', headline: 'Welcome to your new portal address.', sub: `From now on, your portal link will be sent to <strong>${esc(patch.email)}</strong>.` }) +
            emailBody('Bookmark the link below — it works for 90 days. We refresh it every time we email you.') +
            emailInfoCard({ eyebrow: 'Your portal', title: 'Open your portal', body: 'Pick up where you left off.', ctaHref: esc(portalUrl), ctaLabel: 'Open my portal →' }) +
            emailSignoff({ name: 'Jon' }),
          siteUrl: SITE_URL,
        });
        await sendEmail(patch.email, 'Your Ramped AI portal email was updated', verifyHtml);

        // Also notify the OLD address that the email was changed (security signal)
        const noticeHtml = wrapEmail({
          subject: 'Your Ramped AI account email was changed',
          preheader: 'If this wasn\'t you, reply to this email immediately.',
          innerRows:
            emailHero({ eyebrow: 'Security notice', headline: 'Your portal email was changed.', sub: `Your account email is now <strong>${esc(patch.email)}</strong>.` }) +
            emailBody(`If you made this change, no action needed — future emails will go to the new address.<br><br>If you did <strong>not</strong> make this change, reply to this email immediately so we can revert it.`) +
            emailSignoff({ name: 'Jon' }),
          siteUrl: SITE_URL,
        });
        await sendEmail(oldEmail, 'Your Ramped AI account email was changed', noticeHtml);
      } catch (err) {
        console.warn('email-change notification failed:', err.message);
      }
    }

    return res.status(200).json({ ok: true, emailChanged, fields: Object.keys(patch) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
