import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail } from "@/lib/email";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import {
  wrapEmail, emailHero, emailBody, emailCtaCard, emailSignoff,
} from "@/lib/email-design";
import { esc, isValidEmail, checkRateLimit, getClientIp, truncate } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const PORTAL_TTL_SECONDS = 60 * 60 * 24 * 90;

/**
 * POST /api/portal-magic-link — issue a fresh signed portal link to a booking's
 * email address. Returns { ok: true } regardless of whether the email maps to
 * a booking, so attackers cannot enumerate customers via this endpoint.
 *
 * Rate limited tightly: 3 / minute and 10 / hour per IP.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rlMinute = checkRateLimit(`magic:${ip}:m`, { max: 3, windowMs: 60_000 });
  const rlHour = checkRateLimit(`magic:${ip}:h`, { max: 10, windowMs: 60 * 60_000 });
  if (!rlMinute.ok || !rlHour.ok) {
    return NextResponse.json({ ok: false, error: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = typeof (body as { email?: unknown })?.email === "string" ? (body as { email: string }).email : "";
  const email = truncate(rawEmail, 254).trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email." }, { status: 400 });
  }

  if (!isMapTokenConfigured()) {
    console.error("[portal-magic-link] MAP_LINK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "Portal is temporarily unavailable." }, { status: 503 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error("[portal-magic-link] Supabase not configured");
    return NextResponse.json({ ok: false, error: "Portal is temporarily unavailable." }, { status: 503 });
  }

  type Row = { id: string; name: string | null; email: string | null };
  const lookup = await supabaseRest<Row[]>(
    "GET",
    `/bookings?email=ilike.${encodeURIComponent(email)}&select=id,name,email&order=created_at.desc&limit=1`,
  );

  const row = Array.isArray(lookup.data) && lookup.data.length > 0 ? lookup.data[0] : null;

  if (row?.id) {
    try {
      const { exp, t } = signMapToken(row.id, PORTAL_TTL_SECONDS);
      const portalUrl = `${SITE_URL}/portal?id=${row.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
      const firstName = (row.name || "").split(/\s+/)[0] || "there";
      const html = wrapEmail({
        subject: "Your Ramped AI portal link",
        preheader: "Fresh portal access — valid for 90 days.",
        innerRows:
          emailHero({
            eyebrow: "Client portal",
            headline: `Hi ${esc(firstName)}, your fresh portal link is ready.`,
            sub: "Click the button below to open your portal. The link is valid for 90 days.",
          }) +
          emailBody(
            `<p style="margin:0 0 12px;">You requested a sign-in link to your Ramped AI client portal.</p>
             <p style="margin:0;">If you didn't request this, you can safely ignore this email — no one can access your portal without the link.</p>`,
          ) +
          emailCtaCard({
            eyebrow: "Sign in",
            title: "Open your portal",
            body: "Status, your roadmap, agents, and time saved — all in one place.",
            ctaHref: portalUrl,
            ctaLabel: "Open my portal →",
          }) +
          emailSignoff({ name: "Jon" }),
      });
      await sendEmail({
        to: row.email || email,
        subject: "Your Ramped AI portal link",
        html,
      });
    } catch (err) {
      console.error("[portal-magic-link] send failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ ok: true });
}
