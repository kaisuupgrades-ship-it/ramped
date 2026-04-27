// api/admin-tickets.js — Admin support inbox.
//   GET  /api/admin-tickets               → list all tickets with messages + booking metadata
//   POST /api/admin-tickets {ticketId, body, status?, closeAfter?}
//                                         → admin reply, optionally close the ticket
//
// Auth: admin bearer token (via api/_lib/admin-auth.js).
// Side effects on POST:
//   - INSERT a support_messages row with sender='admin' (trigger flips ticket.status to 'replied')
//   - send a Resend email to the customer with the admin reply + portal link

import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { signMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailInfoCard, emailSignoff } from './_lib/email-design.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const FROM_EMAIL   = 'support@30dayramp.com';
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

const BODY_MAX = 8000;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function sendCustomerEmail(toEmail, subject, html) {
  if (!RESEND_KEY || !toEmail) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Ramped AI <${FROM_EMAIL}>`, to: [toEmail], reply_to: 'jon@30dayramp.com', subject, html }),
    });
  } catch (e) { console.warn('customer reply email failed:', e.message); }
}

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: 'Database not configured' });

  // ── List inbox ────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const filterStatus = req.query.status; // optional 'open' | 'replied' | 'closed'
    const statusQ = filterStatus ? `&status=eq.${encodeURIComponent(filterStatus)}` : '';
    const tr = await fetch(
      `${SUPABASE_URL}/rest/v1/support_tickets?select=id,booking_id,subject,status,created_at,last_msg_at${statusQ}&order=last_msg_at.desc&limit=200`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!tr.ok) return res.status(500).json({ error: 'Database error' });
    const tickets = await tr.json();
    if (!tickets.length) return res.status(200).json({ tickets: [] });

    // Pull messages + booking lookups in two batched queries
    const ticketIds = tickets.map(x => x.id);
    const bookingIds = [...new Set(tickets.map(x => x.booking_id))];
    const tFilter = ticketIds.map(x => `"${x}"`).join(',');
    const bFilter = bookingIds.map(x => `"${x}"`).join(',');

    const [mr, br] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/support_messages?ticket_id=in.(${tFilter})&select=id,ticket_id,sender,body,created_at&order=created_at.asc`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
      fetch(`${SUPABASE_URL}/rest/v1/bookings?id=in.(${bFilter})&select=id,name,email,company,tier,status`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }),
    ]);
    const msgs = mr.ok ? await mr.json() : [];
    const bookings = br.ok ? await br.json() : [];
    const byTicket = msgs.reduce((acc, m) => { (acc[m.ticket_id] ||= []).push(m); return acc; }, {});
    const byBooking = bookings.reduce((acc, b) => { acc[b.id] = b; return acc; }, {});

    return res.status(200).json({
      tickets: tickets.map(t => ({
        ...t,
        booking: byBooking[t.booking_id] || null,
        messages: byTicket[t.id] || [],
      })),
    });
  }

  // ── Admin reply (and optional close) ─────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const ticketId = String(body.ticketId || '');
    const text = String(body.body || '').trim().slice(0, BODY_MAX);
    const closeAfter = !!body.closeAfter;
    if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return res.status(400).json({ error: 'Invalid ticketId' });
    if (!text || text.length < 2)            return res.status(400).json({ error: 'Reply body too short' });

    // Look up ticket + booking in one go
    const tr = await fetch(
      `${SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}&select=id,booking_id,subject,status`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const tArr = tr.ok ? await tr.json() : [];
    const ticket = tArr[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Insert admin message (trigger marks ticket as 'replied')
    const mr = await fetch(`${SUPABASE_URL}/rest/v1/support_messages`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ticket_id: ticketId, sender: 'admin', body: text }),
    });
    if (!mr.ok) return res.status(500).json({ error: 'Failed to insert reply' });

    // Optionally close the ticket
    if (closeAfter) {
      await fetch(`${SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'closed' }),
      });
    }

    // Look up customer email + sign a fresh portal token for the email link
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(ticket.booking_id)}&select=name,email`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const cust = br.ok ? (await br.json())?.[0] : null;
    let portalUrl = null;
    if (cust && isMapTokenConfigured()) {
      try {
        const { exp, t } = signMapToken(ticket.booking_id, 60 * 60 * 24 * 90);
        portalUrl = `${SITE_URL}/portal?id=${ticket.booking_id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      } catch (_) {}
    }

    if (cust?.email) {
      const firstName = (cust.name || '').split(/\s+/)[0] || 'there';
      const innerRows =
        emailHero({
          eyebrow: 'Reply from Ramped AI',
          headline: `Hi ${esc(firstName)} — Jon got back to you.`,
          sub: `<strong>${esc(ticket.subject)}</strong>`,
        }) +
        emailBody(`<div style="white-space:pre-wrap;font-size:14.5px;line-height:1.7;color:#0B1220;">${esc(text)}</div>`) +
        (portalUrl ? emailInfoCard({
          eyebrow: 'Reply in your portal',
          title: 'Continue this thread',
          body: 'Replying in the portal keeps everything in one place — bookmarkable, no email threading.',
          ctaHref: esc(portalUrl),
          ctaLabel: 'Open my portal →',
        }) : '') +
        emailSignoff({ name: 'Jon', extra: 'Or just reply to this email — it lands straight in my inbox.' });

      sendCustomerEmail(cust.email, `Re: ${ticket.subject}`, wrapEmail({
        subject: `Re: ${ticket.subject}`,
        preheader: text.slice(0, 100),
        innerRows,
        siteUrl: SITE_URL,
      })).catch(() => {});
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
