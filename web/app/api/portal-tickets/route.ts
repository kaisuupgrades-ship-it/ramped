import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";
import { wrapEmail, emailHero, emailBody, emailSignoff } from "@/lib/email-design";
import { notifyTicketCreated } from "@/lib/notify";
import { esc } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/portal-tickets?id&exp&t  → list tickets + nested messages
 * POST /api/portal-tickets?id&exp&t  body: { subject?, body, ticketId? }
 *      Either creates a new ticket or appends a reply to an existing one.
 */

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "jon@30dayramp.com";
const FROM_EMAIL = "support@30dayramp.com";
const SUBJECT_MAX = 140;
const BODY_MAX = 4000;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

interface Ticket { id: string; subject: string; status: string; created_at: string; last_msg_at: string }
interface Message { id: string; ticket_id: string; sender: string; body: string; created_at: string }

async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  if (!resend) return;
  try {
    await resend.emails.send({
      from: `Ramped Support <${FROM_EMAIL}>`,
      to: [OWNER_EMAIL], subject, html,
    });
  } catch (e) { console.warn("owner notify failed:", (e as Error).message); }
}

export async function GET(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  const tr = await supabaseRest<Ticket[]>("GET",
    `/support_tickets?booking_id=eq.${encodeURIComponent(id)}&select=id,subject,status,created_at,last_msg_at&order=last_msg_at.desc`);
  if (!tr.ok) return NextResponse.json({ error: "Database error listing tickets" }, { status: 500 });
  const tickets = Array.isArray(tr.data) ? tr.data : [];
  if (!tickets.length) return NextResponse.json({ tickets: [] });

  const inFilter = tickets.map((x) => `"${x.id}"`).join(",");
  const mr = await supabaseRest<Message[]>("GET",
    `/support_messages?ticket_id=in.(${inFilter})&select=id,ticket_id,sender,body,created_at&order=created_at.asc`);
  const msgs = (mr.ok && Array.isArray(mr.data)) ? mr.data : [];
  const byTicket = msgs.reduce<Record<string, Message[]>>((acc, m) => {
    (acc[m.ticket_id] ||= []).push(m); return acc;
  }, {});

  return NextResponse.json({
    tickets: tickets.map((t) => ({ ...t, messages: byTicket[t.id] || [] })),
  });
}

export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: { subject?: string; body?: string; ticketId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = String(body.body || "").trim().slice(0, BODY_MAX);
  if (!text || text.length < 4) return NextResponse.json({ error: "Message too short" }, { status: 400 });

  let ticketId = body.ticketId && /^[0-9a-f-]{36}$/i.test(body.ticketId) ? body.ticketId : null;
  let subject = String(body.subject || "").trim().slice(0, SUBJECT_MAX) || "Support request";

  if (ticketId) {
    const own = await supabaseRest<{ id: string; subject: string }[]>("GET",
      `/support_tickets?id=eq.${encodeURIComponent(ticketId)}&booking_id=eq.${encodeURIComponent(id)}&select=id,subject`);
    const arr = (own.ok && Array.isArray(own.data)) ? own.data : [];
    if (!arr.length) return NextResponse.json({ error: "Ticket not found for this booking" }, { status: 403 });
    subject = arr[0].subject;
  } else {
    const cr = await supabaseRest<{ id: string }[]>("POST", "/support_tickets", { booking_id: id, subject });
    if (!cr.ok) return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
    ticketId = (Array.isArray(cr.data) && cr.data[0]?.id) || null;
    if (!ticketId) return NextResponse.json({ error: "Ticket created but no id returned" }, { status: 500 });
  }

  const mr = await supabaseRest("POST", "/support_messages", { ticket_id: ticketId, sender: "customer", body: text });
  if (!mr.ok) return NextResponse.json({ error: "Failed to add message" }, { status: 500 });

  // Look up customer for owner notification
  const cust = await supabaseRest<{ name: string | null; email: string | null; company: string | null }[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company`);
  const custRow = (cust.ok && Array.isArray(cust.data)) ? cust.data[0] : null;
  const custName = custRow?.name || custRow?.email || "A customer";

  const innerRows =
    emailHero({
      eyebrow: body.ticketId ? "Ticket reply" : "New ticket",
      headline: `${esc(custName)} ${body.ticketId ? "replied" : "opened a ticket"}.`,
      sub: `<strong>${esc(subject)}</strong>`,
    }) +
    emailBody(`<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;color:#0B1220;background:#F5F5F3;padding:14px 16px;border-radius:8px;margin:0 0 14px;">${esc(text)}</pre><p style="margin:0;font-size:13px;color:#5B6272;"><a href="${SITE_URL}/admin#tickets" style="color:#1F4FFF;font-weight:600;">Open ticket in admin →</a></p>`) +
    emailSignoff({ name: "Ramped Support", extra: `From: ${esc(custRow?.email || "")}${custRow?.company ? " · " + esc(custRow.company) : ""}` });

  sendOwnerEmail(`[Support] ${subject}`, wrapEmail({
    subject: `[Support] ${subject}`,
    preheader: `${custName}: ${text.slice(0, 100)}`,
    innerRows, siteUrl: SITE_URL,
  })).catch(() => {});

  notifyTicketCreated({
    subject, body: text,
    customerName: custRow?.name, customerEmail: custRow?.email,
    ticketId, siteUrl: SITE_URL,
  }).catch(() => {});

  return NextResponse.json({ ticketId }, { status: 201 });
}
