/**
 * Render a per-prospect prep deck as a .pptx Buffer.
 *
 * Data-driven port of the Michael v3 deck. Same 11-slide structure, but
 * every text block reads from the ExtractedResearch object. Where research
 * is missing, the slide gracefully falls back to a generic frame from the
 * Sales Playbook (no "lorem ipsum" or "[insert here]" — always shippable).
 *
 * Critical: we NEVER invent numbers, founder names, or specifics that
 * weren't in the scrape. Empty fields stay empty; the admin UI flags the
 * deck as "low confidence" so Jon knows to inspect.
 */

import pptxgen from "pptxgenjs";
import type { ExtractedResearch } from "./extractor";

export const TEMPLATE_VERSION = "v3.0";

export interface RenderInput {
  prospectName: string;
  companyName: string;
  callDate: string;          // "Mon May 19 · 2pm" style — caller formats
  research: ExtractedResearch;
}

// ── Brand palette (from Marketing-Pack/BRAND-STYLE-GUIDE.md) ──────────────
const C = {
  ink:     "0B1220",
  ink2:    "1A2233",
  paper:   "FAFAF7",
  surface: "F5F5F3",
  line:    "E6E4DC",
  muted:   "5B6272",
  accent:  "1F4FFF",
  warn:    "B45309",
  cyan:    "00D4FF",
};
const FONT_HEAD = "Arial";
const FONT_BODY = "Calibri";
const W = 13.333;
const H = 7.5;

function eyebrow(slide: pptxgen.Slide, text: string, opts: { color?: string } = {}) {
  slide.addText(text, {
    x: 0.6, y: 0.55, w: 12, h: 0.3,
    fontFace: FONT_HEAD, fontSize: 10, bold: true,
    color: opts.color ?? C.muted, charSpacing: 12,
  });
}

function footer(slide: pptxgen.Slide, pageNum: number, prospectName: string) {
  const today = new Date().toISOString().slice(0, 10);
  slide.addText(`Ramped AI  ·  for ${prospectName}  ·  ${today}`, {
    x: 0.6, y: H - 0.45, w: 8, h: 0.3,
    fontFace: FONT_BODY, fontSize: 9, color: C.muted,
  });
  slide.addText(String(pageNum), {
    x: W - 1.0, y: H - 0.45, w: 0.4, h: 0.3,
    fontFace: FONT_BODY, fontSize: 9, color: C.muted, align: "right",
  });
}

/** Build the deck and return it as a Node Buffer suitable for upload. */
export async function renderProspectDeck(input: RenderInput): Promise<Buffer> {
  const { prospectName, companyName, callDate, research: r } = input;
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE";
  p.title = `Ramped × ${companyName} — Hello ${prospectName}`;
  p.author = "Ramped AI";

  // ── SLIDE 1: Cover ─────────────────────────────────────────────────────
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    s.addShape("rect", { x: 0.6, y: 0.6, w: 0.6, h: 0.04, fill: { color: C.cyan } });
    s.addText("RAMPED  ·  AI DEPARTMENT, LIVE IN 30 DAYS", {
      x: 0.6, y: 0.85, w: 10, h: 0.35,
      fontFace: FONT_HEAD, fontSize: 11, bold: true, color: "BBBFC9", charSpacing: 15,
    });
    s.addText(`Hi ${prospectName.split(" ")[0]}.`, {
      x: 0.6, y: 2.3, w: 12, h: 1.2,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: "FFFFFF",
    });
    s.addText(
      `A few notes on what I think Ramped could do\nfor ${companyName}${r.icp.length ? " — and for your clients." : "."}`,
      { x: 0.6, y: 3.7, w: 11, h: 1.5, fontFace: FONT_BODY, fontSize: 22, color: "D8DCE6", lineSpacingMultiple: 1.25 },
    );
    s.addText(`Discovery conversation  ·  ${callDate}`, {
      x: 0.6, y: H - 0.75, w: 6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: "7A8090",
    });
    s.addText("Jon  ·  Ramped AI", {
      x: W - 4.0, y: H - 0.75, w: 3.4, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: "7A8090", align: "right",
    });
  }

  // ── SLIDE 2: What I noticed about [Company] ───────────────────────────
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, `WHAT I NOTICED ABOUT ${companyName.toUpperCase()}`);

    // Headline — pull positioning phrase verbatim if we have it, else generic
    const headline = r.positioning_phrase
      ? `"${r.positioning_phrase}"`
      : r.business_summary
        ? r.business_summary
        : `You're solving real operational pain\nfor mid-market businesses.`;
    s.addText(headline, {
      x: 0.6, y: 1.0, w: 12, h: 1.8,
      fontFace: FONT_HEAD, fontSize: r.positioning_phrase ? 32 : 36, bold: !r.positioning_phrase,
      italic: !!r.positioning_phrase, color: C.ink, lineSpacingMultiple: 1.1,
    });

    // Sub — frame their model
    const sub = r.industry
      ? `${r.industry}.${r.icp.length ? ` Serving ${r.icp.slice(0, 2).join(" and ")}.` : ""}`
      : "What we found from your site:";
    s.addText(sub, {
      x: 0.6, y: 3.0, w: 12, h: 0.6,
      fontFace: FONT_BODY, fontSize: 16, color: C.muted,
    });

    // Cards — show top 4 client pains if we have them, otherwise 4 generic "owner-dependent" cards
    const cards = (r.client_pains.length >= 2
      ? r.client_pains.slice(0, 4).map((pain, i) => ({ label: `PAIN ${i + 1}`, body: pain }))
      : [
          { label: "PAIN 1", body: "Wearing all the hats" },
          { label: "PAIN 2", body: "Sales depend on owner" },
          { label: "PAIN 3", body: "Profits suffer when owner is gone" },
          { label: "PAIN 4", body: "Managers need to be leaders" },
        ]
    );
    // Pad to exactly 4 cards if model returned fewer
    while (cards.length < 4) {
      cards.push({ label: `PAIN ${cards.length + 1}`, body: "—" });
    }
    const cardW = 2.9, cardH = 1.85, cardY = 4.7, gap = 0.18;
    const totalW = cardW * 4 + gap * 3;
    const startX = (W - totalW) / 2;
    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      s.addShape("roundRect", {
        x: cx, y: cardY, w: cardW, h: cardH,
        fill: { color: C.surface }, line: { color: C.line, width: 0.5 }, rectRadius: 0.08,
      });
      s.addText(card.label, {
        x: cx + 0.2, y: cardY + 0.15, w: cardW - 0.4, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.accent, charSpacing: 12,
      });
      s.addText(card.body, {
        x: cx + 0.2, y: cardY + 0.55, w: cardW - 0.4, h: cardH - 0.7,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.3,
      });
    });

    footer(s, 2, prospectName);
  }

  // ── SLIDE 3: The frame (always the same — universal positioning) ──────
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    eyebrow(s, "WHERE RAMPED FITS", { color: "7A8090" });

    const setup = r.client_pains.length > 0
      ? "You're solving real operational pain."
      : "Owner-dependent operations is the bottleneck.";
    s.addText(setup, {
      x: 0.8, y: 1.5, w: 12, h: 0.9,
      fontFace: FONT_HEAD, fontSize: 32, color: "8A92A8",
    });
    s.addText("We build the team\nthe owner can delegate to.", {
      x: 0.8, y: 2.6, w: 12, h: 2.6,
      fontFace: FONT_HEAD, fontSize: 56, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.05,
    });
    const toolsLine = r.tools_mentioned.length > 0
      ? `AI agents that run inside your existing stack — ${r.tools_mentioned.slice(0, 4).join(", ")}, wherever the work happens. They handle what no human assistant can be trusted with at 2am.`
      : `AI agents that run inside your existing stack — Slack, HubSpot, NetSuite, whatever your tools are. They handle the work that an owner-dependent operation can't hand off to anyone else.`;
    s.addText(toolsLine, {
      x: 0.8, y: 5.5, w: 11.5, h: 1.2,
      fontFace: FONT_BODY, fontSize: 16, color: "BBBFC9", lineSpacingMultiple: 1.45,
    });
    footer(s, 3, prospectName);
  }

  // ── SLIDE 4: What Ramped actually does (3 bullets — always the same) ──
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, "WHAT WE ACTUALLY DO");
    s.addText("Three things. No mystery.", {
      x: 0.6, y: 1.0, w: 12, h: 0.9, fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink,
    });
    const items = [
      { n: "1", h: `We build agents inside ${r.tools_mentioned.length ? "your" : "your client's"} existing tools.`,
        b: r.tools_mentioned.length > 0
            ? `${r.tools_mentioned.slice(0, 5).join(", ")} — wherever the work actually happens. No new platform to learn.`
            : `Slack, HubSpot, NetSuite, QuickBooks, Gmail — wherever the work actually happens. No new platform to learn.` },
      { n: "2", h: "We run them. We get paged when something breaks, not you.",
        b: "When an API updates or an edge case shows up at 2am, we own it. The owner stays out of the loop unless it actually needs them." },
      { n: "3", h: "Live in 30 days. Or it's free.",
        b: "Hard deadline, full refund if missed. The only falsifiable risk reversal in the AI implementation market." },
    ];
    const rowH = 1.45;
    items.forEach((it, i) => {
      const ry = 2.4 + i * rowH;
      s.addShape("ellipse", {
        x: 0.6, y: ry, w: 0.7, h: 0.7, fill: { color: C.ink }, line: { color: C.ink, width: 0 },
      });
      s.addText(it.n, {
        x: 0.6, y: ry, w: 0.7, h: 0.7, fontFace: FONT_HEAD, fontSize: 22, bold: true,
        color: "FFFFFF", align: "center", valign: "middle",
      });
      s.addText(it.h, {
        x: 1.55, y: ry, w: 11.2, h: 0.45,
        fontFace: FONT_HEAD, fontSize: 18, bold: true, color: C.ink,
      });
      s.addText(it.b, {
        x: 1.55, y: ry + 0.48, w: 11.2, h: 0.85,
        fontFace: FONT_BODY, fontSize: 14, color: C.muted, lineSpacingMultiple: 1.4,
      });
    });
    footer(s, 4, prospectName);
  }

  // ── SLIDE 5: 30-day guarantee (always the same — trust signal) ────────
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, "THE GUARANTEE");
    s.addShape("roundRect", {
      x: 0.6, y: 1.1, w: 5.5, h: 5.2,
      fill: { color: C.warn }, line: { color: C.warn, width: 0 }, rectRadius: 0.15,
    });
    s.addText("30", {
      x: 0.6, y: 1.4, w: 5.5, h: 2.5,
      fontFace: FONT_HEAD, fontSize: 160, bold: true, color: "FFFFFF", align: "center",
    });
    s.addText("DAYS TO LIVE.", {
      x: 0.6, y: 4.4, w: 5.5, h: 0.5,
      fontFace: FONT_HEAD, fontSize: 22, bold: true, color: "FFFFFF", align: "center", charSpacing: 8,
    });
    s.addText("OR YOUR MONEY BACK.", {
      x: 0.6, y: 4.95, w: 5.5, h: 0.5,
      fontFace: FONT_HEAD, fontSize: 22, bold: true, color: "FFFFFF", align: "center", charSpacing: 8,
    });
    s.addText("No fine print. No partial payment.", {
      x: 0.6, y: 5.55, w: 5.5, h: 0.4,
      fontFace: FONT_BODY, fontSize: 13, italic: true, color: "FFE4C9", align: "center",
    });
    s.addText("Why we offer it", {
      x: 6.55, y: 1.1, w: 6.4, h: 0.5,
      fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.ink,
    });
    const reasons = [
      "Most prospects have been burned by AI tools that worked for 3 weeks, then broke. The 30-day clock forces accountability on us, not them.",
      "Every other AI implementation firm charges 5-figure upfront fees with no commitment date. We made the date the contract.",
      "It's the only falsifiable risk reversal in the AI implementation market today. We track refund rate as our most important internal metric.",
    ];
    reasons.forEach((rs, i) => {
      const ry = 1.85 + i * 1.45;
      s.addShape("rect", { x: 6.55, y: ry, w: 0.05, h: 1.2, fill: { color: C.warn } });
      s.addText(rs, {
        x: 6.85, y: ry - 0.05, w: 6.2, h: 1.3,
        fontFace: FONT_BODY, fontSize: 14, color: C.ink2, lineSpacingMultiple: 1.45,
      });
    });
    footer(s, 5, prospectName);
  }

  // ── SLIDE 6: 3 pains → 3 agent patterns (data-driven) ─────────────────
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, `${companyName.toUpperCase()}'S BIGGEST OPS PAINS  ·  AGENT PATTERNS THAT FIT`);

    s.addText("Specific to what we read from your site.", {
      x: 0.6, y: 1.0, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 24, bold: true, color: C.ink,
    });

    // Pull rows from extracted opportunities — if empty, fall back to canonical 3
    const rows = (r.agent_fit_opportunities.length >= 2
      ? r.agent_fit_opportunities.slice(0, 3).map(o => ({
          pain: o.pain,
          agent: o.agent_pattern,
          desc: o.note || "—",
        }))
      : [
          {
            pain: "Sales depend on the owner",
            agent: "Inbound Qualifier + Quote Drafter",
            desc: "Triages every inbound. Drafts proposal in owner's voice. Owner taps approve.",
          },
          {
            pain: "Operations are chaotic",
            agent: "Exception Catcher",
            desc: "Reconciles invoices, POs, and shipping addresses. Pages the right person when something doesn't line up.",
          },
          {
            pain: "Profits suffer when owner is gone",
            agent: "Weekly Digest + Approval Queue",
            desc: "Owner gets one digest Monday morning + approval-by-default queue. Day-to-day runs without them.",
          },
        ]
    );
    // Pad to exactly 3
    while (rows.length < 3) rows.push({ pain: "—", agent: "—", desc: "—" });

    const tableY = 2.0;
    s.addText("OBSERVED PAIN", {
      x: 0.6, y: tableY, w: 4.0, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
    });
    s.addText("RAMPED AGENT", {
      x: 4.7, y: tableY, w: 4.0, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
    });
    s.addText("WHAT IT DOES", {
      x: 8.8, y: tableY, w: 4.2, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
    });
    s.addShape("rect", { x: 0.6, y: tableY + 0.35, w: W - 1.2, h: 0.015, fill: { color: C.line } });

    rows.forEach((row, i) => {
      const ry = tableY + 0.55 + i * 1.55;
      s.addText(row.pain, {
        x: 0.6, y: ry, w: 4.0, h: 1.3,
        fontFace: FONT_HEAD, fontSize: 15, bold: true, color: C.ink, lineSpacingMultiple: 1.25,
      });
      s.addText(row.agent, {
        x: 4.7, y: ry, w: 4.0, h: 1.3,
        fontFace: FONT_HEAD, fontSize: 15, bold: true, color: C.accent, lineSpacingMultiple: 1.25,
      });
      s.addText(row.desc, {
        x: 8.8, y: ry, w: 4.2, h: 1.3,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink2, lineSpacingMultiple: 1.4,
      });
      if (i < 2) {
        s.addShape("rect", { x: 0.6, y: ry + 1.35, w: W - 1.2, h: 0.008, fill: { color: C.line } });
      }
    });
    footer(s, 6, prospectName);
  }

  // ── SLIDE 7: Pricing (always the same — visible and transparent) ──────
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, "PRICING");
    s.addText("Flat monthly. No per-seat. No hidden onboarding cliff.", {
      x: 0.6, y: 1.0, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 26, bold: true, color: C.ink,
    });
    const tiers = [
      { name: "STARTER", price: "$2,500", extra: "+ $2,500 onboarding", agents: "1–2 agents", extra2: "Slack support · Weekly digest", bg: C.surface, fg: C.ink, accent: C.muted, popular: false },
      { name: "GROWTH", price: "$5,000", extra: "+ $3,500 onboarding", agents: "3–5 agents", extra2: "Quarterly business review · Approvals queue · Portal access", bg: C.ink, fg: "FFFFFF", accent: C.cyan, popular: true },
      { name: "ENTERPRISE", price: "From $10K", extra: "Scoped on call", agents: "Unlimited agents", extra2: "Dedicated lead · On-prem option · SOC 2 in progress", bg: C.surface, fg: C.ink, accent: C.muted, popular: false },
    ];
    const cW = 3.85, cH = 4.3, cY = 2.0, gap = 0.35;
    const tStart = (W - (cW * 3 + gap * 2)) / 2;
    tiers.forEach((t, i) => {
      const cx = tStart + i * (cW + gap);
      s.addShape("roundRect", {
        x: cx, y: cY, w: cW, h: cH, fill: { color: t.bg },
        line: { color: t.popular ? C.cyan : C.line, width: t.popular ? 1.5 : 0.5 }, rectRadius: 0.12,
      });
      if (t.popular) {
        s.addShape("roundRect", {
          x: cx + cW / 2 - 0.85, y: cY - 0.18, w: 1.7, h: 0.36,
          fill: { color: C.cyan }, line: { color: C.cyan, width: 0 }, rectRadius: 0.06,
        });
        s.addText("MOST POPULAR", {
          x: cx + cW / 2 - 0.85, y: cY - 0.18, w: 1.7, h: 0.36,
          fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.ink,
          align: "center", valign: "middle", charSpacing: 10,
        });
      }
      s.addText(t.name, {
        x: cx + 0.3, y: cY + 0.35, w: cW - 0.6, h: 0.35,
        fontFace: FONT_HEAD, fontSize: 11, bold: true, color: t.accent, charSpacing: 15,
      });
      s.addText(t.price, {
        x: cx + 0.3, y: cY + 0.85, w: cW - 0.6, h: 0.85,
        fontFace: FONT_HEAD, fontSize: 40, bold: true, color: t.fg,
      });
      s.addText("/mo", {
        x: cx + 0.3, y: cY + 1.4, w: cW - 0.6, h: 0.35,
        fontFace: FONT_BODY, fontSize: 14, color: t.popular ? "BBBFC9" : C.muted,
      });
      s.addText(t.extra, {
        x: cx + 0.3, y: cY + 1.8, w: cW - 0.6, h: 0.35,
        fontFace: FONT_BODY, fontSize: 12, italic: true, color: t.popular ? "BBBFC9" : C.muted,
      });
      s.addShape("rect", { x: cx + 0.3, y: cY + 2.35, w: cW - 0.6, h: 0.01, fill: { color: t.popular ? "2A3450" : C.line } });
      s.addText(t.agents, {
        x: cx + 0.3, y: cY + 2.55, w: cW - 0.6, h: 0.4,
        fontFace: FONT_HEAD, fontSize: 15, bold: true, color: t.fg,
      });
      s.addText("Build → live in 30 days", {
        x: cx + 0.3, y: cY + 3.0, w: cW - 0.6, h: 0.35,
        fontFace: FONT_BODY, fontSize: 12, color: t.popular ? "D8DCE6" : C.ink2,
      });
      s.addText(t.extra2, {
        x: cx + 0.3, y: cY + 3.4, w: cW - 0.6, h: 0.75,
        fontFace: FONT_BODY, fontSize: 11, color: t.popular ? "BBBFC9" : C.muted, lineSpacingMultiple: 1.4,
      });
    });
    s.addShape("roundRect", {
      x: 0.6, y: 6.5, w: W - 1.2, h: 0.55,
      fill: { color: "FDF4E8" }, line: { color: C.warn, width: 1 }, rectRadius: 0.08,
    });
    s.addText(
      "30-day go-live guarantee  ·  full refund if your first agent isn't live by day 30  ·  no fine print, no partial payment",
      { x: 0.6, y: 6.5, w: W - 1.2, h: 0.55,
        fontFace: FONT_HEAD, fontSize: 13, bold: true,
        color: C.warn, align: "center", valign: "middle" },
    );
    footer(s, 7, prospectName);
  }

  // ── SLIDE 8: Discovery questions for THIS prospect ────────────────────
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, "WHAT I'D LOVE TO LEARN FROM YOU TODAY");
    s.addText("Less pitch. More questions.", {
      x: 0.6, y: 1.0, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 32, bold: true, color: C.ink,
    });
    s.addText("The actual goal of this call:", {
      x: 0.6, y: 1.85, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 16, italic: true, color: C.muted,
    });

    // Build questions — first one is targeted to the company if we have research
    const targetedQ = r.business_summary
      ? {
          q: `Where in ${companyName} do you feel the owner-dependence the hardest right now?`,
          sub: "Sales? Ops? Finance? Customer service? — that's where the first agent goes.",
        }
      : {
          q: "Where do you feel owner-dependence the hardest right now?",
          sub: "Sales? Ops? Finance? Customer service? — that's where the first agent goes.",
        };

    const toolsQ = r.tools_mentioned.length > 0
      ? {
          q: `I saw you mentioned ${r.tools_mentioned.slice(0, 2).join(" and ")} on your site. Anything else in the stack?`,
          sub: "Agents go where the work is — the broader the picture, the better the first install.",
        }
      : {
          q: "What tools do you (or your team) live in day-to-day?",
          sub: "HubSpot? Salesforce? NetSuite? QuickBooks? Slack? — agents go where the work is.",
        };

    const questions = [
      targetedQ,
      toolsQ,
      {
        q: "Have you tried AI tools that fell over?",
        sub: "That's the most common entry point — they've been burned, they're skeptical, they need someone owning it.",
      },
      {
        q: "If we got this working, what would it free you up to do?",
        sub: "Helps us scope the right starter agent vs. the dream-state stack.",
      },
      {
        q: "Realistic budget + timeline if this is a fit?",
        sub: "Sets up pricing conversation without making it the headline.",
      },
    ];
    questions.forEach((qq, i) => {
      const qy = 2.55 + i * 0.85;
      s.addText(String(i + 1).padStart(2, "0"), {
        x: 0.6, y: qy, w: 0.7, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.accent,
      });
      s.addText(qq.q, {
        x: 1.4, y: qy, w: W - 2.0, h: 0.4,
        fontFace: FONT_HEAD, fontSize: 16, bold: true, color: C.ink,
      });
      s.addText(qq.sub, {
        x: 1.4, y: qy + 0.4, w: W - 2.0, h: 0.4,
        fontFace: FONT_BODY, fontSize: 12, italic: true, color: C.muted,
      });
    });
    footer(s, 8, prospectName);
  }

  // ── SLIDE 9: Research notes (Jon's eyes only — for the call) ──────────
  // This slide is intentionally raw — it's the brief we'd write before any
  // call, surfaced in the deck so Jon has it visible while screensharing.
  // Never shown to the prospect in detail (Jon skips past it).
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    eyebrow(s, "RESEARCH NOTES  ·  JON'S EYES");

    s.addText("What I pulled from their site.", {
      x: 0.6, y: 1.0, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 28, bold: true, color: C.ink,
    });

    // Two columns — left: facts, right: pains/tools
    const colY = 2.0, colH = 4.6;
    const leftX = 0.6, leftW = 6.0;
    const rightX = 7.0, rightW = 5.7;

    // LEFT — basics
    const facts: Array<{ label: string; value: string }> = [];
    if (r.business_summary)    facts.push({ label: "What they do",   value: r.business_summary });
    if (r.industry)            facts.push({ label: "Industry tag",   value: r.industry });
    if (r.icp.length)          facts.push({ label: "ICP",            value: r.icp.join(" · ") });
    if (r.positioning_phrase)  facts.push({ label: "Positioning",    value: `"${r.positioning_phrase}"` });
    if (r.founder_name)        facts.push({ label: "Founder",        value: `${r.founder_name}${r.founder_title ? ` · ${r.founder_title}` : ""}` });
    if (!facts.length) facts.push({ label: "—", value: "Scrape returned little usable signal. Review the site directly before the call." });

    let fy = colY;
    facts.forEach(f => {
      s.addText(f.label.toUpperCase(), {
        x: leftX, y: fy, w: leftW, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
      });
      s.addText(f.value, {
        x: leftX, y: fy + 0.3, w: leftW, h: 0.7,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.4,
      });
      fy += 1.0;
      if (fy > colY + colH - 0.5) return;
    });

    // RIGHT — pains + tools
    s.addText("CLIENT PAINS (verbatim)", {
      x: rightX, y: colY, w: rightW, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
    });
    const pains = r.client_pains.length ? r.client_pains : ["—"];
    s.addText(pains.map(pn => `•  ${pn}`).join("\n"), {
      x: rightX, y: colY + 0.35, w: rightW, h: 2.0,
      fontFace: FONT_BODY, fontSize: 12, color: C.ink2, lineSpacingMultiple: 1.4,
    });

    s.addText("TOOLS MENTIONED", {
      x: rightX, y: colY + 2.5, w: rightW, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 12,
    });
    const tools = r.tools_mentioned.length ? r.tools_mentioned.join(" · ") : "(none specifically named)";
    s.addText(tools, {
      x: rightX, y: colY + 2.85, w: rightW, h: 0.7,
      fontFace: FONT_BODY, fontSize: 12, color: C.ink2,
    });

    s.addText("UNCERTAIN / NEEDS REVIEW", {
      x: rightX, y: colY + 3.7, w: rightW, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.warn, charSpacing: 12,
    });
    const uncertain = r.uncertain_fields.length ? r.uncertain_fields.join(", ") : "(extractor reported no uncertainty)";
    s.addText(uncertain, {
      x: rightX, y: colY + 4.05, w: rightW, h: 0.6,
      fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.warn,
    });

    footer(s, 9, prospectName);
  }

  // ── SLIDE 10: Close ────────────────────────────────────────────────────
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    s.addShape("rect", { x: 0.6, y: 0.6, w: 0.6, h: 0.04, fill: { color: C.cyan } });
    s.addText(`THANKS, ${prospectName.split(" ")[0].toUpperCase()}.`, {
      x: 0.6, y: 0.85, w: 12, h: 0.4,
      fontFace: FONT_HEAD, fontSize: 11, bold: true, color: "BBBFC9", charSpacing: 15,
    });
    s.addText("Let's find the\nshape of this together.", {
      x: 0.6, y: 2.0, w: 12, h: 2.6,
      fontFace: FONT_HEAD, fontSize: 56, bold: true, color: "FFFFFF", lineSpacingMultiple: 1.05,
    });
    s.addShape("roundRect", {
      x: 0.6, y: 5.0, w: W - 1.2, h: 1.6,
      fill: { color: "111A2A" }, line: { color: "1A2540", width: 1 }, rectRadius: 0.12,
    });
    s.addText("NEXT STEP", {
      x: 0.9, y: 5.2, w: 5, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 10, bold: true, color: C.cyan, charSpacing: 15,
    });
    s.addText('A 20-minute "workflow audit."', {
      x: 0.9, y: 5.55, w: W - 1.8, h: 0.45,
      fontFace: FONT_HEAD, fontSize: 18, bold: true, color: "FFFFFF",
    });
    s.addText(
      "We pick one workflow that's eating the most of your time, and I'll show you exactly what that looks like with an agent running it. No pressure, no commitment.",
      { x: 0.9, y: 6.05, w: W - 1.8, h: 0.55,
        fontFace: FONT_BODY, fontSize: 13, color: "BBBFC9", lineSpacingMultiple: 1.4 },
    );
    s.addText("Jon  ·  Ramped AI  ·  jon@30dayramp.com  ·  30dayramp.com", {
      x: 0.6, y: H - 0.5, w: 8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: "7A8090",
    });
    s.addText("30-day go-live guarantee. Or it's free.", {
      x: W - 5.4, y: H - 0.5, w: 4.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.cyan, align: "right",
    });
  }

  // Write to a Buffer (pptxgenjs returns base64 by default in Node env;
  // 'nodebuffer' returns a Node Buffer directly)
  const buf = await p.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
