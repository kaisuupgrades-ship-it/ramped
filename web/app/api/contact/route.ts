import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { esc, isValidEmail, truncate, checkRateLimit, getClientIp } from "@/lib/validate";
import { supabaseRest } from "@/lib/supabase";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/contact — landing-page lead form. Insert lead row + send notify
 * email to owner + acknowledgement email to lead.
 */

const RESEND_KEY = process.env.RESEND_API_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL || "jon@30dayramp.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "bookings@30dayramp.com";
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

async function sendRaw(to: string, subject: string, html: string): Promise<void> {
  if (!resend) { console.warn("RESEND_API_KEY not set — skipping email to", to); return; }
  try {
    const { error } = await resend.emails.send({
      from: `Ramped AI <${FROM_EMAIL}>`,
      to: [to], subject, html, replyTo: site.email,
    });
    if (error) console.error("Resend error for", to, ":", error.message);
  } catch (e) {
    console.error("Resend send failed for", to, ":", (e as Error).message);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  let body: { name?: string; email?: string; company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name ? truncate(String(body.name).trim(), 120) : "";
  const email = body.email ? truncate(String(body.email).trim(), 254) : "";
  const company = body.company ? truncate(String(body.company).trim(), 200) : "";

  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });

  // Insert lead — fire and forget on error
  await supabaseRest("POST", "/leads", { name, email, company, source: "landing_page" })
    .catch((err) => console.error("Supabase leads insert error:", err));

  // Owner notification
  await sendRaw(OWNER_EMAIL, `New lead: ${name || email}${company ? ` · ${company}` : ""}`,
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:20px;">New lead from 30dayramp.com</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        ${name ? `<tr><td style="padding:8px 0;color:#5B6272;width:100px;">Name</td><td style="font-weight:600;color:#0B1220;">${esc(name)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#5B6272;">Email</td><td><a href="mailto:${esc(email)}" style="color:#1F4FFF;">${esc(email)}</a></td></tr>
        ${company ? `<tr><td style="padding:8px 0;color:#5B6272;">Company</td><td style="color:#0B1220;">${esc(company)}</td></tr>` : ""}
      </table>
    </div>`,
  );

  // Acknowledgement
  await sendRaw(email, "We got your info — talk soon",
    `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
      <p style="font-size:20px;font-weight:800;color:#0B1220;margin-bottom:8px;">Thanks${name ? `, ${esc(name.split(" ")[0])}` : ""}.</p>
      <p style="color:#5B6272;font-size:15px;line-height:1.6;margin-bottom:24px;">We'll follow up within one business day to scope out what AI can do for your business.</p>
      <p style="color:#5B6272;font-size:14px;line-height:1.6;">In the meantime, <a href="https://30dayramp.com/book" style="color:#1F4FFF;font-weight:500;">book a free 30-min discovery call</a> if you'd rather skip the back-and-forth.</p>
      <p style="margin-top:32px;font-size:13px;color:#5B6272;">— The Ramped AI team<br><a href="https://30dayramp.com" style="color:#1F4FFF;">30dayramp.com</a></p>
    </div>`,
  );

  return NextResponse.json({ success: true });
}
