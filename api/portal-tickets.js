// api/portal-tickets.js — Customer support tickets endpoint (portal side).
//   GET  /api/portal-tickets?id=…&exp=…&t=…       → list this customer's tickets + messages
//   POST /api/portal-tickets?id=…&exp=…&t=…       → create a new ticket OR reply to an existing one
//                                                     body: { subject?, body, ticketId? }
//
// Auth: HMAC-signed portal token (same as /api/portal-data).
// Side effects: emails jon@30dayramp.com when a customer creates or replies to a ticket.
//
// Customer can never see ticket data for other bookings — booking_id is enforced via the token.

import { verifyMapToken, isMapTokenConfigured } from './_lib/map-token.js';
import { wrapEmail, emailHero, emailBody, emailSignoff } from './_lib/email-design.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;
const OWNER_EMAIL  = process.env.OWNER_EMAIL || 'jon@30dayramp.com';
const FROM_EMAIL   = 'support@30dayramp.com';
const SITE_URL     = process.env.SITE_URL || 'https://www.30dayramp.com';

const SUBJECT_MAX = 140;
const BODY_MAX    = 4000;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function sendOwnerEmail(subject, html) {
  if (!RESEND_KEY) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Ramped Support <${FROM_EMAIL}>`, to: [OWNER_EMAIL], subject, html }),
    });
  } catch (e) { console.warn('owner notify failed:', e.message); }
}

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id, exp, t } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id))      return res.status(400).json({ error: 'Invalid ID' });
  if (!isMapTokenConfigured())                  return res.status(503).json({ error: 'Token signing not configured' });
  if (!verifyMapToken(id, exp, t))              return res.status(403).json({ error: 'Invalid or expired token' });
  if (!SUPABASE_URL || !SUPABASE_KEY)           return res.status(503).json({ error: 'Database not configured' });

  // ── List tickets ─────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const tr = await fetch(
      `${SUPABASE_URL}/rest/v1/support_tickets?booking_id=eq.${encodeURIComponent(id)}&select=id,subject,status,created_at,last_msg_at&order=last_msg_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!tr.ok) return res.status(500).json({ error: 'Database error listing tickets' });
    const tickets = await tr.json();
    if (!tickets.length) return res.status(200).json({ tickets: [] });

    const ticketIds = tickets.map(x => x.id);
    const inFilter = ticketIds.map(x => `"${x}"`).join(',');
    const mr = await fetch(
      `${SUPABASE_URL}/rest/v1/support_messages?ticket_id=in.(${inFilter})&select=id,ticket_id,sender,body,created_at&order=created_at.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const msgs = mr.ok ? await mr.json() : [];
    const byTicket = msgs.reduce((acc, m) => { (acc[m.ticket_id] ||= []).push(m); return acc; }, {});
    return res.status(200).json({
      tickets: tickets.map(t => ({ ...t, messages: byTicket[t.id] || [] })),
    });
  }

  // ── Create new ticket OR add a reply ─────────────────────────────────────────
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const text = String(body.body || '').trim().slice(0, BODY_MAX);
    if (!text || text.length < 4) return res.status(400).json({ error: 'Message too short' });

    let ticketId = body.ticketId && /^[0-9a-f-]{36}$/i.test(body.ticketId) ? body.ticketId : null;
    let subject  = String(body.subject || '').trim().slice(0, SUBJECT_MAX) || 'Support request';

    // If a ticketId was provided, ensure it belongs to this booking before appending the reply.
    if (ticketId) {
      const own = await fetch(
        `${SUPABASE_URL}/rest/v1/support_tickets?id=eq.${encodeURIComponent(ticketId)}&booking_id=eq.${encodeURIComponent(id)}&select=id,subject`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const arr = own.ok ? await own.json() : [];
      if (!arr.length) return res.status(403).json({ error: 'Ticket not found for this booking' });
      subject = arr[0].subject;
    } else {
      // Create the ticket first
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/support_tickets`, {
        method: 'POST',
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ booking_id: id, subject }),
      });
      if (!cr.ok) return res.status(500).json({ error: 'Failed to create ticket' });
      const created = await cr.json();
      ticketId = created?.[0]?.id;
      if (!ticketId) return res.status(500).json({ error: 'Ticket created but no id returned' });
    }

    // Insert the message (trigger updates ticket.last_msg_at + status)
    const mr = await fetch(`${SUPABASE_URL}/rest/v1/support_messages`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ ticket_id: ticketId, sender: 'customer', body: text }),
    });
    if (!mr.ok) return res.status(500).json({ error: 'Failed to add message' });

    // Look up customer name for the owner email
    const cust = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const custRow = cust.ok ? (await cust.json())?.[0] : null;
    const custName = custRow?.name || custRow?.email || 'A customer';

    // Notify owner
    const innerRows =
      emailHero({
        eyebrow: body.ticketId ? 'Ticket reply' : 'New ticket',
        headline: `${esc(custName)} ${body.ticketId ? 'replied' : 'opened a ticket'}.`,
        sub: `<strong>${esc(subject)}</strong>`,
      }) +
      emailBody(`<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#0B1220;background:#F5F5F3;padding:14px 16px;border-radius:8px;margin:0 0 14px;">${esc(text)}</pre><p style="margin:0;font-size:13px;color:#5B6272;"><a href="${SITE_URL}/admin#tickets" style="color:#1F4FFF;font-weight:600;">Open ticket in admin →</a></p>`) +
      emailSignoff({ name: 'Ramped Support', extra: `From: ${esc(custRow?.email || '')}${custRow?.company ? ' · ' + esc(custRow.company) : ''}` });

    sendOwnerEmail(`[Support] ${subject}`, wrapEmail({
      subject: `[Support] ${subject}`,
      preheader: `${custName}: ${text.slice(0, 100)}`,
      innerRows,
      siteUrl: SITE_URL,
    })).catch(() => {});

    return res.status(201).json({ ticketId });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
