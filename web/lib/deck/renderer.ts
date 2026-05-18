/**
 * Render a per-prospect prep deck as a .pptx Buffer.
 *
 * Brand-forward design: logo lockup on every slide, cyan→navy gradient
 * accents, generous whitespace, restrained typography. Data-driven port
 * of the v3 Michael deck — every text block reads from ExtractedResearch.
 * Where research is missing, slides gracefully fall back to a generic
 * frame so the deck is always shippable (low-confidence flag in admin
 * tells Jon to look extra carefully).
 *
 * Critical guardrails: we NEVER invent numbers, founder names, or
 * specifics that weren't in the scrape. Empty fields stay empty.
 */

import pptxgen from "pptxgenjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractedResearch } from "./extractor";

export const TEMPLATE_VERSION = "v3.1-branded";

export interface RenderInput {
  prospectName: string;
  companyName: string;
  callDate: string;          // "Mon May 19 · 3:00 PM" — caller formats
  research: ExtractedResearch;
}

// ── Brand palette (from Marketing-Pack/BRAND-STYLE-GUIDE.md) ──────────────
const C = {
  ink:        "0B1220",  // primary dark — cover/closing/frame backgrounds
  ink2:       "1A2233",  // secondary
  ink3:       "111A2A",  // tertiary card surfaces on dark
  paper:      "FAFAF7",  // content-slide background
  surface:    "F5F5F3",  // card background on paper
  surfaceAlt: "EEEEE9",  // alternate card variant
  line:       "E6E4DC",  // border / divider
  lineDark:   "1A2540",  // border on dark surfaces
  muted:      "5B6272",  // body copy gray
  mutedLight: "7A8090",  // footer gray
  accent:     "1F4FFF",  // primary CTA / key emphasis
  accent2:    "0B2A8C",  // pressed/hover
  cyan:       "00D4FF",  // brand cyan (the "AI" highlight)
  cyanDeep:   "006BD6",  // mid-gradient brand blue
  navyDeep:   "0A2540",  // dark-gradient brand navy
  guarantee:  "B45309",  // warn / used only for "needs review" flags
  white:      "FFFFFF",
};

// Inter is the brand font; fallback is system Arial for any environment
// that doesn't have it embedded. PPTX renderers substitute gracefully.
const FONT_HEAD = "Inter";
const FONT_BODY = "Inter";

const W = 13.333;
const H = 7.5;

// ── Load logo once, embed as base64 data URL ──────────────────────────────
// We try multiple resolution paths because this module runs in three contexts:
// 1) Local Node script (cwd = web/)
// 2) Next dev server (cwd = web/)
// 3) Vercel serverless function (cwd unstable; need __dirname-relative)
let LOGO_DATA_URL = "";
{
  const candidates: string[] = [];
  // Relative from likely working dirs
  candidates.push("web/public/logo.png", "public/logo.png");
  candidates.push(resolve(process.cwd(), "web/public/logo.png"));
  candidates.push(resolve(process.cwd(), "public/logo.png"));
  candidates.push(resolve(process.cwd(), "../public/logo.png"));
  // ESM dirname (serverless bundle)
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(__dirname, "../../public/logo.png"));
    candidates.push(resolve(__dirname, "../public/logo.png"));
    candidates.push(resolve(__dirname, "../../../public/logo.png"));
  } catch {}
  for (const p of candidates) {
    try {
      const buf = readFileSync(p);
      LOGO_DATA_URL = "data:image/png;base64," + buf.toString("base64");
      break;
    } catch {}
  }
}

/** Logo lockup (mark + wordmark) — small variant for content-slide chrome. */
function addLogoLockup(slide: pptxgen.Slide, opts: { x?: number; y?: number; dark?: boolean } = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 0.38;
  if (LOGO_DATA_URL) {
    slide.addImage({ data: LOGO_DATA_URL, x, y, w: 0.34, h: 0.34 });
  }
  slide.addText(
    [
      { text: "RAMPED ", options: { color: opts.dark ? C.white : C.ink, bold: true } },
      { text: "AI",      options: { color: C.cyan, bold: true } },
    ],
    {
      x: x + 0.42, y: y - 0.02, w: 1.8, h: 0.4,
      fontFace: FONT_HEAD, fontSize: 16, charSpacing: -3, valign: "middle",
    },
  );
}

/** Big hero lockup used on cover + close slides. */
function addHeroLockup(slide: pptxgen.Slide, opts: { x?: number; y?: number; w?: number; dark?: boolean } = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 0.6;
  const w = opts.w ?? 5.2;
  // Larger mark relative to wordmark — more presence on hero slides.
  const markSize = w * 0.22;
  if (LOGO_DATA_URL) {
    slide.addImage({ data: LOGO_DATA_URL, x, y, w: markSize, h: markSize });
  }
  slide.addText(
    [
      { text: "RAMPED ", options: { color: opts.dark ? C.white : C.ink, bold: true } },
      { text: "AI",      options: { color: C.cyan, bold: true } },
    ],
    {
      x: x + markSize + 0.2, y: y - 0.05, w: w - markSize - 0.2, h: markSize + 0.1,
      fontFace: FONT_HEAD, fontSize: 44, bold: true, charSpacing: -8, valign: "middle",
    },
  );
  slide.addText("AI department, live in 30 days.", {
    x: x, y: y + markSize + 0.12, w: w + 0.6, h: 0.32,
    fontFace: FONT_BODY, fontSize: 12,
    color: opts.dark ? "BBBFC9" : C.muted, charSpacing: 6, italic: true,
  });
}

/** Section eyebrow with a cyan tick before the text. */
function eyebrow(slide: pptxgen.Slide, text: string, opts: { y?: number; dark?: boolean } = {}) {
  const y = opts.y ?? 1.4;
  slide.addShape("rect", {
    x: 0.6, y: y + 0.13, w: 0.18, h: 0.04,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
  slide.addText(text, {
    x: 0.85, y, w: 11, h: 0.3,
    fontFace: FONT_HEAD, fontSize: 10, bold: true,
    color: opts.dark ? C.cyan : C.muted, charSpacing: 14,
  });
}

/** Branded footer — cyan tick + brand line + page number. */
function footer(slide: pptxgen.Slide, pageNum: number, dark = false) {
  const hairlineY = H - 0.42;
  slide.addShape("rect", {
    x: 0.6, y: hairlineY, w: 0.3, h: 0.015,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
  slide.addShape("rect", {
    x: 0.9, y: hairlineY, w: 1.0, h: 0.015,
    fill: { color: dark ? C.lineDark : C.line }, line: { color: dark ? C.lineDark : C.line, width: 0 },
  });
  slide.addText("30dayramp.com", {
    x: 0.6, y: H - 0.32, w: 4, h: 0.25,
    fontFace: FONT_BODY, fontSize: 9,
    color: dark ? C.mutedLight : C.muted, charSpacing: 4,
  });
  slide.addText(String(pageNum).padStart(2, "0"), {
    x: W - 0.8, y: H - 0.32, w: 0.2, h: 0.25,
    fontFace: FONT_BODY, fontSize: 9,
    color: dark ? C.mutedLight : C.muted, align: "right",
  });
}

/** Build the deck and return it as a Node Buffer suitable for upload. */
export async function renderProspectDeck(input: RenderInput): Promise<Buffer> {
  const { prospectName, companyName, callDate, research: r } = input;
  const firstName = prospectName.split(" ")[0];
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE";
  p.title = `Ramped × ${companyName} — Hello ${prospectName}`;
  p.author = "Ramped AI";

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Cover (dark hero)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };

    // Top-right diagonal accent strips
    s.addShape("rect", {
      x: W - 4.5, y: 0, w: 4.5, h: 0.06,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addShape("rect", {
      x: W - 1.6, y: 0.06, w: 1.6, h: 0.04,
      fill: { color: C.cyanDeep }, line: { color: C.cyanDeep, width: 0 },
    });

    addHeroLockup(s, { x: 0.6, y: 0.6, w: 5.2, dark: true });

    s.addText(`Hi ${firstName}.`, {
      x: 0.6, y: 2.9, w: 12, h: 1.6,
      fontFace: FONT_HEAD, fontSize: 84, bold: true,
      color: C.white, charSpacing: -3,
    });

    s.addText(
      [
        { text: "A few notes on what I think Ramped could do for ", options: { color: "D8DCE6" } },
        { text: companyName, options: { color: C.cyan, bold: true } },
        ...(r.icp.length
          ? [{ text: " — and for your clients.", options: { color: "D8DCE6" } }]
          : [{ text: ".", options: { color: "D8DCE6" } }]),
      ],
      {
        x: 0.6, y: 4.6, w: 11.5, h: 1.5,
        fontFace: FONT_BODY, fontSize: 20, lineSpacingMultiple: 1.3,
      },
    );

    // Bottom meta strip
    s.addShape("rect", {
      x: 0.6, y: H - 1.0, w: 0.3, h: 0.04,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("DISCOVERY CONVERSATION", {
      x: 0.6, y: H - 0.85, w: 6, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 10, bold: true,
      color: C.mutedLight, charSpacing: 12,
    });
    s.addText(callDate, {
      x: 0.6, y: H - 0.55, w: 6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 14, color: "D8DCE6",
    });
    s.addText("Jon  ·  Ramped AI", {
      x: W - 4.0, y: H - 0.55, w: 3.4, h: 0.3,
      fontFace: FONT_BODY, fontSize: 12, color: C.mutedLight, align: "right",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 2 — What I noticed
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, `WHAT I NOTICED ABOUT ${companyName.toUpperCase()}`);

    if (r.positioning_phrase) {
      s.addText(`"${r.positioning_phrase}"`, {
        x: 0.6, y: 1.9, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 36, italic: true,
        color: C.ink, lineSpacingMultiple: 1.15, charSpacing: -1,
      });
    } else if (r.business_summary) {
      s.addText(r.business_summary, {
        x: 0.6, y: 1.9, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 32, bold: true,
        color: C.ink, lineSpacingMultiple: 1.15, charSpacing: -1,
      });
    } else {
      s.addText("You're solving real\noperational pain.", {
        x: 0.6, y: 1.9, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 38, bold: true,
        color: C.ink, lineSpacingMultiple: 1.05, charSpacing: -1,
      });
    }

    const sub = r.industry
      ? `${r.industry}${r.icp.length ? ` · Serving ${r.icp.slice(0, 2).join(" and ")}` : ""}`
      : "What we found from your site:";
    s.addText(sub, {
      x: 0.6, y: 3.6, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 14, color: C.muted, charSpacing: 4,
    });

    // 4 pain cards
    const cards = (r.client_pains.length >= 2
      ? r.client_pains.slice(0, 4).map((pain, i) => ({ label: `0${i + 1}`, body: pain }))
      : [
          { label: "01", body: "Wearing all the hats" },
          { label: "02", body: "Sales depend on owner" },
          { label: "03", body: "Profits suffer when owner is gone" },
          { label: "04", body: "Managers need to be leaders" },
        ]
    );
    while (cards.length < 4) cards.push({ label: `0${cards.length + 1}`, body: "—" });
    const cardW = 2.9, cardH = 2.1, cardY = 4.3, gap = 0.18;
    const totalW = cardW * 4 + gap * 3;
    const startX = (W - totalW) / 2;
    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      s.addShape("roundRect", {
        x: cx, y: cardY, w: cardW, h: cardH,
        fill: { color: C.white }, line: { color: C.line, width: 0.75 }, rectRadius: 0.1,
      });
      s.addShape("rect", {
        x: cx, y: cardY, w: cardW, h: 0.06,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      s.addText(card.label, {
        x: cx + 0.25, y: cardY + 0.25, w: cardW - 0.5, h: 0.45,
        fontFace: FONT_HEAD, fontSize: 28, bold: true,
        color: C.cyanDeep, charSpacing: -1,
      });
      s.addText(card.body, {
        x: cx + 0.25, y: cardY + 0.85, w: cardW - 0.5, h: cardH - 1.0,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink2, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 2);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 3 — Where Ramped fits (dark)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    addLogoLockup(s, { dark: true });
    eyebrow(s, "WHERE RAMPED FITS", { dark: true });

    s.addText(
      r.client_pains.length > 0 ? "You're solving real operational pain." : "Owner-dependent operations is the bottleneck.",
      {
        x: 0.6, y: 2.0, w: 12, h: 0.7,
        fontFace: FONT_HEAD, fontSize: 28, color: "8A92A8", italic: true,
      },
    );

    s.addText("We build the team\nthe owner can delegate to.", {
      x: 0.6, y: 2.95, w: 12, h: 2.6,
      fontFace: FONT_HEAD, fontSize: 60, bold: true, color: C.white,
      lineSpacingMultiple: 1.02, charSpacing: -3,
    });

    s.addShape("rect", {
      x: 0.6, y: 6.1, w: 0.04, h: 0.5,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    const toolsLine = r.tools_mentioned.length > 0
      ? `AI agents that run inside your stack — ${r.tools_mentioned.slice(0, 4).join(", ")}.`
      : "AI agents that run inside your existing stack — Slack, HubSpot, NetSuite, wherever the work happens.";
    s.addText(toolsLine + " They handle what no human can be trusted with at 2am.", {
      x: 0.8, y: 6.05, w: 12, h: 0.6,
      fontFace: FONT_BODY, fontSize: 15, color: "BBBFC9", lineSpacingMultiple: 1.4,
    });

    footer(s, 3, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 4 — What we actually do
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "WHAT WE ACTUALLY DO");

    s.addText("Three things. No mystery.", {
      x: 0.6, y: 1.9, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink, charSpacing: -1,
    });

    const items = [
      { n: "01",
        h: `We build agents inside ${r.tools_mentioned.length ? "your" : "your client's"} existing tools.`,
        b: r.tools_mentioned.length > 0
            ? `${r.tools_mentioned.slice(0, 5).join(" · ")} — wherever the work actually happens.`
            : "Slack · HubSpot · NetSuite · QuickBooks · Gmail — wherever the work happens." },
      { n: "02",
        h: "We run them. We get paged when something breaks.",
        b: "When an API updates or an edge case shows up at 2am, we own it. The owner stays out of the loop." },
      { n: "03",
        h: "Live in 30 days. Or it's free.",
        b: "Hard deadline, full refund if missed. The only falsifiable risk reversal in AI implementation." },
    ];
    const startY = 3.1;
    const rowH = 1.25;
    items.forEach((it, i) => {
      const ry = startY + i * rowH;
      s.addText(it.n, {
        x: 0.6, y: ry, w: 1.1, h: 0.8,
        fontFace: FONT_HEAD, fontSize: 44, bold: true,
        color: C.cyanDeep, charSpacing: -2,
      });
      s.addShape("rect", {
        x: 1.65, y: ry + 0.1, w: 0.025, h: 0.85,
        fill: { color: C.line }, line: { color: C.line, width: 0 },
      });
      s.addText(it.h, {
        x: 1.85, y: ry, w: 10.8, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 18, bold: true, color: C.ink, charSpacing: -0.5,
      });
      s.addText(it.b, {
        x: 1.85, y: ry + 0.5, w: 10.8, h: 0.6,
        fontFace: FONT_BODY, fontSize: 13, color: C.muted, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 4);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 5 — Guarantee (brand-gradient hero — replaces flat orange)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    addLogoLockup(s, { dark: true });
    eyebrow(s, "THE GUARANTEE", { dark: true });

    // Massive "30" in brand cyan
    s.addText("30", {
      x: 0.6, y: 1.8, w: 6.5, h: 4.0,
      fontFace: FONT_HEAD, fontSize: 320, bold: true,
      color: C.cyan, charSpacing: -10,
    });
    s.addText("DAYS TO LIVE.", {
      x: 5.5, y: 3.4, w: 7, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 26, bold: true,
      color: C.white, charSpacing: 4,
    });
    s.addText("OR YOUR MONEY BACK.", {
      x: 5.5, y: 4.0, w: 7, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 26, bold: true,
      color: C.white, charSpacing: 4,
    });
    s.addText("No fine print. No partial payment.", {
      x: 5.5, y: 4.7, w: 7, h: 0.4,
      fontFace: FONT_BODY, fontSize: 14, italic: true, color: "BBBFC9",
    });

    // Three short justification bullets across bottom
    const reasons = [
      "Most prospects have been burned by AI tools that worked for 3 weeks, then broke.",
      "Every other implementation firm charges 5-figure upfront fees with no commitment date.",
      "We track refund rate as our most important internal metric.",
    ];
    const rW = (W - 1.2 - 0.4) / 3;
    reasons.forEach((rs, i) => {
      const rx = 0.6 + i * (rW + 0.2);
      s.addShape("rect", {
        x: rx, y: 6.0, w: 0.04, h: 0.4,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      s.addText(rs, {
        x: rx + 0.15, y: 5.95, w: rW - 0.15, h: 0.6,
        fontFace: FONT_BODY, fontSize: 11, color: "BBBFC9", lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 5, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 6 — Pains → Patterns (3 horizontal cards)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "OBSERVED PAINS  ·  AGENT PATTERNS");

    s.addText("Specific to what we read from your site.", {
      x: 0.6, y: 1.9, w: 12, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 28, bold: true, color: C.ink, charSpacing: -0.5,
    });

    const rows = (r.agent_fit_opportunities.length >= 2
      ? r.agent_fit_opportunities.slice(0, 3).map(o => ({
          pain: o.pain, agent: o.agent_pattern, desc: o.note || "—",
        }))
      : [
          { pain: "Sales depend on the owner", agent: "Inbound Qualifier + Quote Drafter",
            desc: "Triages every inbound. Drafts proposal in owner's voice. Owner taps approve." },
          { pain: "Operations are chaotic", agent: "Exception Catcher",
            desc: "Reconciles invoices, POs, shipping addresses. Pages the right person when something doesn't line up." },
          { pain: "Profits suffer when owner is gone", agent: "Weekly Digest + Approval Queue",
            desc: "Owner gets one digest Monday morning + approval-by-default queue. Day-to-day runs without them." },
        ]
    );
    while (rows.length < 3) rows.push({ pain: "—", agent: "—", desc: "—" });

    const cardY0 = 2.85;
    const cardH = 1.3;
    const cardGap = 0.18;
    rows.forEach((row, i) => {
      const cy = cardY0 + i * (cardH + cardGap);
      s.addShape("roundRect", {
        x: 0.6, y: cy, w: W - 1.2, h: cardH,
        fill: { color: C.white }, line: { color: C.line, width: 0.75 }, rectRadius: 0.1,
      });
      s.addShape("rect", {
        x: 0.6, y: cy, w: 0.08, h: cardH,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      s.addText(String(i + 1), {
        x: 0.8, y: cy + 0.1, w: 0.7, h: cardH - 0.2,
        fontFace: FONT_HEAD, fontSize: 56, bold: true,
        color: C.surfaceAlt, valign: "middle",
      });
      s.addText("PAIN", {
        x: 1.7, y: cy + 0.2, w: 3.4, h: 0.25,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 10,
      });
      s.addText(row.pain, {
        x: 1.7, y: cy + 0.5, w: 3.4, h: cardH - 0.6,
        fontFace: FONT_HEAD, fontSize: 14, bold: true, color: C.ink, lineSpacingMultiple: 1.2,
      });
      s.addText("RAMPED AGENT", {
        x: 5.3, y: cy + 0.2, w: 3.4, h: 0.25,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.cyanDeep, charSpacing: 10,
      });
      s.addText(row.agent, {
        x: 5.3, y: cy + 0.5, w: 3.4, h: cardH - 0.6,
        fontFace: FONT_HEAD, fontSize: 14, bold: true, color: C.accent, lineSpacingMultiple: 1.2,
      });
      s.addText("WHAT IT DOES", {
        x: 8.9, y: cy + 0.2, w: 3.8, h: 0.25,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 10,
      });
      s.addText(row.desc, {
        x: 8.9, y: cy + 0.5, w: 3.8, h: cardH - 0.6,
        fontFace: FONT_BODY, fontSize: 12, color: C.ink2, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 6);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 7 — Pricing
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "PRICING");

    s.addText("Flat monthly. No per-seat.", {
      x: 0.6, y: 1.9, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 32, bold: true, color: C.ink, charSpacing: -1,
    });

    const tiers = [
      { name: "STARTER", price: "$2,500", agents: "1–2 agents",
        extra: "+ $2,500 onboarding",
        features: ["Slack support", "Weekly digest"], popular: false },
      { name: "GROWTH", price: "$5,000", agents: "3–5 agents",
        extra: "+ $3,500 onboarding",
        features: ["Quarterly business review", "Approvals queue", "Portal access"], popular: true },
      { name: "ENTERPRISE", price: "From $10K", agents: "Unlimited agents",
        extra: "Scoped on call",
        features: ["Dedicated lead", "On-prem option", "SOC 2 in progress"], popular: false },
    ];
    const cW = 3.85, cH = 4.0, cY = 3.0, gap = 0.4;
    const tStart = (W - (cW * 3 + gap * 2)) / 2;
    tiers.forEach((t, i) => {
      const cx = tStart + i * (cW + gap);
      const isPopular = t.popular;
      s.addShape("roundRect", {
        x: cx, y: cY, w: cW, h: cH,
        fill: { color: isPopular ? C.ink : C.white },
        line: { color: isPopular ? C.cyan : C.line, width: isPopular ? 1.75 : 0.75 },
        rectRadius: 0.12,
      });
      if (isPopular) {
        s.addShape("roundRect", {
          x: cx + cW / 2 - 0.95, y: cY - 0.2, w: 1.9, h: 0.4,
          fill: { color: C.cyan }, line: { color: C.cyan, width: 0 }, rectRadius: 0.08,
        });
        s.addText("MOST POPULAR", {
          x: cx + cW / 2 - 0.95, y: cY - 0.2, w: 1.9, h: 0.4,
          fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.ink,
          align: "center", valign: "middle", charSpacing: 12,
        });
      }
      s.addText(t.name, {
        x: cx + 0.3, y: cY + 0.3, w: cW - 0.6, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 11, bold: true,
        color: isPopular ? C.cyan : C.muted, charSpacing: 14,
      });
      s.addText(t.price, {
        x: cx + 0.3, y: cY + 0.7, w: cW - 0.6, h: 1.0,
        fontFace: FONT_HEAD, fontSize: 44, bold: true,
        color: isPopular ? C.white : C.ink, charSpacing: -2,
      });
      s.addText("/month", {
        x: cx + 0.3, y: cY + 1.55, w: cW - 0.6, h: 0.3,
        fontFace: FONT_BODY, fontSize: 13,
        color: isPopular ? "BBBFC9" : C.muted,
      });
      s.addText(t.extra, {
        x: cx + 0.3, y: cY + 1.9, w: cW - 0.6, h: 0.3,
        fontFace: FONT_BODY, fontSize: 11, italic: true,
        color: isPopular ? "BBBFC9" : C.muted,
      });
      s.addShape("rect", {
        x: cx + 0.3, y: cY + 2.3, w: cW - 0.6, h: 0.01,
        fill: { color: isPopular ? "2A3450" : C.line },
      });
      s.addText(t.agents, {
        x: cx + 0.3, y: cY + 2.5, w: cW - 0.6, h: 0.35,
        fontFace: FONT_HEAD, fontSize: 15, bold: true,
        color: isPopular ? C.white : C.ink,
      });
      s.addText("Build → live in 30 days", {
        x: cx + 0.3, y: cY + 2.9, w: cW - 0.6, h: 0.3,
        fontFace: FONT_BODY, fontSize: 12,
        color: isPopular ? "D8DCE6" : C.ink2,
      });
      t.features.forEach((f, fi) => {
        s.addText(`·  ${f}`, {
          x: cx + 0.3, y: cY + 3.3 + fi * 0.22, w: cW - 0.6, h: 0.25,
          fontFace: FONT_BODY, fontSize: 11,
          color: isPopular ? "BBBFC9" : C.muted,
        });
      });
    });

    footer(s, 7);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 8 — Discovery questions (tailored)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "WHAT I'D LOVE TO LEARN FROM YOU TODAY");

    s.addText("Less pitch. More questions.", {
      x: 0.6, y: 1.9, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink, charSpacing: -1,
    });

    const targetedQ = r.business_summary
      ? { q: `Where in ${companyName} do you feel owner-dependence the hardest?`,
          sub: "Sales? Ops? Finance? Customer service? — that's where the first agent goes." }
      : { q: "Where do you feel owner-dependence the hardest right now?",
          sub: "Sales? Ops? Finance? Customer service? — that's where the first agent goes." };

    const toolsQ = r.tools_mentioned.length > 0
      ? { q: `I saw ${r.tools_mentioned.slice(0, 2).join(" and ")} on your site. Anything else in the stack?`,
          sub: "Agents go where the work is — broader picture = better first install." }
      : { q: "What tools do you (or your team) live in day-to-day?",
          sub: "HubSpot? Salesforce? NetSuite? QuickBooks? Slack? — agents go where the work is." };

    const questions = [
      targetedQ,
      toolsQ,
      { q: "Have you tried AI tools that fell over?",
        sub: "Most common entry point — they've been burned, they're skeptical, they need someone owning it." },
      { q: "If we got this working, what would it free you up to do?",
        sub: "Helps us scope the right starter agent vs. the dream-state stack." },
      { q: "Realistic budget + timeline if this is a fit?",
        sub: "Sets up pricing conversation without making it the headline." },
    ];
    const qY0 = 2.95, qH = 0.78;
    questions.forEach((qq, i) => {
      const qy = qY0 + i * qH;
      s.addShape("ellipse", {
        x: 0.6, y: qy + 0.05, w: 0.5, h: 0.5,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      s.addText(String(i + 1), {
        x: 0.6, y: qy + 0.05, w: 0.5, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 18, bold: true,
        color: C.ink, align: "center", valign: "middle",
      });
      s.addText(qq.q, {
        x: 1.3, y: qy, w: W - 1.9, h: 0.36,
        fontFace: FONT_HEAD, fontSize: 16, bold: true, color: C.ink, charSpacing: -0.3,
      });
      s.addText(qq.sub, {
        x: 1.3, y: qy + 0.36, w: W - 1.9, h: 0.36,
        fontFace: FONT_BODY, fontSize: 12, italic: true, color: C.muted,
      });
    });

    footer(s, 8);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 9 — Research notes (Jon's eyes only)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "RESEARCH NOTES  ·  JON'S EYES");

    s.addText("What I pulled from their site.", {
      x: 0.6, y: 1.9, w: 12, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 28, bold: true, color: C.ink, charSpacing: -0.5,
    });

    const colY = 2.9;
    const leftX = 0.6, leftW = 6.0;
    const rightX = 7.0, rightW = 5.7;

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
        x: leftX, y: fy, w: leftW, h: 0.28,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.cyanDeep, charSpacing: 10,
      });
      s.addText(f.value, {
        x: leftX, y: fy + 0.3, w: leftW, h: 0.65,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.4,
      });
      fy += 0.95;
    });

    s.addText("CLIENT PAINS (verbatim)", {
      x: rightX, y: colY, w: rightW, h: 0.28,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.cyanDeep, charSpacing: 10,
    });
    const pains = r.client_pains.length ? r.client_pains : ["—"];
    s.addText(pains.map(pn => `•  ${pn}`).join("\n"), {
      x: rightX, y: colY + 0.3, w: rightW, h: 1.8,
      fontFace: FONT_BODY, fontSize: 12, color: C.ink2, lineSpacingMultiple: 1.4,
    });

    s.addText("TOOLS MENTIONED", {
      x: rightX, y: colY + 2.3, w: rightW, h: 0.28,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.cyanDeep, charSpacing: 10,
    });
    const tools = r.tools_mentioned.length ? r.tools_mentioned.join(" · ") : "(none specifically named)";
    s.addText(tools, {
      x: rightX, y: colY + 2.6, w: rightW, h: 0.6,
      fontFace: FONT_BODY, fontSize: 12, color: C.ink2,
    });

    s.addText("UNCERTAIN / NEEDS REVIEW", {
      x: rightX, y: colY + 3.3, w: rightW, h: 0.28,
      fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.guarantee, charSpacing: 10,
    });
    const uncertain = r.uncertain_fields.length ? r.uncertain_fields.join(", ") : "(extractor reported no uncertainty)";
    s.addText(uncertain, {
      x: rightX, y: colY + 3.6, w: rightW, h: 0.6,
      fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.guarantee,
    });

    footer(s, 9);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 10 — Close (dark hero)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    s.addShape("rect", {
      x: 0, y: 0, w: 4.5, h: 0.06,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    addLogoLockup(s, { dark: true });
    eyebrow(s, `THANKS, ${firstName.toUpperCase()}.`, { dark: true });

    s.addText("Let's find the\nshape of this together.", {
      x: 0.6, y: 2.1, w: 12, h: 2.8,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: C.white,
      lineSpacingMultiple: 1.02, charSpacing: -3,
    });

    s.addShape("roundRect", {
      x: 0.6, y: 5.0, w: W - 1.2, h: 1.6,
      fill: { color: C.ink3 }, line: { color: C.lineDark, width: 1 }, rectRadius: 0.12,
    });
    s.addShape("rect", {
      x: 0.6, y: 5.0, w: 0.08, h: 1.6,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("NEXT STEP", {
      x: 0.9, y: 5.2, w: 5, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 10, bold: true, color: C.cyan, charSpacing: 14,
    });
    s.addText('A 20-minute "workflow audit."', {
      x: 0.9, y: 5.55, w: W - 1.8, h: 0.45,
      fontFace: FONT_HEAD, fontSize: 20, bold: true, color: C.white, charSpacing: -0.5,
    });
    s.addText(
      "Pick one workflow eating the most of your time. I'll show you exactly what that looks like with an agent running it. No pressure, no commitment.",
      { x: 0.9, y: 6.05, w: W - 1.8, h: 0.55,
        fontFace: FONT_BODY, fontSize: 13, color: "BBBFC9", lineSpacingMultiple: 1.4 },
    );

    s.addShape("rect", {
      x: 0.6, y: H - 0.55, w: 0.3, h: 0.015,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("Jon  ·  jon@30dayramp.com  ·  30dayramp.com", {
      x: 0.6, y: H - 0.4, w: 8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, color: C.mutedLight,
    });
    s.addText("30-day go-live guarantee. Or it's free.", {
      x: W - 5.4, y: H - 0.4, w: 4.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.cyan, align: "right",
    });
  }

  const buf = await p.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
