/**
 * Take a ScrapeResult + booking context, ask Claude to extract structured
 * signals we'll feed into the deck template.
 *
 * Critical guardrails:
 *   - **Never invent numbers.** Slides that need stats stay blank if we
 *     can't find them in the scraped text. The deck's "research" view
 *     in admin shows Jon what was extracted vs. what was left blank.
 *   - **Never fabricate quotes.** voice_samples must be verbatim phrases
 *     from the scraped pages or null.
 *   - **Tag confidence per field.** If "founder_name" is from a heading
 *     it's high-confidence; if it's inferred from a copyright line it's
 *     low. Admin UI surfaces low-confidence fields for review.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ScrapeResult } from "./scraper";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export interface BookingContext {
  name: string;        // prospect name
  email: string;
  company: string;     // free-text company name from booking
  notes?: string | null;
  tier?: string | null;
  datetime: string;    // ISO
}

export interface ExtractedResearch {
  // What the company does — the "elevator pitch" we'd recap on slide 2
  business_summary: string | null;
  industry: string | null;
  // Who their typical clients are (ICP). Empty array if not findable.
  icp: string[];
  // Specific pains they solve for, in their own language
  client_pains: string[];
  // Their tagline / how they frame what they do, verbatim from the site
  positioning_phrase: string | null;
  // Founder/owner — name + title if found, otherwise null
  founder_name: string | null;
  founder_title: string | null;
  // Tools/integrations mentioned on the site (HubSpot, NetSuite, etc.)
  tools_mentioned: string[];
  // 3-7 specific operational pain hooks Ramped agents could fix.
  // These power the "3 pains → 3 agents" slide. Cite specific page evidence.
  agent_fit_opportunities: Array<{
    pain: string;          // observed pain in their world
    agent_pattern: string; // which Ramped pattern applies
    note?: string;         // why it fits — short justification
  }>;
  // Honesty flag — fields the model wasn't sure about
  uncertain_fields: string[];
}

/**
 * The system prompt. Heavy on guardrails — this is what keeps the auto-deck
 * from saying things that aren't true about the prospect.
 */
const SYSTEM_PROMPT = `You are extracting structured research for a sales deck. Output JSON only, no prose.

Strict rules (violations = deck unusable):
1. NEVER invent specifics. If the scraped pages don't mention something, return null/empty for that field. Do NOT guess at industries, founders, or numbers based on the company name.
2. NEVER quote anything that isn't verbatim from the provided text. Don't paraphrase into "quotes."
3. Tag every uncertain field in uncertain_fields[]. Better to say "I'm not sure" than to make up plausible-sounding answers.
4. Keep all extracted text concise. Most fields under 120 chars. Lists max 7 items.
5. agent_fit_opportunities must reference SPECIFIC pains visible in the scraped text — not generic "businesses need automation" filler.

Output schema (return ONLY this JSON, no markdown, no commentary):
{
  "business_summary": "1 sentence describing what the company does — max 200 chars — or null",
  "industry": "single best industry tag (e.g. 'Business Coaching', 'HVAC Services') or null",
  "icp": ["who they sell to — short phrases, max 5"],
  "client_pains": ["specific client pains they speak to — verbatim where possible, max 5"],
  "positioning_phrase": "their headline tagline if findable, verbatim — or null",
  "founder_name": "founder/CEO name if explicitly named on the site — or null",
  "founder_title": "their title (Founder, CEO, etc.) if findable — or null",
  "tools_mentioned": ["specific software/tools they mention — exact names"],
  "agent_fit_opportunities": [
    {
      "pain": "specific operational pain Ramped could solve for THIS company or its clients",
      "agent_pattern": "Ramped pattern that fits: 'Inbound Qualifier', 'Quote Drafter', 'Exception Catcher', 'Weekly Digest', 'Approval Queue', 'Intake Summarizer', 'Follow-up Drafter', etc.",
      "note": "why this fits in <= 25 words"
    }
  ],
  "uncertain_fields": ["names of any fields above where you're guessing more than extracting"]
}`;

/**
 * Run the extraction. Returns a research object plus a confidence score.
 * Never throws — failure modes return a research object with mostly nulls
 * and uncertain_fields listing what we couldn't find.
 */
export async function extractResearch(
  scrape: ScrapeResult,
  ctx: BookingContext,
): Promise<{ research: ExtractedResearch; extractor_log: Record<string, unknown> }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const log: Record<string, unknown> = {
    model: MODEL,
    scrape_pages: scrape.pages.length,
    started_at: new Date().toISOString(),
  };
  if (!apiKey) {
    return {
      research: emptyResearch(["no_api_key"]),
      extractor_log: { ...log, error: "ANTHROPIC_API_KEY not set" },
    };
  }
  if (!scrape.hostsResolved || scrape.pages.length === 0) {
    return {
      research: emptyResearch(["no_scrape_data"]),
      extractor_log: { ...log, error: "scrape returned no usable pages", scrape_errors: scrape.errors },
    };
  }

  // Build user prompt from scrape pages + booking context
  const pageBlocks = scrape.pages
    .map((p, i) => {
      const head = [
        `=== PAGE ${i + 1} ===`,
        `URL: ${p.url}`,
        p.title ? `Title: ${p.title}` : null,
        p.metaDescription ? `Meta description: ${p.metaDescription}` : null,
        p.ogTitle ? `OG title: ${p.ogTitle}` : null,
        p.ogDescription ? `OG description: ${p.ogDescription}` : null,
        p.headings.length ? `\nHEADINGS:\n${p.headings.map(h => `  - ${h}`).join("\n")}` : null,
      ].filter(Boolean).join("\n");
      const body = p.bodyText ? `\nBODY:\n${p.bodyText}` : "";
      return head + body;
    })
    .join("\n\n");

  const ctxBlock = [
    `=== BOOKING CONTEXT ===`,
    `Prospect name: ${ctx.name}`,
    `Email: ${ctx.email}`,
    `Company (as entered): ${ctx.company}`,
    ctx.tier ? `Tier interest: ${ctx.tier}` : null,
    ctx.notes ? `Notes from booking form: ${ctx.notes}` : null,
    `Call scheduled: ${ctx.datetime}`,
  ].filter(Boolean).join("\n");

  const userPrompt = `${ctxBlock}\n\nScraped pages from their website:\n\n${pageBlocks}\n\nReturn the JSON research object now.`;

  const client = new Anthropic({ apiKey });
  let raw = "";
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = resp.content
      .filter(b => b.type === "text")
      .map(b => (b as { text: string }).text)
      .join("\n")
      .trim();
    log.model_response_chars = raw.length;
    log.input_tokens = resp.usage?.input_tokens;
    log.output_tokens = resp.usage?.output_tokens;
  } catch (e) {
    return {
      research: emptyResearch(["claude_api_failed"]),
      extractor_log: { ...log, error: `Claude API call failed: ${(e as Error).message}` },
    };
  }

  // Parse JSON (Claude sometimes wraps in ```json — strip fences)
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/```\s*$/, "").trim();
  let parsed: Partial<ExtractedResearch> = {};
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      research: emptyResearch(["claude_returned_invalid_json"]),
      extractor_log: { ...log, error: "JSON parse failed", raw_sample: raw.slice(0, 300) },
    };
  }

  // Normalize + apply defaults
  const research: ExtractedResearch = {
    business_summary: trimOrNull(parsed.business_summary, 200),
    industry: trimOrNull(parsed.industry, 80),
    icp: clampArray(parsed.icp, 5, 100),
    client_pains: clampArray(parsed.client_pains, 5, 200),
    positioning_phrase: trimOrNull(parsed.positioning_phrase, 200),
    founder_name: trimOrNull(parsed.founder_name, 80),
    founder_title: trimOrNull(parsed.founder_title, 80),
    tools_mentioned: clampArray(parsed.tools_mentioned, 8, 40),
    agent_fit_opportunities: Array.isArray(parsed.agent_fit_opportunities)
      ? parsed.agent_fit_opportunities.slice(0, 5).map(o => ({
          pain: trimOrNull(o?.pain, 200) || "",
          agent_pattern: trimOrNull(o?.agent_pattern, 100) || "",
          note: trimOrNull(o?.note, 200) || undefined,
        })).filter(o => o.pain && o.agent_pattern)
      : [],
    uncertain_fields: clampArray(parsed.uncertain_fields, 10, 50),
  };

  log.finished_at = new Date().toISOString();
  return { research, extractor_log: log };
}

function trimOrNull(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "n/a") return null;
  return s.length > max ? s.slice(0, max).trim() + "…" : s;
}

function clampArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => trimOrNull(x, maxLen))
    .filter((x): x is string => !!x)
    .slice(0, maxItems);
}

function emptyResearch(uncertain: string[]): ExtractedResearch {
  return {
    business_summary: null,
    industry: null,
    icp: [],
    client_pains: [],
    positioning_phrase: null,
    founder_name: null,
    founder_title: null,
    tools_mentioned: [],
    agent_fit_opportunities: [],
    uncertain_fields: uncertain,
  };
}
