/**
 * Shared Anthropic analysis + roadmap email building.
 *
 * Used by both /api/questionnaire (post-booking flow) and /api/free-roadmap
 * (anonymous lead-magnet flow). Same prompt, same output shape, same email
 * format. The only difference is the "intake" context the prompt is given.
 */

import { buildPromptContext } from "@/lib/questionnaire-fields";
import {
  emailHero, emailCtaCard, emailSignoff,
  emailStatsGrid, emailAgentCard, emailSection, emailOpportunityCallout,
} from "@/lib/email-design";

export interface AnalysisResult {
  grade: "A" | "B" | "C" | "D" | null;
  gradeSummary: string | null;
  roadmap: Record<string, unknown> | null;
  failure: string | null;
}

/** Generalized "intake" context for the prompt — booking has tier, free
 *  roadmap has team_size/role. Both have name + company + optional notes. */
export interface ProspectContext {
  name: string;
  company: string;
  tier?: string | null;
  team_size?: string | null;
  role?: string | null;
  notes?: string | null;
}

/** Run the prospect through Anthropic. Returns null fields + a failure code
 *  if the call breaks — never throws. Callers decide how to handle the
 *  fallback. */
export async function analyzeProspect(
  ctx: ProspectContext,
  qData: Record<string, unknown>,
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  if (!apiKey) {
    console.warn("[analyze] ANTHROPIC_API_KEY not set — skipping analysis");
    return { grade: null, gradeSummary: null, roadmap: null, failure: "no_key" };
  }

  // buildPromptContext expects { name, company, tier?, notes? } — we feed it
  // the intake plus any free-roadmap-specific fields as supplements.
  const prospectBlock = buildPromptContext(qData, {
    name: ctx.name,
    company: ctx.company,
    tier: ctx.tier ?? null,
    notes: ctx.notes ?? null,
  });

  const extraIntake = [
    ctx.role ? `Role: ${ctx.role}` : null,
    ctx.team_size ? `Team size (intake): ${ctx.team_size}` : null,
  ].filter(Boolean).join("\n");

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
${prospectBlock}${extraIntake ? `\n${extraIntake}` : ""}

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
      console.error("[analyze] Anthropic non-200:", r.status, errBody.slice(0, 500));
      return { grade: null, gradeSummary: null, roadmap: null, failure: `api_${r.status}` };
    }
    const json = await r.json() as { content?: Array<{ text?: string }> };
    const raw = json.content?.[0]?.text ?? "";
    if (!raw) return { grade: null, gradeSummary: null, roadmap: null, failure: "empty_response" };
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    let parsed: { grade?: string; grade_summary?: string; roadmap?: Record<string, unknown> };
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("[analyze] JSON.parse failed:", e instanceof Error ? e.message : e, "—", cleaned.slice(0, 800));
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
    console.error("[analyze] Anthropic call threw:", e instanceof Error ? e.message : e);
    return { grade: null, gradeSummary: null, roadmap: null, failure: "exception" };
  }
}

/** Build the rich roadmap email body (innerRows for wrapEmail).
 *  Used by both flows so the customer sees the same format whether they
 *  came from a booking or the lead-magnet form. */
export function buildRoadmapEmailRows({
  firstName,
  roadmap,
  ctaHref,
  ctaLabel = "Book a discovery call →",
  ctaEyebrow = "Next up",
  ctaTitle = "Want to walk through it on a call?",
  ctaBody = "30-min discovery call: we'll prioritize which agent to ship first, scope the build, and quote you exact pricing. No pressure, no pitch.",
  signoffExtra = "Questions? Just reply to this email — it goes straight to me.",
}: {
  firstName: string;
  roadmap: {
    summary?: string;
    top_agents?: Array<{
      name?: string;
      channel?: string;
      what_it_does?: string;
      hours_saved?: string;
      integrations?: string[];
    }>;
  };
  ctaHref: string;
  ctaLabel?: string;
  ctaEyebrow?: string;
  ctaTitle?: string;
  ctaBody?: string;
  signoffExtra?: string;
}): string {
  const agents = Array.isArray(roadmap.top_agents) ? roadmap.top_agents : [];
  const summary = roadmap.summary ?? "";

  return (
    emailHero({
      eyebrow: "Your roadmap",
      headline: `${escapeHtml(firstName)}, your automation roadmap is ready.`,
      sub: "Based on your answers — here's what we'd build, in priority order.",
    }) +
    (summary ? emailOpportunityCallout(escapeHtml(summary)) : "") +
    emailStatsGrid([
      { value: String(agents.length || 5), label: "AI Agents" },
      { value: "30", label: "Day go-live" },
      { value: "$0", label: "If we miss it", accent: "good" },
    ]) +
    emailSection("What we'd build for you") +
    agents.map((a, i) => emailAgentCard({
      number: i + 1,
      title: escapeHtml(a.name ?? `Agent ${i + 1}`),
      channel: a.channel
        ? escapeHtml(a.channel)
        : (Array.isArray(a.integrations) && a.integrations.length
            ? escapeHtml(a.integrations.slice(0, 2).join(" + "))
            : undefined),
      body: escapeHtml(a.what_it_does ?? ""),
      savings: a.hours_saved ? escapeHtml(a.hours_saved) : undefined,
    })).join("") +
    emailCtaCard({
      eyebrow: ctaEyebrow,
      title: ctaTitle,
      body: ctaBody,
      ctaHref,
      ctaLabel,
    }) +
    emailSignoff({ name: "Jon", extra: signoffExtra })
  );
}

/** Wrap raw text for safe HTML inclusion. Re-exported because both API routes
 *  need it and we don't want every route maintaining its own copy. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

/** Convenience subject + preheader builder so both routes use consistent
 *  copy for the customer-facing roadmap email. */
export function roadmapEmailMeta({
  firstName,
  roadmap,
}: {
  firstName: string;
  roadmap: { summary?: string; top_agents?: unknown[] };
}): { subject: string; preheader: string } {
  const agentCount = Array.isArray(roadmap.top_agents) ? roadmap.top_agents.length : 0;
  return {
    subject: `Your automation roadmap is ready, ${firstName}`,
    preheader:
      roadmap.summary ??
      `${agentCount} AI agents tailored to your stack. 30-day go-live or full refund.`,
  };
}
