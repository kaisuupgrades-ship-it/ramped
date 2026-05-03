import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail, emailShell } from "@/lib/email";
import { bookingPayloadSchema } from "@/lib/schemas/booking";
import { site } from "@/lib/site";

export const runtime = "nodejs";

/**
 * POST /api/book — create a booking row + send confirmation email.
 *
 * The bookings table has a UNIQUE(datetime) constraint server-side, so a race
 * between two browsers picking the same slot is caught here (409 Conflict).
 *
 * NOTE: This is the minimal port. Google Calendar invite generation lives in
 * the legacy /api/book.js until we migrate the OAuth flow.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bookingPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first = Object.values(flat)[0]?.[0];
    return NextResponse.json({ ok: false, error: first ?? "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;

  // Insert
  const insertRes = await supabaseRest<{ id: string }[]>("POST", "/bookings", {
    datetime: data.datetime,
    name: data.name,
    email: data.email,
    company: data.company,
    notes: data.notes ?? "",
    timezone: data.timezone,
    tier: data.tier ?? null,
    billing: data.billing ?? null,
    status: "scheduled",
  });

  if (!insertRes.ok) {
    if (insertRes.status === 409 || insertRes.status === 400) {
      return NextResponse.json(
        { ok: false, error: "That time was just booked. Please pick another slot." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Couldn't save booking. Please try again or email jon@30dayramp.com." },
      { status: 500 },
    );
  }

  const booking_id = Array.isArray(insertRes.data) && insertRes.data[0]?.id ? insertRes.data[0].id : undefined;

  // Confirmation email — fire and forget so the redirect isn't blocked.
  const friendly = new Date(data.datetime).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: data.timezone,
  });

  sendEmail({
    to: data.email,
    subject: `Confirmed: 30-min Ramped AI call · ${friendly}`,
    html: emailShell(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">You're booked, ${data.name.split(" ")[0]}.</h2>
      <p style="margin:0 0 16px">A calendar invite is on its way. We'll meet on Google Meet at <strong style="color:#f4f6fa">${friendly}</strong> (${data.timezone}).</p>
      <p style="margin:0 0 16px"><strong style="color:#f4f6fa">Help us prep.</strong> A 2-minute questionnaire helps Andrew tailor an automation map specific to your business before we hop on:</p>
      <p style="margin:24px 0">
        <a href="${site.tagline ? "https://www.30dayramp.com" : "#"}/questionnaire?booking_id=${booking_id ?? ""}&email=${encodeURIComponent(data.email)}"
           style="display:inline-block;padding:12px 22px;background:linear-gradient(180deg,#fdba74,#fb923c);color:#1a0e05;font-weight:700;text-decoration:none;border-radius:10px">
          Fill out the prep questionnaire →
        </a>
      </p>
      <p style="margin:0;color:#929bab;font-size:13px">If anything changes, just reply to this email.</p>
    `),
  }).catch((e) => console.error("[book] email send failed", e));

  // Light admin notification
  sendEmail({
    to: site.email,
    subject: `New booking: ${data.name} · ${data.company}`,
    html: emailShell(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#f4f6fa">New discovery call booked</h2>
      <p style="margin:0 0 8px"><strong>When:</strong> ${friendly} (${data.timezone})</p>
      <p style="margin:0 0 8px"><strong>Who:</strong> ${data.name} · ${data.email}</p>
      <p style="margin:0 0 8px"><strong>Company:</strong> ${data.company}</p>
      ${data.tier ? `<p style="margin:0 0 8px"><strong>Tier interest:</strong> ${data.tier}${data.billing ? ` · ${data.billing}` : ""}</p>` : ""}
      ${data.notes ? `<p style="margin:0 0 8px"><strong>Notes:</strong></p><blockquote style="margin:0;padding:10px 14px;border-left:2px solid #3b82f6;color:#c8d0dc;font-size:14px">${data.notes.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</blockquote>` : ""}
    `),
  }).catch(() => {});

  return NextResponse.json({ ok: true, booking_id });
}
