import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { signMapToken, isMapTokenConfigured } from "@/lib/map-token";
import { supabaseRest } from "@/lib/supabase";
import { esc } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/send-followup  body: { bookingId }
 *
 * Sends a post-call follow-up email summarizing the roadmap with a signed link.
 * Idempotent: refuses to send twice (followup_sent_at gate).
 */

const SITE_URL = process.env.SITE_URL || "https://www.30dayramp.com";
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "bookings@30dayramp.com";
const resend = RESEND_KEY ? new Resend(RESEND_KEY) : null;

interface BookingFollowup {
  id: string; name: string | null; email: string; company: string | null;
  datetime: string; timezone: string | null;
  automation_map: {
    summary?: string; recommended_tier?: string; week_1_focus?: string;
    top_agents?: Array<{ name: string; channel?: string; what_it_does?: string; hours_saved?: string }>;
  } | null;
  followup_sent_at: string | null;
}

async function sendRaw(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend || !to) { console.warn("RESEND_KEY not set — skipping followup"); return false; }
  try {
    const { error } = await resend.emails.send({
      from: `Ramped AI <${FROM_EMAIL}>`,
      to: [to], subject, html,
    });
    if (error) { console.error("Resend error:", error.message); return false; }
    return true;
  } catch (e) {
    console.error("Resend send failed:", (e as Error).message);
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { bookingId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bookingId = String(body.bookingId || "");
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const r = await supabaseRest<BookingFollowup[]>("GET",
    `/bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,name,email,company,datetime,timezone,automation_map,followup_sent_at`);
  if (!r.ok) return NextResponse.json({ error: "DB error" }, { status: 500 });
  const b = (Array.isArray(r.data)) ? r.data[0] : null;
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (!b.automation_map) return NextResponse.json({ error: "No roadmap found for this booking — run the questionnaire first." }, { status: 400 });
  if (b.followup_sent_at) return NextResponse.json({ error: "Follow-up already sent", sent_at: b.followup_sent_at }, { status: 409 });
  if (!RESEND_KEY) return NextResponse.json({ error: "Email not configured" }, { status: 503 });

  const roadmap = b.automation_map;
  const firstName = (b.name || b.email).split(/\s+/)[0];

  let roadmapUrl = "";
  if (isMapTokenConfigured()) {
    try {
      const { exp, t } = signMapToken(b.id);
      roadmapUrl = `${SITE_URL}/roadmap?id=${b.id}&exp=${exp}&t=${encodeURIComponent(t)}`;
    } catch { /* keep empty */ }
  }

  const agentCardsHTML = (roadmap.top_agents || []).slice(0, 2).map((a, i) =>
    `<div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:16px 18px;margin-bottom:10px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:40px;vertical-align:top;padding-right:12px;">
            <div style="width:30px;height:30px;border-radius:50%;background:#1F4FFF;color:#fff;font-size:13px;font-weight:800;text-align:center;line-height:30px;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:5px;">
              <tr>
                <td style="vertical-align:middle;"><span style="font-size:14px;font-weight:700;color:#0B1220;">${esc(a.name)}</span></td>
                ${a.channel ? `<td style="text-align:right;vertical-align:middle;white-space:nowrap;padding-left:8px;"><span style="display:inline-block;background:#E8F0FE;color:#1F4FFF;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${esc(a.channel)}</span></td>` : ""}
              </tr>
            </table>
            <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 6px;">${esc(a.what_it_does || "")}</p>
            ${a.hours_saved ? `<span style="display:inline-block;background:#ECFDF5;color:#059669;font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px;">⏱ Saves ${esc(a.hours_saved)}</span>` : ""}
          </td>
        </tr>
      </table>
    </div>`,
  ).join("");

  const tier = (roadmap.recommended_tier || "growth") as string;
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tierColors: Record<string, string> = { starter: "#374151", growth: "#1F4FFF", enterprise: "#7C3AED" };
  const tierBg: Record<string, string> = { starter: "#F3F4F6", growth: "#EEF2FF", enterprise: "#F5F3FF" };
  const tierColor = tierColors[tier] || "#374151";
  const tierBgCol = tierBg[tier] || "#F3F4F6";

  const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3F4F6;">
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:580px;margin:0 auto;">
  <div style="background:#0A2540;padding:32px 32px 28px;">
    <div style="display:inline-block;background:#006BD6;color:#fff;font-size:11px;font-weight:900;letter-spacing:0.08em;padding:4px 10px;border-radius:6px;margin-bottom:14px;">RAMPED AI</div>
    <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;line-height:1.2;">Great talking with you, ${esc(firstName)} 👋</p>
    <p style="margin:0;font-size:14px;color:#9CA3AF;line-height:1.5;">Here's a summary of what we covered and the clearest path forward.</p>
  </div>
  <div style="background:#FAFAFA;padding:28px 32px;">
    ${roadmap.summary ? `<div style="background:#fff;border-left:4px solid #1F4FFF;padding:16px 18px;margin-bottom:24px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">WHAT WE DISCUSSED</p>
      <p style="margin:0;font-size:14px;color:#0B1220;line-height:1.7;">${esc(roadmap.summary)}</p>
    </div>` : ""}
    ${agentCardsHTML ? `<p style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 12px;">Where we'd start</p>${agentCardsHTML}` : ""}
    ${roadmap.week_1_focus ? `<div style="background:#0B1220;border-radius:12px;padding:18px 22px;margin-bottom:24px;margin-top:8px;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#1F4FFF;">⚡ WEEK 1 PRIORITY</p>
      <p style="margin:0;font-size:14px;color:#F9FAFB;line-height:1.7;">${esc(roadmap.week_1_focus)}</p>
    </div>` : ""}
    <div style="background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:20px 22px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#6B7280;">Recommended plan</p>
      <span style="display:inline-block;background:${tierBgCol};color:${tierColor};font-size:16px;font-weight:800;padding:6px 18px;border-radius:8px;margin-bottom:16px;text-transform:capitalize;">${esc(tierLabel)}</span><br>
      ${roadmapUrl ? `<a href="${esc(roadmapUrl)}" style="display:inline-block;background:#1F4FFF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;margin-bottom:12px;">View your full roadmap →</a><br>` : ""}
      <span style="font-size:13px;color:#6B7280;">Or just reply to this email to get started.</span>
    </div>
  </div>
</div></body></html>`;

  const sent = await sendRaw(b.email, `Following up, ${firstName} — your roadmap + next step`, html);
  if (!sent) return NextResponse.json({ error: "Failed to send email — check Resend configuration." }, { status: 500 });

  await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    followup_sent_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, sent_to: b.email });
}
