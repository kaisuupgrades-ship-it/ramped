import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { sendEmail, emailShell } from "@/lib/email";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron — every 30 min. Sends 24h and 1h booking reminders.
 *
 * Idempotency (audit H3): each booking carries `reminded_24h_at` /
 * `reminded_1h_at` timestamps. The cron filters them out before sending so a
 * booking can never get the same reminder twice — even when its time falls into
 * two adjacent ±15 min cron windows.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";

interface BookingRow {
  id: string;
  email: string;
  name: string | null;
  datetime: string;
  timezone: string | null;
  meet_link: string | null;
  reminded_24h_at?: string | null;
  reminded_1h_at?: string | null;
}

const esc = (s: string | null | undefined): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function formatTime(iso: string, tz: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });
  return `${date} at ${time}`;
}

async function fetchBookings(start: string, end: string, alreadySentColumn: "reminded_24h_at" | "reminded_1h_at"): Promise<BookingRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const idempotencyFilter = `&${alreadySentColumn}=is.null`;
  const url = `${SUPABASE_URL}/rest/v1/bookings?datetime=gte.${encodeURIComponent(start)}&datetime=lte.${encodeURIComponent(end)}${idempotencyFilter}&select=id,email,name,datetime,timezone,meet_link,reminded_24h_at,reminded_1h_at`;
  const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) {
    if (r.status === 400) {
      // Pre-migration fallback — reminded_*_at columns don't exist yet.
      console.warn("reminded_*_at columns missing — falling back to non-idempotent fetch. Run db/migrations/002_bookings_constraints.sql ASAP.");
      const r2 = await fetch(
        `${SUPABASE_URL}/rest/v1/bookings?datetime=gte.${encodeURIComponent(start)}&datetime=lte.${encodeURIComponent(end)}&select=id,email,name,datetime,timezone,meet_link`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
      );
      if (!r2.ok) { console.error("Supabase fetch failed (fallback):", r2.status); return []; }
      return r2.json();
    }
    console.error("Supabase fetch failed:", r.status);
    return [];
  }
  return r.json();
}

async function markReminderSent(bookingId: string, column: "reminded_24h_at" | "reminded_1h_at"): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ [column]: new Date().toISOString() }),
    });
    if (!r.ok && r.status !== 400) console.error("Failed to mark", column, "for booking", bookingId, ":", r.status);
  } catch (err) {
    console.error("markReminderSent error:", (err as Error).message);
  }
}

function buildSignedRoadmapLink(bookingId: string): string {
  if (!isMapTokenConfigured()) return "";
  try {
    const { exp, t } = signMapToken(bookingId);
    return `${SITE_URL}/roadmap?id=${bookingId}&exp=${exp}&t=${encodeURIComponent(t)}`;
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const WINDOW = 15 * 60 * 1000;
  const results: { sent_24h: string[]; sent_1h: string[]; errors: { email: string; type: string; error: string }[] } = {
    sent_24h: [], sent_1h: [], errors: [],
  };

  // 24h reminder
  const bookings24 = await fetchBookings(
    new Date(now + 24 * 3600_000 - WINDOW).toISOString(),
    new Date(now + 24 * 3600_000 + WINDOW).toISOString(),
    "reminded_24h_at",
  );

  for (const b of bookings24) {
    const tz = b.timezone || "America/Chicago";
    const timeStr = formatTime(b.datetime, tz);
    const firstName = esc((b.name || b.email).split(/\s+/)[0]);
    const roadmapLink = buildSignedRoadmapLink(b.id);

    const html = emailShell(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">See you tomorrow, ${firstName}.</h2>
      <p style="margin:0 0 16px"><strong style="color:#f4f6fa">${esc(timeStr)}</strong> · 30-minute discovery call</p>
      ${b.meet_link
        ? `<p style="margin:0 0 16px"><strong style="color:#f4f6fa">Your call link:</strong> <a href="${esc(b.meet_link)}" style="color:#60a5fa">${esc(b.meet_link)}</a></p>`
        : `<p style="margin:0 0 16px;color:#929bab;font-size:13px">Your Google Meet link will arrive separately in your calendar invite.</p>`
      }
      <p style="margin:0 0 16px">We'll walk through your automation roadmap and figure out the highest-impact thing to build first. Come with questions — this is a working session, not a pitch.</p>
      ${roadmapLink
        ? `<p style="margin:24px 0"><a href="${esc(roadmapLink)}" style="display:inline-block;padding:12px 22px;background:linear-gradient(180deg,#fdba74,#fb923c);color:#1a0e05;font-weight:700;text-decoration:none;border-radius:10px">View your roadmap →</a></p>`
        : ""
      }
      <p style="margin:0;color:#929bab;font-size:13px">Need to reschedule? <a href="${esc(SITE_URL)}/book" style="color:#60a5fa">Pick a new time →</a></p>
    `);

    try {
      const r = await sendEmail({
        to: b.email,
        subject: "Tomorrow: your discovery call with Ramped AI",
        html,
        replyTo: site.email,
      });
      if (r.ok) {
        results.sent_24h.push(b.email);
        await markReminderSent(b.id, "reminded_24h_at");
      } else {
        results.errors.push({ email: b.email, type: "24h", error: r.error ?? "unknown" });
      }
    } catch (err) {
      console.error("24h reminder failed:", b.email, (err as Error).message);
      results.errors.push({ email: b.email, type: "24h", error: (err as Error).message });
    }
  }

  // 1h reminder
  const bookings1h = await fetchBookings(
    new Date(now + 3600_000 - WINDOW).toISOString(),
    new Date(now + 3600_000 + WINDOW).toISOString(),
    "reminded_1h_at",
  );

  for (const b of bookings1h) {
    const tz = b.timezone || "America/Chicago";
    const timeStr = formatTime(b.datetime, tz);
    const firstName = esc((b.name || b.email).split(/\s+/)[0]);

    const html = emailShell(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">${firstName}, we're on in an hour.</h2>
      <p style="margin:0 0 16px"><strong style="color:#f4f6fa">${esc(timeStr)}</strong></p>
      ${b.meet_link
        ? `<p style="margin:24px 0"><a href="${esc(b.meet_link)}" style="display:inline-block;padding:12px 22px;background:linear-gradient(180deg,#fdba74,#fb923c);color:#1a0e05;font-weight:700;text-decoration:none;border-radius:10px">▶ Join Google Meet</a></p>`
        : ""
      }
      <p style="margin:0 0 16px">See you soon. If you haven't skimmed your automation roadmap yet, take 60 seconds — we'll use it as our starting point.</p>
      <p style="margin:0;color:#929bab;font-size:13px">Questions? Just reply.</p>
    `);

    try {
      const r = await sendEmail({
        to: b.email,
        subject: "Your call is in 1 hour",
        html,
        replyTo: site.email,
      });
      if (r.ok) {
        results.sent_1h.push(b.email);
        await markReminderSent(b.id, "reminded_1h_at");
      } else {
        results.errors.push({ email: b.email, type: "1h", error: r.error ?? "unknown" });
      }
    } catch (err) {
      console.error("1h reminder failed:", b.email, (err as Error).message);
      results.errors.push({ email: b.email, type: "1h", error: (err as Error).message });
    }
  }

  console.log("Cron reminders complete:", JSON.stringify(results));
  return NextResponse.json({ ok: true, ...results });
}
