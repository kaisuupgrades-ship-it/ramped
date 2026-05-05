import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { checkPortalToken } from "@/lib/portal-auth";
import { supabaseRest } from "@/lib/supabase";
import { signMapToken } from "@/lib/map-token";
import { wrapEmail, emailHero, emailBody, emailInfoCard, emailSignoff } from "@/lib/email-design";
import { isValidEmail, esc } from "@/lib/validate";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/portal-profile?id&exp&t  → name, email, phone, timezone, prefs
 * POST /api/portal-profile?id&exp&t  → update allowed fields; if email changes,
 *                                       send verification to new + security
 *                                       notice to old.
 */

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "jon@30dayramp.com";
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

const ALLOWED_PREF_KEYS = new Set([
  "email_weekly_digest", "email_ticket_replies", "email_billing",
  "email_agent_drafts", "email_milestones",
]);

interface ProfileRow {
  name: string | null; email: string | null; company: string | null;
  phone?: string | null; timezone: string | null;
  notification_prefs?: Record<string, boolean>; profile_updated_at?: string | null;
}

async function sendRaw(to: string, subject: string, html: string): Promise<void> {
  if (!resend || !to) return;
  try {
    await resend.emails.send({
      from: `Ramped AI <${FROM_EMAIL}>`,
      to: [to], subject, html, replyTo: site.email,
    });
  } catch (e) { console.warn("profile email send failed:", (e as Error).message); }
}

export async function GET(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let r = await supabaseRest<ProfileRow[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company,phone,timezone,notification_prefs,profile_updated_at`);
  if (!r.ok) {
    r = await supabaseRest<ProfileRow[]>("GET",
      `/bookings?id=eq.${encodeURIComponent(id)}&select=name,email,company,timezone`);
  }
  if (!r.ok) return NextResponse.json({ error: "DB error" }, { status: 500 });
  const b = Array.isArray(r.data) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  return NextResponse.json({
    name: b.name, email: b.email, company: b.company,
    phone: b.phone || null, timezone: b.timezone,
    notification_prefs: b.notification_prefs || {},
    profile_updated_at: b.profile_updated_at || null,
  });
}

export async function POST(req: NextRequest) {
  const auth = checkPortalToken(req);
  if (!auth.ok) return auth.res;
  const id = auth.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 200);
  if (typeof body.company === "string") patch.company = body.company.trim().slice(0, 200) || null;
  if (typeof body.phone === "string") patch.phone = body.phone.trim().slice(0, 40) || null;
  if (typeof body.timezone === "string" && /^[A-Za-z_]+\/[A-Za-z_/]+$/.test(body.timezone)) patch.timezone = body.timezone;

  let emailChanged = false;
  let oldEmail: string | null = null;
  if (typeof body.email === "string" && body.email.trim() && isValidEmail(body.email.trim())) {
    const r = await supabaseRest<{ email: string | null; name: string | null }[]>("GET",
      `/bookings?id=eq.${encodeURIComponent(id)}&select=email,name`);
    oldEmail = (r.ok && Array.isArray(r.data) && r.data[0]?.email) ? r.data[0].email : null;
    const newEmail = (body.email as string).trim().toLowerCase();
    if (oldEmail && oldEmail.toLowerCase() !== newEmail) {
      emailChanged = true;
      patch.email = newEmail;
    } else if (!oldEmail) {
      patch.email = newEmail;
    }
  }

  if (body.notification_prefs && typeof body.notification_prefs === "object") {
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(body.notification_prefs as Record<string, unknown>)) {
      if (ALLOWED_PREF_KEYS.has(k) && typeof v === "boolean") clean[k] = v;
    }
    if (Object.keys(clean).length) patch.notification_prefs = clean;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  patch.profile_updated_at = new Date().toISOString();

  const u = await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(id)}`, patch);
  if (!u.ok) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  if (emailChanged && patch.email && oldEmail) {
    try {
      const { exp: ex, t: tk } = signMapToken(id, 60 * 60 * 24 * 90);
      const portalUrl = `${SITE_URL}/portal?id=${id}&exp=${ex}&t=${encodeURIComponent(tk)}`;

      const verifyHtml = wrapEmail({
        subject: "Your Ramped AI portal email was updated",
        preheader: "New portal access link enclosed.",
        innerRows:
          emailHero({ eyebrow: "Email updated", headline: "Welcome to your new portal address.", sub: `From now on, your portal link will be sent to <strong>${esc(patch.email as string)}</strong>.` }) +
          emailBody("Bookmark the link below — it works for 90 days. We refresh it every time we email you.") +
          emailInfoCard({ eyebrow: "Your portal", title: "Open your portal", body: "Pick up where you left off.", ctaHref: esc(portalUrl), ctaLabel: "Open my portal →" }) +
          emailSignoff({ name: "Jon" }),
        siteUrl: SITE_URL,
      });
      await sendRaw(patch.email as string, "Your Ramped AI portal email was updated", verifyHtml);

      const noticeHtml = wrapEmail({
        subject: "Your Ramped AI account email was changed",
        preheader: "If this wasn't you, reply to this email immediately.",
        innerRows:
          emailHero({ eyebrow: "Security notice", headline: "Your portal email was changed.", sub: `Your account email is now <strong>${esc(patch.email as string)}</strong>.` }) +
          emailBody(`If you made this change, no action needed — future emails will go to the new address.<br><br>If you did <strong>not</strong> make this change, reply to this email immediately so we can revert it.`) +
          emailSignoff({ name: "Jon" }),
        siteUrl: SITE_URL,
      });
      await sendRaw(oldEmail, "Your Ramped AI account email was changed", noticeHtml);
    } catch (err) { console.warn("email-change notification failed:", (err as Error).message); }
  }

  return NextResponse.json({ ok: true, emailChanged, fields: Object.keys(patch) });
}
