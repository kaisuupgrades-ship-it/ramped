import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail, emailShell } from "@/lib/email";
import { freeRoadmapPayloadSchema } from "@/lib/schemas/free-roadmap";
import { validatePayload } from "@/lib/questionnaire-fields";
import { site } from "@/lib/site";
import { wrapEmail } from "@/lib/email-design";
import {
  analyzeProspect,
  buildRoadmapEmailRows,
  roadmapEmailMeta,
  escapeHtml,
} from "@/lib/anthropic-analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/free-roadmap — anonymous lead-magnet flow.
 *
 * Mirrors /api/questionnaire, except the prospect didn't book a call. Same
 * 11-question payload, same Anthropic prompt, same rich roadmap email.
 *
 * Flow:
 *  1. Validate intake (name/email/company) + questionnaire payload shape.
 *  2. Insert a row in `leads` (intake + a derived pain_points/stack so the
 *     existing leads admin views still surface useful columns).
 *  3. Run analyzeProspect (Anthropic). If it fails, customer still gets a
 *     graceful "we'll send within 24h" ack and Andrew gets an alert.
 *  4. Persist the generated roadmap to `automation_maps` (lead_id linked).
 *  5. Email customer the rich roadmap email + email owner an internal alert.
 *
 * Env vars used: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
 *                ANTHROPIC_MODEL (optional), RESEND_API_KEY, RESEND_FROM_EMAIL,
 *                SITE_URL.
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

  const data = parsed.data as Record<string, unknown> & { name: string; email: string; company: string };
  const { name, email, company } = data;

  // Strip intake from the questionnaire data we feed Anthropic + persist.
  const { name: _n, email: _e, company: _c, ...qData } = data;

  // Soft-validate the questionnaire shape — if invalid we still proceed
  // (customer should never lose their roadmap to a schema nit).
  const valid = validatePayload({ ...qData, booking_id: "free", email });
  if (!valid.ok) {
    console.warn("[free-roadmap] questionnaire validation issues:", valid.errors);
  }

  // ── 1. Save lead. Pull pain_points + stack out of the questionnaire so
  //   the leads admin view still has structured columns (legacy parity).
  //   Field IDs match questionnaire-fields.ts: pain_points, tools, crm,
  //   email_provider, bottleneck (NOT pains/platforms/email_system/anything_else).
  const painPoints = Array.isArray(qData.pain_points) ? qData.pain_points : [];
  const stack: string[] = [];
  if (Array.isArray(qData.tools)) stack.push(...(qData.tools as string[]));
  if (typeof qData.crm === "string" && qData.crm) stack.push(qData.crm);
  if (typeof qData.email_provider === "string" && qData.email_provider) stack.push(qData.email_provider);

  let leadId: string | null = null;
  const leadRes = await supabaseRest<{ id: string }[]>("POST", "/leads", {
    name,
    email,
    company,
    role: null,
    team_size: typeof qData.team_size === "string" ? qData.team_size : null,
    pain_points: painPoints,
    stack,
    notes: typeof qData.bottleneck === "string" ? qData.bottleneck : "",
    source: "free-roadmap",
  });
  if (leadRes.ok && Array.isArray(leadRes.data) && leadRes.data[0]?.id) {
    leadId = leadRes.data[0].id;
  } else if (!leadRes.ok) {
    console.error("[free-roadmap] lead insert failed:", leadRes.status);
    return NextResponse.json(
      { ok: false, error: "Couldn't save your info. Please try again or email jon@30dayramp.com." },
      { status: 500 },
    );
  }

  // ── 2. Anthropic analysis
  const analysis = await analyzeProspect(
    {
      name,
      company,
      tier: null,
      team_size: typeof qData.team_size === "string" ? qData.team_size : null,
      role: null,
      notes: typeof qData.bottleneck === "string" ? qData.bottleneck : null,
    },
    qData,
  );

  // ── 3. Persist generated roadmap to automation_maps (linked to lead)
  if (analysis.roadmap && leadId) {
    await supabaseRest("POST", "/automation_maps", {
      lead_id: leadId,
      email,
      payload: { ...analysis.roadmap, _grade: analysis.grade, _grade_summary: analysis.gradeSummary, _questionnaire: qData },
    });
  }

  // ── 4. Customer email
  const firstName = name.split(/\s+/)[0];
  const SITE_URL = process.env.SITE_URL ?? "https://www.30dayramp.com";

  const customerEmail = (async () => {
    if (analysis.roadmap) {
      const meta = roadmapEmailMeta({
        firstName,
        roadmap: analysis.roadmap as { summary?: string; top_agents?: unknown[] },
      });
      const innerRows = buildRoadmapEmailRows({
        firstName,
        roadmap: analysis.roadmap as Parameters<typeof buildRoadmapEmailRows>[0]["roadmap"],
        ctaHref: `${SITE_URL}/book`,
        ctaLabel: "Book a 30-min call →",
        ctaTitle: "Want to walk through this on a call?",
        ctaBody: "30-min discovery call: we'll prioritize what to ship first, scope the build, and quote you exact pricing. No pressure, no pitch.",
        signoffExtra: "Questions? Just reply to this email — it goes straight to me.",
      });
      const result = await sendEmail({
        to: email,
        subject: meta.subject,
        html: wrapEmail({
          subject: meta.subject,
          preheader: meta.preheader,
          innerRows,
          siteUrl: SITE_URL,
        }),
      });
      if (!result.ok) console.error("[free-roadmap] customer roadmap email failed:", result.error);
      return result;
    }
    // Fallback: AI broke. Customer gets a graceful "we'll send manually within 24h" ack.
    const result = await sendEmail({
      to: email,
      subject: `${firstName}, we got it — your roadmap is on the way`,
      html: emailShell(`
        <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">Got it, ${escapeHtml(firstName)}.</h2>
        <p style="margin:0 0 16px">We received your details. Andrew is putting together a personalized 30-day AI roadmap for ${escapeHtml(company)} based on what you shared. You'll have it in your inbox within 24 hours.</p>
        <p style="margin:0 0 16px">Want to skip the doc and walk through it live instead? <a href="${SITE_URL}/book" style="color:#60a5fa">Book a 30-min call →</a></p>
      `),
    });
    if (!result.ok) console.error("[free-roadmap] customer fallback email failed:", result.error);
    return result;
  })();

  // ── 5. Owner alert
  const ownerEmail = sendEmail({
    to: site.email,
    subject: analysis.roadmap
      ? `[${analysis.grade ?? "?"}] Free roadmap: ${name} · ${company}`
      : `[ALERT] Free-roadmap AI failed: ${name} · ${company}`,
    html: emailShell(`
      <h2 style="margin:0 0 8px">${analysis.roadmap ? "New free-roadmap submission" : "⚠ AI generation failed"}</h2>
      <p style="margin:0 0 6px"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(email)}</p>
      <p style="margin:0 0 6px"><strong>Company:</strong> ${escapeHtml(company)}</p>
      ${typeof qData.team_size === "string" && qData.team_size ? `<p style="margin:0 0 6px"><strong>Team:</strong> ${escapeHtml(qData.team_size)}</p>` : ""}
      ${analysis.gradeSummary ? `<p style="margin:8px 0;color:#c8d0dc">${escapeHtml(analysis.gradeSummary)}</p>` : ""}
      ${analysis.failure ? `<p style="margin:8px 0;color:#f87171"><strong>Failure mode:</strong> <code>${escapeHtml(analysis.failure)}</code> — manual roadmap needed.</p>` : ""}
      <p style="margin:14px 0"><a href="${SITE_URL}/admin#leads" style="color:#60a5fa;font-weight:600">View in admin →</a></p>
    `),
  }).then((r) => { if (!r.ok) console.error("[free-roadmap] owner email failed:", r.error); return r; });

  await Promise.all([customerEmail, ownerEmail]);

  return NextResponse.json({
    ok: true,
    grade: analysis.grade,
    roadmap_generated: !!analysis.roadmap,
    failure: analysis.failure,
  });
}
