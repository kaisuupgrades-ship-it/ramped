import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { supabaseRest } from "@/lib/supabase";
import { wrapEmail, emailHero, emailBody, emailInfoCard, emailSignoff } from "@/lib/email-design";
import { esc } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin-tickets[?status=open|replied|closed]  → list tickets w/ messages + booking
 * POST /api/admin-tickets  body: { ticketId, body, closeAfter? }  → admin reply + email
 */

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "support@30dayramp.com";
const BODY_MAX = 8000;
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

interface Ticket { id: string; booking_id: string; subject: string; status: string; created_at: string; last_msg_at: string }
interface Message { id: string; ticket_id: string; sender: string; body: string; created_at: string }
interface Booking { id: string; name: string | null; email: string | null; company: string | null; tier: string | null; status: string | null }

async function sendCustomerEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from: `Ramped AI <${FROM_EMAIL}>`,
      to: [to], subject, html, replyTo: "jon@30dayramp.com",
    });
  } catch (e) { console.warn("customer reply email failed:", (e as Error).message); }
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const statusQ = status ? `&status=eq.${encodeURIComponent(status)}` : "";

  const tr = await supabaseRest<Ticket[]>("GET",
    `/support_tickets?select=id,booking_id,subject,status,created_at,last_msg_at${statusQ}&order=last_msg_at.desc&limit=200`);
  if (!tr.ok) return NextResponse.json({ error: "Database error" }, { status: 500 });
  const tickets = Array.isArray(tr.data) ? tr.data : [];
  if (!tickets.length) return NextResponse.json({ tickets: [] });

  const tFilter = tickets.map((x) => `"${x.id}"`).join(",");
  const bFilter = [...new Set(tickets.map((x) => x.booking_id))].map((x) => `"${x}"`).join(",");

  const [mr, br] = await Promise.all([
    supabaseRest<Message[]>("GET", `/support_messages?ticket_id=in.(${tFilter})&select=id,ticket_id,sender,body,created_at&order=created_at.asc`),
    supabaseRest<Booking[]>("GET", `/bookings?id=in.(${bFilter})&select=id,name,email,company,tier,status`),
  ]);
  const msgs = (mr.ok && Array.isArray(mr.data)) ? mr.data : [];
  const bookings = (br.ok && Array.isArray(br.data)) ? br.data : [];
  const byTicket = msgs.reduce<Record<string, Message[]>>((acc, m) => { (acc[m.ticket_id] ||= []).push(m); return acc; }, {});
  const byBooking = bookings.reduce<Record<string, Booking>>((acc, b) => { acc[b.id] = b; return acc; }, {});

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      ...t,
      booking: byBooking[t.booking_id] || null,
      messages: byTicket[t.id] || [],
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { ticketId?: string; body?: string; closeAfter?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ticketId = String(body.ticketId || "");
  const text = String(body.body || "").trim().slice(0, BODY_MAX);
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return NextResponse.json({ error: "Invalid ticketId" }, { status: 400 });
  if (!text || text.length < 2) return NextResponse.json({ error: "Reply body too short" }, { status: 400 });

  const tr = await supabaseRest<Ticket[]>("GET",
    `/support_tickets?id=eq.${encodeURIComponent(ticketId)}&select=id,booking_id,subject,status`);
  const ticket = (tr.ok && Array.isArray(tr.data)) ? tr.data[0] : null;
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const mr = await supabaseRest("POST", "/support_messages", { ticket_id: ticketId, sender: "admin", body: text });
  if (!mr.ok) return NextResponse.json({ error: "Failed to insert reply" }, { status: 500 });

  if (body.closeAfter) {
    await supabaseRest("PATCH", `/support_tickets?id=eq.${encodeURIComponent(ticketId)}`, { status: "closed" });
  }

  // Lookup customer + sign portal token for email link
  const br = await supabaseRest<{ name: string | null; email: string | null }[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(ticket.booking_id)}&select=name,email`);
  const cust = (br.ok && Array.isArray(br.data)) ? br.data[0] : null;

  let portalUrl: string | null = null;
  if (cust && isMapTokenConfigured()) {
    try {
      const { exp, t } = signMapToken(ticket.booking_id, 60 * 60 * 24 * 90);
      portalUrl = `${SITE_URL}/portal?id=${ticket.booking_id}&exp=${exp}&t=${encodeURIComponent(t)}`;
    } catch { /* ignore */ }
  }

  if (cust?.email) {
    const firstName = (cust.name || "").split(/\s+/)[0] || "there";
    const innerRows =
      emailHero({
        eyebrow: "Reply from Ramped AI",
        headline: `Hi ${esc(firstName)} — Jon got back to you.`,
        sub: `<strong>${esc(ticket.subject)}</strong>`,
      }) +
      emailBody(`<div style="white-space:pre-wrap;font-size:14.5px;line-height:1.7;color:#0B1220;">${esc(text)}</div>`) +
      (portalUrl ? emailInfoCard({
        eyebrow: "Reply in your portal",
        title: "Continue this thread",
        body: "Replying in the portal keeps everything in one place.",
        ctaHref: esc(portalUrl), ctaLabel: "Open my portal →",
      }) : "") +
      emailSignoff({ name: "Jon", extra: "Or just reply to this email — it lands straight in my inbox." });

    sendCustomerEmail(cust.email, `Re: ${ticket.subject}`, wrapEmail({
      subject: `Re: ${ticket.subject}`,
      preheader: text.slice(0, 100),
      innerRows, siteUrl: SITE_URL,
    })).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
