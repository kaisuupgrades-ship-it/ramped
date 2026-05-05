import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail, emailShell } from "@/lib/email";
import { validatePayload } from "@/lib/questionnaire-fields";
import { site } from "@/lib/site";
import { wrapEmail } from "@/lib/email-design";
import { analyzeProspect, buildRoadmapEmailRows, roadmapEmailMeta, escapeHtml } from "@/lib/anthropic-analyze";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/questionnaire
 *
 * Saves answers to bookings.questionnaire (JSONB), runs an Anthropic analysis
 * pass to grade + draft a roadmap, stores the result, and emails:
 *   - the customer their personalized roadmap (or graceful fallback if AI fails)
 *   - the owner an internal alert (every submission, with grade summary OR
 *     failure reason for manual roadmap follow-up)
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;

  const bookingId = typeof data.booking_id === "string" ? data.booking_id : "";
  if (!bookingId) {
    return NextResponse.json(
      { ok: false, error: "booking_id is required. Submit from the booking confirmation page." },
      { status: 400 },
    );
  }

  const valid = validatePayload(data);
  if (!valid.ok) {
    return NextResponse.json({ ok: false, error: valid.errors[0] ?? "Invalid payload" }, { status: 400 });
  }

  // Look up the booking so we know who this is + can defense-in-depth check email match
  const lookup = await supabaseRest<Array<{ id: string; name: string; email: string; company: string; tier: string | null; notes: string | null }>>(
    "GET",
    `/bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,name,email,company,tier,notes`,
  );
  if (!lookup.ok || !Array.isArray(lookup.data) || lookup.data.length === 0) {
    return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });
  }
  const booking = lookup.data[0];

  const submittedEmail = typeof data.email === "string" ? data.email.toLowerCase() : "";
  if (submittedEmail && booking.email && submittedEmail !== booking.email.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "Email does not match the booking" }, { status: 403 });
  }

  // Build the qData payload to store + feed to Anthropic. Keep it as the raw
  // schema-shaped input so future re-grades can run against the same data.
  const { booking_id: _bid, email: _e, ...qData } = data;

  // ── Anthropic analysis (single call: grade + roadmap)
  const analysis = await analyzeProspect(
    {
      name: booking.name,
      company: booking.company,
      tier: booking.tier,
      notes: booking.notes,
    },
    qData,
  );

  // ── Persist
  await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    questionnaire: qData,
    ...(analysis.grade ? { grade: analysis.grade, grade_summary: analysis.gradeSummary } : {}),
    ...(analysis.roadmap ? { automation_map: analysis.roadmap } : {}),
    profile_updated_at: new Date().toISOString(),
  });

  // ── Emails (await both — fire-and-forget gets killed when the route returns
  //   on Vercel serverless, which is why customer roadmap emails were not
  //   delivering. We await Promise.all so the customer + owner sends complete
  //   before we send the response.)
  const firstName = (booking.name || booking.email).split(/\s+/)[0];

  const customerEmail = (async () => {
    if (analysis.roadmap) {
      const meta = roadmapEmailMeta({
        firstName,
        roadmap: analysis.roadmap as { summary?: string; top_agents?: unknown[] },
      });
      const innerRows = buildRoadmapEmailRows({
        firstName,
        roadmap: analysis.roadmap as Parameters<typeof buildRoadmapEmailRows>[0]["roadmap"],
        ctaHref: `${process.env.SITE_URL ?? "https://www.30dayramp.com"}/book`,
        ctaLabel: "Confirm or reschedule →",
        ctaTitle: `We'll walk through this on the call.`,
        ctaBody: "On the discovery call we'll prioritize which agent to ship first, scope the build, and quote you exact pricing. No pressure, no pitch.",
        signoffExtra: "Questions before the call? Just reply to this email — it goes straight to me.",
      });

      const result = await sendEmail({
        to: booking.email,
        subject: meta.subject,
        html: wrapEmail({
          subject: meta.subject,
          preheader: meta.preheader,
          innerRows,
          siteUrl: process.env.SITE_URL ?? "https://www.30dayramp.com",
        }),
      });
      if (!result.ok) console.error("[questionnaire] customer roadmap email failed:", result.error);
      return result;
    }
    // Silent-failure fallback — customer gets something graceful even if Anthropic broke.
    const result = await sendEmail({
      to: booking.email,
      subject: `We've got your prep, ${firstName}`,
      html: emailShell(`
        <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">Thanks, ${escapeHtml(firstName)}. We've got your prep.</h2>
        <p style="margin:0 0 16px">We received your responses. Andrew is personally reviewing what you sent and will get a tailored automation roadmap to your inbox before your call.</p>
        <p style="margin:0 0 16px">If you don't see it within 24 hours, just reply to this email.</p>
      `),
    });
    if (!result.ok) console.error("[questionnaire] customer fallback email failed:", result.error);
    return result;
  })();

  const ownerEmail = sendEmail({
    to: site.email,
    subject: analysis.roadmap
      ? `[${analysis.grade ?? "?"}] Questionnaire submitted: ${booking.name} · ${booking.company}`
      : `[ALERT] Roadmap generation failed for ${booking.company}`,
    html: emailShell(`
      <h2 style="margin:0 0 8px">${analysis.roadmap ? "New questionnaire" : "⚠ AI generation failed"}</h2>
      <p style="margin:0 0 6px"><strong>${escapeHtml(booking.name ?? "—")}</strong> · ${escapeHtml(booking.email)}</p>
      <p style="margin:0 0 6px"><strong>Company:</strong> ${escapeHtml(booking.company ?? "—")}</p>
      ${analysis.gradeSummary ? `<p style="margin:8px 0;color:#c8d0dc">${escapeHtml(analysis.gradeSummary)}</p>` : ""}
      ${analysis.failure ? `<p style="margin:8px 0;color:#f87171"><strong>Failure mode:</strong> <code>${escapeHtml(analysis.failure)}</code> — manual roadmap needed.</p>` : ""}
      <p style="margin:14px 0"><a href="https://www.30dayramp.com/admin" style="color:#60a5fa;font-weight:600">View in admin →</a></p>
    `),
  }).then((r) => { if (!r.ok) console.error("[questionnaire] owner email failed:", r.error); return r; });

  await Promise.all([customerEmail, ownerEmail]);

  return NextResponse.json({
    ok: true,
    grade: analysis.grade,
    roadmap_generated: !!analysis.roadmap,
    failure: analysis.failure,
  });
}
