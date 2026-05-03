import { NextResponse, type NextRequest } from "next/server";
import { supabaseRest } from "@/lib/supabase";
import { sendEmail, emailShell } from "@/lib/email";
import { buildPromptContext, validatePayload } from "@/lib/questionnaire-fields";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const maxDuration = 120;

interface AnalysisResult {
  grade: "A" | "B" | "C" | "D" | null;
  gradeSummary: string | null;
  roadmap: Record<string, unknown> | null;
  failure: string | null;
}

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
  const analysis = await analyzeProspect(booking, qData);

  // ── Persist
  await supabaseRest("PATCH", `/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    questionnaire: qData,
    ...(analysis.grade ? { grade: analysis.grade, grade_summary: analysis.gradeSummary } : {}),
    ...(analysis.roadmap ? { automation_map: analysis.roadmap } : {}),
    profile_updated_at: new Date().toISOString(),
  });

  // ── Customer email
  const firstName = (booking.name || booking.email).split(/\s+/)[0];
  if (analysis.roadmap) {
    const agentCount = Array.isArray((analysis.roadmap as { top_agents?: unknown[] }).top_agents)
      ? ((analysis.roadmap as { top_agents: unknown[] }).top_agents.length)
      : 0;
    const summary = (analysis.roadmap as { summary?: string }).summary ?? "";
    sendEmail({
      to: booking.email,
      subject: `Your automation roadmap is ready, ${firstName}`,
      html: emailShell(`
        <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">Your automation roadmap is ready, ${escapeHtml(firstName)}.</h2>
        <p style="margin:0 0 16px">Based on your answers — we'll walk through this together on the call.</p>
        ${summary ? `<blockquote style="margin:16px 0;padding:14px 18px;border-left:3px solid #3b82f6;color:#c8d0dc;background:rgba(59,130,246,0.06);border-radius:0 8px 8px 0">"${escapeHtml(summary)}"</blockquote>` : ""}
        <p style="margin:0 0 16px"><strong style="color:#f4f6fa">${agentCount}</strong> AI agents · 30-day go-live · full refund if we miss it.</p>
        <p style="margin:24px 0;color:#929bab;font-size:13px">This is a starting point — on the call we'll prioritize what makes sense to ship first. No pressure, no pitch.</p>
      `),
    }).catch((e) => console.error("[questionnaire] customer roadmap email failed", e));
  } else {
    // Silent-failure fallback — customer gets something graceful even if Anthropic broke.
    sendEmail({
      to: booking.email,
      subject: `We've got your prep, ${firstName}`,
      html: emailShell(`
        <h2 style="margin:0 0 12px;font-size:22px;color:#f4f6fa">Thanks, ${escapeHtml(firstName)}. We've got your prep.</h2>
        <p style="margin:0 0 16px">We received your responses. Andrew is personally reviewing what you sent and will get a tailored automation roadmap to your inbox before your call.</p>
        <p style="margin:0 0 16px">If you don't see it within 24 hours, just reply to this email.</p>
      `),
    }).catch(() => {});
  }

  // ── Owner alert (always — gives Jon visibility either way)
  sendEmail({
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
      <p style="margin:14px 0"><a href="${site.tagline ? "https://www.30dayramp.com" : "#"}/admin" style="color:#60a5fa;font-weight:600">View in admin →</a></p>
    `),
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    grade: analysis.grade,
    roadmap_generated: !!analysis.roadmap,
    failure: analysis.failure,
  });
}

/* ------------------------------------------------------------------------- */

async function analyzeProspect(
  booking: { name: string; company: string; tier: string | null; notes: string | null },
  qData: Record<string, unknown>,
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  if (!apiKey) {
    console.warn("[questionnaire] ANTHROPIC_API_KEY not set — skipping analysis");
    return { grade: null, gradeSummary: null, roadmap: null, failure: "no_key" };
  }

  const prospectBlock = buildPromptContext(qData, booking);

  const prompt = `You are an AI automation consultant at Ramped AI. We build done-for-you AI agent implementations for small and mid-size operating businesses.

Each AI agent we build:
- Lives inside the client's existing tools (Slack, email, CRM, etc.) — no new apps to learn
- Handles repetitive tasks automatically: follow-ups, reporting, scheduling, responses
- Is triggered by real business events (new CRM contact, form submission, daily schedule, etc.)
- Saves the team hours each week

Your job: grade this prospect and produce a personalized automation roadmap. Write everything from the client's perspective — focus on outcomes and time saved, not technology. Use plain language ("AI agent", "automation", "assistant"), never internal product names.

GRADING:
A (Hot): Clear specific pain, 10+ team OR $500K+ revenue, decision-maker signal, premium tier interest.
B (Warm): Good pain awareness, 5-10 team, $100K-$500K revenue, clear use case, some budget signal.
C (Lukewarm): Vague pain, 2-5 team, early stage, unclear budget.
D (Poor fit): Solo, no budget signal, no clear pain.

PROSPECT DATA:
${prospectBlock}

Even if some fields are blank ("—"), do your best with what's available — note any gaps in grade_summary.

Respond with ONLY valid JSON — no markdown fences, no text outside the JSON:
{
  "grade": "A",
  "grade_summary": "2-3 sentences explaining grade + key signals",
  "roadmap": {
    "summary": "2-3 sentences of the biggest automation opportunity in plain language",
    "top_agents": [
      {
        "name": "e.g. Lead Response Agent",
        "channel": "WhatsApp / Slack / Telegram / etc",
        "what_it_does": "1-2 sentences from the client's perspective",
        "trigger": "What triggers it",
        "integrations": ["Tool1", "Tool2"],
        "hours_saved": "X-Y hours/week"
      }
    ],
    "quick_wins": ["Win 1", "Win 2", "Win 3"],
    "week_1_focus": "Most impactful agent to build first and why",
    "recommended_tier": "starter or growth or enterprise"
  }
}

Rules: 3-5 top_agents, prioritized by pain points and existing channels. Be SPECIFIC — name their tools.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) {
      const errBody = await r.text();
      console.error("[questionnaire] Anthropic non-200:", r.status, errBody.slice(0, 500));
      return { grade: null, gradeSummary: null, roadmap: null, failure: `api_${r.status}` };
    }
    const json = await r.json() as { content?: Array<{ text?: string }>; stop_reason?: string };
    const raw = json.content?.[0]?.text ?? "";
    if (!raw) return { grade: null, gradeSummary: null, roadmap: null, failure: "empty_response" };
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: { grade?: string; grade_summary?: string; roadmap?: Record<string, unknown> };
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("[questionnaire] JSON.parse failed:", e instanceof Error ? e.message : e, "—", cleaned.slice(0, 800));
      return { grade: null, gradeSummary: null, roadmap: null, failure: "parse_error" };
    }
    const grade = String(parsed.grade ?? "").toUpperCase().charAt(0);
    return {
      grade: ["A", "B", "C", "D"].includes(grade) ? (grade as "A" | "B" | "C" | "D") : null,
      gradeSummary: parsed.grade_summary ?? null,
      roadmap: parsed.roadmap ?? null,
      failure: parsed.roadmap ? null : "no_roadmap",
    };
  } catch (e) {
    console.error("[questionnaire] Anthropic call threw:", e instanceof Error ? e.message : e);
    return { grade: null, gradeSummary: null, roadmap: null, failure: "exception" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}
