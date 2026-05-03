import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { supabaseRest } from "@/lib/supabase";
import { bookingPayloadSchema } from "@/lib/schemas/booking";
import { site } from "@/lib/site";
import {
  esc, isValidEmail, isFuture, isWithinBookingWindow, isBusinessHours,
  truncate, checkRateLimit, getClientIp,
} from "@/lib/validate";
import { isCalendarConfigured, createMeetEvent } from "@/lib/google-calendar";
import {
  wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff,
} from "@/lib/email-design";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { notifyBookingCreated } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/book — create a booking, create Meet event, email guest + owner.
 *
 * Faithful port of legacy api/book.js. Steps:
 *   1. Validate (email, future window, business hours from availability_settings)
 *   2. Insert into bookings (UNIQUE(datetime) catches slot races as 409)
 *   3. Create Google Calendar event w/ Meet link, persist meet_link to row
 *   4. Send "you're booked" email to guest with Meet link + portal link + intake form
 *   5. Send notification email to owner + Slack
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "jon@30dayramp.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "bookings@30dayramp.com";
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

async function sendRaw(to: string, subject: string, html: string): Promise<void> {
  if (!resend) { console.warn("RESEND_API_KEY not set — skipping email to", to); return; }
  try {
    const { error } = await resend.emails.send({
      from: `Ramped AI <${FROM_EMAIL}>`,
      to: [to], subject, html,
      replyTo: site.email,
    });
    if (error) console.error("Resend error for", to, ":", error.message);
  } catch (e) {
    console.error("Resend send failed for", to, ":", (e as Error).message);
  }
}

function formatForTz(isoString: string, tz: string): { dateStr: string; timeStr: string; full: string } {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
  return { dateStr, timeStr, full: `${dateStr} at ${timeStr}` };
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 req/min per IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

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
  const datetime = data.datetime;
  const name = truncate(data.name, 120);
  const email = truncate(data.email, 254);
  const company = data.company ? truncate(data.company, 200) : "";
  const notes = data.notes ? truncate(data.notes, 2000) : "";
  const timezone = data.timezone ? truncate(data.timezone, 64) : "";
  const tier = data.tier ? truncate(data.tier, 32) : "";
  let billing = data.billing ? truncate(data.billing, 16) : "";
  if (billing && billing !== "monthly" && billing !== "annual") billing = "";

  // Validation
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  if (!isFuture(datetime)) return NextResponse.json({ ok: false, error: "Choose a future time (at least 15 min from now)." }, { status: 400 });
  if (!isWithinBookingWindow(datetime, 90)) return NextResponse.json({ ok: false, error: "Please choose a time within the next 90 days." }, { status: 400 });

  // Cross-check against availability_settings (dynamic from DB; fallback to hardcoded)
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const av = await supabaseRest<{
        days_available?: string[]; start_hour: number; end_hour: number;
        blocked_dates?: string[]; timezone?: string;
      }[]>("GET", "/availability_settings?id=eq.1&select=days_available,start_hour,end_hour,slot_duration_min,blocked_dates,timezone");
      if (av.ok && Array.isArray(av.data) && av.data[0]) {
        const a = av.data[0];
        const tz = a.timezone || "America/Chicago";
        const dt = new Date(datetime);
        const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(dt);
        const wd = parts.find((p) => p.type === "weekday")?.value;
        const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
        const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(dt);
        const days = a.days_available || ["Mon", "Tue", "Wed", "Thu", "Fri"];
        const blocked = a.blocked_dates || [];
        if (!days.includes(wd || "")) return NextResponse.json({ ok: false, error: "That day is not available for booking." }, { status: 400 });
        if (hour < a.start_hour || hour >= a.end_hour) {
          const fmt = (h: number) => h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
          return NextResponse.json({ ok: false, error: `Please choose a time between ${fmt(a.start_hour)} and ${fmt(a.end_hour)}.` }, { status: 400 });
        }
        if (blocked.includes(dateStr)) return NextResponse.json({ ok: false, error: "That date is not available for booking." }, { status: 400 });
      } else {
        const bh = isBusinessHours(datetime, "America/Chicago");
        if (!bh.ok) return NextResponse.json({ ok: false, error: bh.reason }, { status: 400 });
      }
    } catch {
      const bh = isBusinessHours(datetime, "America/Chicago");
      if (!bh.ok) return NextResponse.json({ ok: false, error: bh.reason }, { status: 400 });
    }
  } else {
    const bh = isBusinessHours(datetime, "America/Chicago");
    if (!bh.ok) return NextResponse.json({ ok: false, error: bh.reason }, { status: 400 });
  }

  const guestTz = timezone || "America/Chicago";
  const dtGuest = formatForTz(datetime, guestTz);
  const dtHost = formatForTz(datetime, "America/Chicago");

  // Insert booking
  let bookingId: string | null = null;
  if (SUPABASE_URL && SUPABASE_KEY) {
    const insertRes = await supabaseRest<{ id: string }[]>("POST", "/bookings", {
      datetime, name, email,
      company: company || null,
      notes: notes || null,
      timezone: timezone || null,
      tier: tier || null,
      billing: billing || null,
      status: "scheduled",
    });
    if (!insertRes.ok) {
      if (insertRes.status === 409 || insertRes.status === 400) {
        return NextResponse.json({ ok: false, error: "That time slot was just booked. Please choose another." }, { status: 409 });
      }
      console.error("Supabase insert failed:", insertRes.status);
      return NextResponse.json({ ok: false, error: "Failed to create booking. Please try again." }, { status: 500 });
    }
    bookingId = Array.isArray(insertRes.data) && insertRes.data[0]?.id ? insertRes.data[0].id : null;
  }

  const questionnaireUrl = `${SITE_URL}/questionnaire?email=${encodeURIComponent(email)}${bookingId ? `&booking_id=${encodeURIComponent(bookingId)}` : ""}`;

  // Create calendar event + Meet link
  let meetLink = "";
  let gcalEventId = "";
  if (isCalendarConfigured()) {
    try {
      const startIso = new Date(datetime).toISOString();
      const endIso = new Date(new Date(datetime).getTime() + 30 * 60_000).toISOString();
      const ev = await createMeetEvent({
        startIso, endIso,
        summary: `Ramped AI · Discovery call with ${name}${company ? ` (${company})` : ""}`,
        description: `30-minute discovery call.\n\n${notes ? `Guest notes: ${notes}\n\n` : ""}${tier ? `Plan interest: ${tier}\n\n` : ""}Before the call, complete your intake form:\n${questionnaireUrl}\n\nBooked via 30dayramp.com`,
        guestEmail: email, guestName: name,
      });
      if (ev) { meetLink = ev.meetLink || ""; gcalEventId = ev.eventId || ""; }
    } catch (err) {
      console.error("Meet event creation failed:", (err as Error).message);
    }

    if (meetLink && bookingId && SUPABASE_URL && SUPABASE_KEY) {
      try {
        await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
          meet_link: meetLink, gcal_event_id: gcalEventId,
        });
      } catch (err) { console.error("Failed to persist meet_link:", (err as Error).message); }
    }
  }

  // Sign portal token (90-day lifetime)
  let portalUrl = "";
  if (bookingId && isMapTokenConfigured()) {
    try {
      const { exp, t } = signMapToken(bookingId, 60 * 60 * 24 * 90);
      portalUrl = `${SITE_URL}/portal?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
    } catch (err) {
      console.warn("Could not sign portal token:", (err as Error).message);
    }
  }

  // Guest email
  const firstName = esc(name.split(/\s+/)[0]);
  const innerRows =
    emailHero({
      eyebrow: "You're booked",
      headline: `${firstName}, your discovery call is locked in.`,
      sub: `<strong style="color:#0B1220;font-weight:600;">${esc(dtGuest.full)}</strong> · 30 minutes`,
    }) +
    emailBody(`Before we meet, take 3 minutes to fill out the intake form. We use your answers to <strong>build your custom automation roadmap before the call</strong> so we can spend the time on what to ship first, not what to ask.`) +
    emailCtaCard({
      eyebrow: "Step 1 of 1",
      title: "Complete your intake form",
      body: "10 quick questions. About 3 minutes. Saves us 15 minutes on the call.",
      ctaHref: esc(questionnaireUrl),
      ctaLabel: "Fill out the form →",
    }) +
    (meetLink ? emailInfoCard({
      eyebrow: "Your call link",
      title: esc(dtGuest.full),
      body: "A Google Meet invite is also in your calendar.",
      ctaHref: esc(meetLink),
      ctaLabel: "▶ Join Google Meet",
    }) : "") +
    (portalUrl ? emailInfoCard({
      eyebrow: "Your client portal",
      title: "Bookmark this — it's your home base",
      body: "Live status, your roadmap, and (after go-live) the agents running and time saved. Valid for 90 days, renewed automatically.",
      ctaHref: esc(portalUrl),
      ctaLabel: "Open my portal →",
    }) : "") +
    emailSignoff({
      name: "Jon",
      extra: "Questions before the call? Just reply to this email — it goes straight to me.",
    });

  await sendRaw(
    email,
    "You're booked — one quick step before your call",
    wrapEmail({
      subject: "You're booked — one quick step before your call",
      preheader: `Your call: ${dtGuest.full}. 3-minute intake form before we meet.`,
      innerRows, siteUrl: SITE_URL,
    }),
  );

  // Owner notification
  await sendRaw(OWNER_EMAIL, `New booking: ${name} — ${dtHost.full}`, `
    <div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New discovery call booked</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${esc(name)}</td></tr>
        <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
        ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${esc(company)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#5B6272;">Time (Chicago)</td><td style="font-weight:600;color:#0B1220;">${esc(dtHost.full)}</td></tr>
        ${tier ? `<tr><td style="padding:8px 0;color:#5B6272;">Plan interest</td><td style="font-weight:700;color:#1F4FFF;text-transform:capitalize;">${esc(tier)}</td></tr>` : ""}
        ${notes ? `<tr><td style="padding:8px 0;color:#5B6272;vertical-align:top;">Notes</td><td style="color:#0B1220;">${esc(notes)}</td></tr>` : ""}
        ${meetLink ? `<tr><td style="padding:8px 0;color:#5B6272;">Meet</td><td><a href="${esc(meetLink)}" style="color:#1F4FFF;">${esc(meetLink)}</a></td></tr>` : ""}
      </table>
    </div>
  `);

  notifyBookingCreated({
    name, email, company,
    when: dtGuest.full,
    tier: tier || null,
    siteUrl: SITE_URL,
    bookingId: bookingId || undefined,
  }).catch(() => {});

  return NextResponse.json({ ok: true, booking_id: bookingId, meet_link: meetLink || null });
}
