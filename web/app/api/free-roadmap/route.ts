import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail, emailShell } from "@/lib/email";
import { freeRoadmapPayloadSchema } from "@/lib/schemas/free-roadmap";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/free-roadmap — anonymous lead-magnet flow.
 *
 * Writes the lead to the `leads` table, sends an internal alert to Andrew so
 * he can manually generate + send the roadmap (the Anthropic auto-generation
 * port is deferred — for now, the customer is told it'll arrive within 24
 * hours and Andrew handles it via the legacy /api/free-roadmap endpoint until
 * we wire Claude into v2 in a follow-up).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = freeRoadmapPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first = Object.values(flat)[0]?.[0];
    return NextResponse.json({ ok: false, error: first ?? "Invalid request" }, { status: 400 });
  }

  const data = parsed.data;

  // Save to leads
  const r = await supabaseRest<{ id: string }[]>("POST", "/leads", {
    name: data.name,
    email: data.email,
    company: data.company,
    role: data.role || null,
    team_size: data.team_size || null,
    pain_points: data.pain_points,
    stack: data.stack,
    notes: data.notes,
    source: "free-roadmap",
  });

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: "Couldn't save your info. Please try again or email jon@30dayramp.com." },
      { status: 500 },
    );
  }

  // Acknowledgement to the lead — we promise the roadmap within 24h
  const firstName = data.name.split(/\s+/)[0];
  sendEmail({
    to: data.email,
    subject: `${firstName}, we got it — your roadmap is on the way`,
    html: emailShell(`
      <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">Got it, ${firstName}.</h2>
      <p style="margin:0 0 16px">We received your details. Andrew is putting together a personalized 30-day AI roadmap for ${data.company} based on what you shared. You'll have it in your inbox within 24 hours.</p>
      <p style="margin:0 0 16px">Want to skip the doc and walk through it live instead? Book a discovery call:</p>
      <p style="margin:24px 0">
        <a href="${process.env.SITE_URL ?? "https://www.30dayramp.com"}/book"
           style="display:inline-block;padding:12px 22px;background:linear-gradient(180deg,#fdba74,#fb923c);color:#1a0e05;font-weight:700;text-decoration:none;border-radius:10px">
          Book a 30-min call →
        </a>
      </p>
    `),
  }).catch((e) => console.error("[free-roadmap] customer ack email failed", e));

  // Internal alert
  const painsList = data.pain_points.length ? data.pain_points.join(", ") : "—";
  const stackList = data.stack.length ? data.stack.join(", ") : "—";
  sendEmail({
    to: site.email,
    subject: `[ROADMAP] ${data.name} · ${data.company}`,
    html: emailShell(`
      <h2 style="margin:0 0 12px;font-size:18px;color:#f4f6fa">New free-roadmap request</h2>
      <p style="margin:0 0 8px"><strong>Name:</strong> ${escapeHtml(data.name)}</p>
      <p style="margin:0 0 8px"><strong>Email:</strong> <a href="mailto:${escapeHtml(data.email)}" style="color:#60a5fa">${escapeHtml(data.email)}</a></p>
      <p style="margin:0 0 8px"><strong>Company:</strong> ${escapeHtml(data.company)}</p>
      ${data.role ? `<p style="margin:0 0 8px"><strong>Role:</strong> ${escapeHtml(data.role)}</p>` : ""}
      ${data.team_size ? `<p style="margin:0 0 8px"><strong>Team:</strong> ${escapeHtml(data.team_size)}</p>` : ""}
      <p style="margin:0 0 8px"><strong>Pain points:</strong> ${escapeHtml(painsList)}</p>
      <p style="margin:0 0 8px"><strong>Stack:</strong> ${escapeHtml(stackList)}</p>
      ${data.notes ? `<p style="margin:0 0 8px"><strong>What changes:</strong></p><blockquote style="margin:0;padding:10px 14px;border-left:2px solid #3b82f6;color:#c8d0dc;font-size:14px">${escapeHtml(data.notes).replace(/\n/g, "<br>")}</blockquote>` : ""}
    `),
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
