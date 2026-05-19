/**
 * Render a per-prospect prep deck as a .pptx Buffer.
 *
 * v4.0 — premium consulting-grade redesign per Jon's spec:
 *   - 11 slides (added "How an agent works" workflow diagram +
 *     "The math" before/after comparison; dropped Jon's-eyes
 *     research-notes slide since this deck is screenshare-only
 *     and prep notes belong on a second monitor, not the deck)
 *   - Extreme minimalism: one dominant message per slide
 *   - Brand cyan #00D4FF as the single recurring motif
 *   - All slides built around a 0.6" left/right margin grid
 *     with eyebrow at y=1.4" and headline at y=1.9"
 *
 * Data-driven where research exists; falls back to canonical content
 * (with universal phrasing — never invents prospect-specific facts).
 *
 * GUARDRAILS (still): never invents numbers, founder names, or
 * specifics that weren't in the scrape. The "math" slide on slide 7
 * uses generic "typical service business" framing so Jon can verbally
 * personalize during the call.
 */

import pptxgen from "pptxgenjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtractedResearch } from "./extractor";

export const TEMPLATE_VERSION = "v4.0";

export interface RenderInput {
  prospectName: string;
  companyName: string;
  callDate: string;          // "Mon May 19 · 3:00 PM" — caller formats
  research: ExtractedResearch;
}

// ── Brand palette (from Marketing-Pack/BRAND-STYLE-GUIDE.md) ──────────────
// Brand cyan is #00D4FF (matches the lockup SVG gradient endpoint).
// All other colors derive from the guide; nothing introduced ad-hoc.
const C = {
  ink:        "0A2540",  // primary dark (slightly warmer than #0B1220 — matches logo gradient base)
  ink2:       "1A2233",  // secondary text on light
  ink3:       "111A2A",  // tertiary surface on dark
  paper:      "FAFAF7",  // content-slide background
  surface:    "F5F5F3",  // card background on paper
  surfaceAlt: "EEEEE9",  // ghost numerals, subtle variants
  line:       "E6E4DC",  // border / divider on light
  lineDark:   "1A2540",  // border / divider on dark
  muted:      "5B6272",  // body copy gray
  mutedLight: "7A8090",  // footer gray
  accent:     "1F4FFF",  // agent-name accent blue (use sparingly)
  cyan:       "00D4FF",  // PRIMARY ACCENT — brand cyan
  cyanDeep:   "006BD6",  // mid-gradient brand blue
  white:      "FFFFFF",
};

const FONT_HEAD = "Inter";
const FONT_BODY = "Inter";

const W = 13.333;
const H = 7.5;

// ── Load logo once, embed as base64 data URL ──────────────────────────────
let LOGO_DATA_URL = "";
{
  const candidates: string[] = [];
  candidates.push("web/public/logo.png", "public/logo.png");
  candidates.push(resolve(process.cwd(), "web/public/logo.png"));
  candidates.push(resolve(process.cwd(), "public/logo.png"));
  candidates.push(resolve(process.cwd(), "../public/logo.png"));
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

/** Small logo lockup — top-left of every content slide. */
function addLogoLockup(slide: pptxgen.Slide, opts: { x?: number; y?: number; dark?: boolean } = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 0.4;
  if (LOGO_DATA_URL) {
    slide.addImage({ data: LOGO_DATA_URL, x, y, w: 0.34, h: 0.34 });
  }
  slide.addText(
    [
      { text: "RAMPED ", options: { color: opts.dark ? C.white : C.ink, bold: true } },
      { text: "AI",      options: { color: C.cyan,                       bold: true } },
    ],
    {
      x: x + 0.42, y: y - 0.02, w: 1.8, h: 0.38,
      fontFace: FONT_HEAD, fontSize: 16, valign: "middle",
    },
  );
}

/** Hero lockup — cover + close only. */
function addHeroLockup(slide: pptxgen.Slide, opts: { x?: number; y?: number; w?: number; dark?: boolean } = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 0.6;
  const w = opts.w ?? 5.2;
  const markSize = w * 0.22;
  if (LOGO_DATA_URL) {
    slide.addImage({ data: LOGO_DATA_URL, x, y, w: markSize, h: markSize });
  }
  slide.addText(
    [
      { text: "RAMPED ", options: { color: opts.dark ? C.white : C.ink, bold: true } },
      { text: "AI",      options: { color: C.cyan,                       bold: true } },
    ],
    {
      x: x + markSize + 0.2, y: y - 0.05, w: w - markSize - 0.2, h: markSize + 0.1,
      fontFace: FONT_HEAD, fontSize: 44, bold: true, valign: "middle",
    },
  );
  slide.addText("AI department, live in 30 days.", {
    x, y: y + markSize + 0.12, w: w + 0.6, h: 0.32,
    fontFace: FONT_BODY, fontSize: 12, italic: true,
    color: opts.dark ? "BBBFC9" : C.muted, charSpacing: 0.5,
  });
}

/** Section eyebrow — cyan tick + uppercase label at y=1.4. */
function eyebrow(slide: pptxgen.Slide, text: string, opts: { y?: number; dark?: boolean } = {}) {
  const y = opts.y ?? 1.4;
  slide.addShape("rect", {
    x: 0.6, y: y + 0.13, w: 0.2, h: 0.04,
    fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
  });
  slide.addText(text, {
    x: 0.88, y, w: 11.5, h: 0.3,
    fontFace: FONT_HEAD, fontSize: 10, bold: true,
    color: opts.dark ? C.cyan : C.muted, charSpacing: 0.5,
  });
}

/** Branded footer with cyan tick + hairline + domain + page number. */
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
    color: dark ? C.mutedLight : C.muted,
  });
  slide.addText(String(pageNum).padStart(2, "0"), {
    x: W - 0.8, y: H - 0.32, w: 0.2, h: 0.25,
    fontFace: FONT_BODY, fontSize: 9,
    color: dark ? C.mutedLight : C.muted, align: "right",
  });
}

/** Build the deck. */
export async function renderProspectDeck(input: RenderInput): Promise<Buffer> {
  const { prospectName, companyName, callDate, research: r } = input;
  const firstName = prospectName.split(" ")[0];
  const p = new pptxgen();
  p.layout = "LAYOUT_WIDE";
  p.title = `Ramped × ${companyName} — Hello ${prospectName}`;
  p.author = "Ramped AI";

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 1 — Cover · "Hi Michael."
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };

    // Top-right diagonal accent strips (recurring motif on cover + close)
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
      fontFace: FONT_HEAD, fontSize: 88, bold: true, color: C.white,
    });

    s.addText(
      [
        { text: "A few notes on what Ramped could do for ", options: { color: "D8DCE6" } },
        { text: companyName, options: { color: C.cyan, bold: true } },
        ...(r.icp.length
          ? [{ text: " — and for your clients.", options: { color: "D8DCE6" } }]
          : [{ text: ".", options: { color: "D8DCE6" } }]),
      ],
      {
        x: 0.6, y: 4.7, w: 11.5, h: 1.5,
        fontFace: FONT_BODY, fontSize: 22, lineSpacingMultiple: 1.3,
      },
    );

    // Bottom-left meta chip
    s.addShape("rect", {
      x: 0.6, y: H - 1.0, w: 0.04, h: 0.6,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("DISCOVERY CONVERSATION", {
      x: 0.78, y: H - 0.95, w: 6, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 10, bold: true,
      color: C.mutedLight, charSpacing: 0.5,
    });
    s.addText(callDate, {
      x: 0.78, y: H - 0.62, w: 6, h: 0.3,
      fontFace: FONT_BODY, fontSize: 14, color: "D8DCE6",
    });
    s.addText("Jon  ·  Ramped AI", {
      x: W - 4.0, y: H - 0.62, w: 3.4, h: 0.3,
      fontFace: FONT_BODY, fontSize: 12, color: C.mutedLight, align: "right",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 2 — What I noticed.
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, `WHAT I NOTICED ABOUT ${companyName.toUpperCase()}`);

    // Pull-quote headline (verbatim positioning if we have it)
    if (r.positioning_phrase) {
      s.addText(`"${r.positioning_phrase}"`, {
        x: 0.6, y: 1.95, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 42, italic: true, bold: true,
        color: C.ink, lineSpacingMultiple: 1.1,
      });
    } else if (r.business_summary) {
      s.addText(r.business_summary, {
        x: 0.6, y: 1.95, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink, lineSpacingMultiple: 1.1,
      });
    } else {
      s.addText("You're solving real\noperational pain.", {
        x: 0.6, y: 1.95, w: 12, h: 1.6,
        fontFace: FONT_HEAD, fontSize: 42, bold: true, color: C.ink, lineSpacingMultiple: 1.05,
      });
    }

    // Bridge line
    const sub = r.industry
      ? `${r.industry}${r.icp.length ? `  ·  Serving ${r.icp.slice(0, 2).join(" and ")}` : ""}.`
      : "What we found from your site:";
    s.addText(sub, {
      x: 0.6, y: 3.55, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 14, color: C.muted,
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
    const cardW = 2.9, cardH = 2.1, cardY = 4.5, gap = 0.18;
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
        x: cx + 0.25, y: cardY + 0.25, w: cardW - 0.5, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 30, bold: true, color: C.cyanDeep,
      });
      s.addText(card.body, {
        x: cx + 0.25, y: cardY + 0.9, w: cardW - 0.5, h: cardH - 1.0,
        fontFace: FONT_BODY, fontSize: 13, color: C.ink2, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 2);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 3 — The pattern. (dark statement)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    addLogoLockup(s, { dark: true });
    eyebrow(s, "WHERE RAMPED FITS", { dark: true });

    s.addText("You teach owners to delegate.", {
      x: 0.6, y: 2.05, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 30, italic: true, color: "8A92A8",
    });

    s.addText("We build the team\nthe owner can delegate to.", {
      x: 0.6, y: 3.0, w: 12, h: 2.7,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: C.white,
      lineSpacingMultiple: 1.02,
    });

    // Bracket line at bottom
    s.addShape("rect", {
      x: 0.6, y: 6.0, w: 0.04, h: 0.6,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    const toolsLine = r.tools_mentioned.length > 0
      ? `AI agents inside ${r.tools_mentioned.slice(0, 4).join(", ")} — wherever the work already happens.`
      : "AI agents inside your stack — Slack, HubSpot, NetSuite, wherever the work already happens.";
    s.addText(toolsLine + " They handle the work no human can be trusted with at 2am.", {
      x: 0.8, y: 5.95, w: 12, h: 0.7,
      fontFace: FONT_BODY, fontSize: 15, color: "BBBFC9", lineSpacingMultiple: 1.4,
    });

    footer(s, 3, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 4 — What we actually do.
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "WHAT WE ACTUALLY DO");

    s.addText("Three things. No mystery.", {
      x: 0.6, y: 1.95, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 40, bold: true, color: C.ink,
    });

    const items = [
      { n: "01",
        h: "Agents inside your tools.",
        b: r.tools_mentioned.length > 0
            ? `${r.tools_mentioned.slice(0, 5).join("  ·  ")}. Wherever the work happens.`
            : "Slack  ·  HubSpot  ·  NetSuite  ·  QuickBooks  ·  Gmail. Wherever the work happens." },
      { n: "02",
        h: "We run them. We get the page.",
        b: "API update at 2am? Our problem. The owner sleeps." },
      { n: "03",
        h: "Live in 30 days. Or it's free.",
        b: "Hard deadline. Full refund if missed. The only falsifiable risk-reversal in AI implementation." },
    ];
    const startY = 3.15;
    const rowH = 1.3;
    items.forEach((it, i) => {
      const ry = startY + i * rowH;
      s.addText(it.n, {
        x: 0.6, y: ry, w: 1.1, h: 0.85,
        fontFace: FONT_HEAD, fontSize: 56, bold: true, color: C.cyanDeep,
      });
      s.addShape("rect", {
        x: 1.7, y: ry + 0.12, w: 0.025, h: 0.95,
        fill: { color: C.line }, line: { color: C.line, width: 0 },
      });
      s.addText(it.h, {
        x: 1.9, y: ry, w: 10.8, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 20, bold: true, color: C.ink,
      });
      s.addText(it.b, {
        x: 1.9, y: ry + 0.52, w: 10.8, h: 0.6,
        fontFace: FONT_BODY, fontSize: 14, color: C.muted, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 4);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 5 — How an agent actually works. (NEW — workflow diagram)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "HOW AN AGENT ACTUALLY WORKS");

    s.addText("A worked example.", {
      x: 0.6, y: 1.95, w: 12, h: 0.55,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink,
    });
    s.addText("Inbound quote drafter  ·  typical $4M service business.", {
      x: 0.6, y: 2.6, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 16, italic: true, color: C.muted,
    });

    // Five workflow nodes
    const nodes = [
      { eyebrow: "INBOUND",        title: "Quote request lands",
        body: "Tuesday 6:42pm.\nOwner is at his kid's game." },
      { eyebrow: "AGENT READS",    title: "Cross-references",
        body: "Pricing sheet +\ncapacity calendar." },
      { eyebrow: "AGENT DRAFTS",   title: "Writes the reply",
        body: "In the owner's voice.\n(We tuned it on day 7.)" },
      { eyebrow: "OWNER APPROVES", title: "Taps approve",
        body: "From his phone.\nTakes him 8 seconds." },
      { eyebrow: "SENT",           title: "Reply hits prospect",
        body: "Under 2 minutes from\nfirst inbound. First in." },
    ];

    const nodeW = 2.2, nodeH = 2.6, nodeY = 3.2;
    const totalNodesW = nodeW * 5 + 0.25 * 4; // gaps of 0.25
    const nodeStartX = (W - totalNodesW) / 2;

    nodes.forEach((node, i) => {
      const nx = nodeStartX + i * (nodeW + 0.25);
      const isHero = i === 2;
      // Card
      s.addShape("roundRect", {
        x: nx, y: nodeY, w: nodeW, h: nodeH,
        fill: { color: isHero ? C.ink : C.white },
        line: { color: isHero ? C.cyan : C.line, width: isHero ? 1.5 : 0.75 },
        rectRadius: 0.1,
      });
      // Top stripe (cyan on hero, faint on others)
      s.addShape("rect", {
        x: nx, y: nodeY, w: nodeW, h: 0.06,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      // Step number
      s.addText(`0${i + 1}`, {
        x: nx + 0.2, y: nodeY + 0.2, w: nodeW - 0.4, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 11, bold: true,
        color: isHero ? C.cyan : C.cyanDeep, charSpacing: 0.5,
      });
      // Eyebrow
      s.addText(node.eyebrow, {
        x: nx + 0.2, y: nodeY + 0.55, w: nodeW - 0.4, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 10, bold: true,
        color: isHero ? C.cyan : C.muted, charSpacing: 0.5,
      });
      // Headline
      s.addText(node.title, {
        x: nx + 0.2, y: nodeY + 0.85, w: nodeW - 0.4, h: 0.7,
        fontFace: FONT_HEAD, fontSize: 14, bold: true,
        color: isHero ? C.white : C.ink, lineSpacingMultiple: 1.2,
      });
      // Body
      s.addText(node.body, {
        x: nx + 0.2, y: nodeY + 1.55, w: nodeW - 0.4, h: 0.95,
        fontFace: FONT_BODY, fontSize: 11,
        color: isHero ? "BBBFC9" : C.muted, lineSpacingMultiple: 1.35,
      });

      // Arrow to next node
      if (i < nodes.length - 1) {
        const arrowY = nodeY + nodeH / 2;
        const arrowStartX = nx + nodeW;
        s.addShape("line", {
          x: arrowStartX, y: arrowY, w: 0.25, h: 0,
          line: { color: C.cyan, width: 1.5, endArrowType: "triangle" },
        });
      }
    });

    // Punchline at bottom
    s.addText(
      [
        { text: "The owner stays at his kid's game. ", options: { color: C.muted, italic: true } },
        { text: "The quote still goes out first.",     options: { color: C.ink, italic: true, bold: true } },
      ],
      {
        x: 0.6, y: 6.1, w: 12, h: 0.5,
        fontFace: FONT_HEAD, fontSize: 18, align: "center",
      },
    );

    footer(s, 5);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 6 — 30 days. Or it's free. (giant cyan "30")
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    addLogoLockup(s, { dark: true });
    eyebrow(s, "THE GUARANTEE", { dark: true });

    // Massive "30"
    s.addText("30", {
      x: 0.4, y: 1.7, w: 6.5, h: 4.2,
      fontFace: FONT_HEAD, fontSize: 360, bold: true, color: C.cyan,
    });

    // Right of the 30
    s.addText("DAYS TO LIVE.", {
      x: 5.6, y: 3.3, w: 7, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 28, bold: true, color: C.white, charSpacing: 0.5,
    });
    s.addText("OR YOUR MONEY BACK.", {
      x: 5.6, y: 3.95, w: 7, h: 0.6,
      fontFace: FONT_HEAD, fontSize: 28, bold: true, color: C.white, charSpacing: 0.5,
    });
    s.addText("No fine print. No partial payment.", {
      x: 5.6, y: 4.65, w: 7, h: 0.4,
      fontFace: FONT_BODY, fontSize: 14, italic: true, color: "BBBFC9",
    });

    // Three short justification pills across bottom
    const reasons = [
      "Most prospects were burned by AI tools that worked for 3 weeks.",
      "Every other firm charges 5-figure upfront fees with no commitment date.",
      "We track refund rate as our most important internal metric.",
    ];
    const rW = (W - 1.2 - 0.4) / 3;
    reasons.forEach((rs, i) => {
      const rx = 0.6 + i * (rW + 0.2);
      s.addShape("rect", {
        x: rx, y: 6.0, w: 0.04, h: 0.5,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      s.addText(rs, {
        x: rx + 0.15, y: 5.95, w: rW - 0.15, h: 0.65,
        fontFace: FONT_BODY, fontSize: 11, color: "BBBFC9", lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 6, true);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 7 — The math. (NEW — before/after comparison)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "WHAT YOUR CLIENT GETS BACK");

    s.addText("Conservative math.", {
      x: 0.6, y: 1.95, w: 12, h: 0.55,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink,
    });
    s.addText("One agent. One workflow. Typical service business.", {
      x: 0.6, y: 2.6, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 16, italic: true, color: C.muted,
    });

    // Two columns
    const colY = 3.15;
    const colH = 3.0;
    const colW = 5.85;
    const colGap = 0.3;
    const beforeX = (W - (colW * 2 + colGap)) / 2;
    const afterX = beforeX + colW + colGap;

    // BEFORE column
    s.addShape("roundRect", {
      x: beforeX, y: colY, w: colW, h: colH,
      fill: { color: C.white }, line: { color: C.line, width: 0.75 }, rectRadius: 0.12,
    });
    s.addText("BEFORE", {
      x: beforeX + 0.3, y: colY + 0.3, w: colW - 0.6, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.muted, charSpacing: 0.5,
    });
    s.addText("Owner handles inbound quotes", {
      x: beforeX + 0.3, y: colY + 0.65, w: colW - 0.6, h: 0.45,
      fontFace: FONT_HEAD, fontSize: 17, bold: true, color: C.ink,
    });
    s.addText("~6 quotes / day  ·  ~25 min each", {
      x: beforeX + 0.3, y: colY + 1.15, w: colW - 0.6, h: 0.35,
      fontFace: FONT_BODY, fontSize: 13, color: C.muted,
    });
    // Big punchline
    s.addText("2.5", {
      x: beforeX + 0.3, y: colY + 1.6, w: colW - 0.6, h: 1.0,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: C.ink,
    });
    s.addText("hours / day", {
      x: beforeX + 0.3, y: colY + 2.45, w: colW - 0.6, h: 0.35,
      fontFace: FONT_BODY, fontSize: 14, color: C.muted,
    });

    // AFTER column (dark, hero treatment)
    s.addShape("roundRect", {
      x: afterX, y: colY, w: colW, h: colH,
      fill: { color: C.ink }, line: { color: C.cyan, width: 1.5 }, rectRadius: 0.12,
    });
    s.addShape("rect", {
      x: afterX, y: colY, w: colW, h: 0.06,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("AFTER  ·  AGENT IS LIVE", {
      x: afterX + 0.3, y: colY + 0.3, w: colW - 0.6, h: 0.3,
      fontFace: FONT_HEAD, fontSize: 11, bold: true, color: C.cyan, charSpacing: 0.5,
    });
    s.addText("Agent drafts. Owner approves.", {
      x: afterX + 0.3, y: colY + 0.65, w: colW - 0.6, h: 0.45,
      fontFace: FONT_HEAD, fontSize: 17, bold: true, color: C.white,
    });
    s.addText("Same 6 quotes  ·  ~8 seconds to approve", {
      x: afterX + 0.3, y: colY + 1.15, w: colW - 0.6, h: 0.35,
      fontFace: FONT_BODY, fontSize: 13, color: "BBBFC9",
    });
    s.addText("9", {
      x: afterX + 0.3, y: colY + 1.6, w: colW - 0.6, h: 1.0,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: C.cyan,
    });
    s.addText("minutes / day", {
      x: afterX + 0.3, y: colY + 2.45, w: colW - 0.6, h: 0.35,
      fontFace: FONT_BODY, fontSize: 14, color: "BBBFC9",
    });

    // Big delta callout
    s.addShape("roundRect", {
      x: 0.6, y: colY + colH + 0.25, w: W - 1.2, h: 0.65,
      fill: { color: C.surface }, line: { color: C.line, width: 0.5 }, rectRadius: 0.08,
    });
    s.addShape("rect", {
      x: 0.6, y: colY + colH + 0.25, w: 0.08, h: 0.65,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText(
      [
        { text: "~50 hours / month back. ",                     options: { color: C.cyanDeep, bold: true } },
        { text: "Year one: ~600 hours. Roughly $60K of owner time at $100/hr.", options: { color: C.ink2 } },
      ],
      {
        x: 0.9, y: colY + colH + 0.27, w: W - 1.5, h: 0.6,
        fontFace: FONT_HEAD, fontSize: 16, valign: "middle",
      },
    );

    // Italic kicker
    s.addText("First agent typically pays for itself in 30–45 days.", {
      x: 0.6, y: H - 0.85, w: W - 1.2, h: 0.3,
      fontFace: FONT_BODY, fontSize: 13, italic: true,
      color: C.muted, align: "center",
    });

    footer(s, 7);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 8 — For [Company], specifically. (3 horizontal cards, data-driven)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, `FOR ${companyName.toUpperCase()}, SPECIFICALLY`);

    s.addText(
      r.agent_fit_opportunities.length >= 2
        ? "Three agents I'd build for your clients."
        : "The agent patterns that fit owner-dependent businesses.",
      {
        x: 0.6, y: 1.95, w: 12, h: 0.7,
        fontFace: FONT_HEAD, fontSize: 32, bold: true, color: C.ink,
      },
    );

    const rows = (r.agent_fit_opportunities.length >= 2
      ? r.agent_fit_opportunities.slice(0, 3).map(o => ({
          stage: "", pain: o.pain, agent: o.agent_pattern, desc: o.note || "—",
        }))
      : [
          { stage: "$5M SURVIVAL", pain: "Sales depend on the owner",
            agent: "Inbound Qualifier + Quote Drafter",
            desc: "Triages every inbound. Drafts proposal in the owner's voice. Owner taps approve." },
          { stage: "$5M-$10M", pain: "Operations are chaotic",
            agent: "Exception Catcher",
            desc: "Reconciles invoices, POs, shipping. Pages the right person when something doesn't line up." },
          { stage: "$10M GROWTH", pain: "Profits suffer when owner is gone",
            agent: "Weekly Digest + Approval Queue",
            desc: "One digest Monday morning + approval-by-default queue. Day-to-day runs without them." },
        ]
    );
    while (rows.length < 3) rows.push({ stage: "", pain: "—", agent: "—", desc: "—" });

    const cardY0 = 3.0, cardH = 1.3, cardGap = 0.18;
    rows.forEach((row, i) => {
      const cy = cardY0 + i * (cardH + cardGap);
      // Card
      s.addShape("roundRect", {
        x: 0.6, y: cy, w: W - 1.2, h: cardH,
        fill: { color: C.white }, line: { color: C.line, width: 0.75 }, rectRadius: 0.1,
      });
      // Cyan left edge
      s.addShape("rect", {
        x: 0.6, y: cy, w: 0.08, h: cardH,
        fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
      });
      // Ghost numeral
      s.addText(String(i + 1), {
        x: 0.85, y: cy + 0.1, w: 0.9, h: cardH - 0.2,
        fontFace: FONT_HEAD, fontSize: 64, bold: true,
        color: C.surfaceAlt, valign: "middle",
      });
      // STAGE & PAIN column
      if (row.stage) {
        s.addText(row.stage, {
          x: 1.85, y: cy + 0.22, w: 3.4, h: 0.25,
          fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 0.5,
        });
      } else {
        s.addText("PAIN", {
          x: 1.85, y: cy + 0.22, w: 3.4, h: 0.25,
          fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 0.5,
        });
      }
      s.addText(row.pain, {
        x: 1.85, y: cy + 0.5, w: 3.4, h: cardH - 0.6,
        fontFace: FONT_HEAD, fontSize: 14, bold: true, color: C.ink, lineSpacingMultiple: 1.2,
      });
      // AGENT column
      s.addText("RAMPED AGENT", {
        x: 5.4, y: cy + 0.22, w: 3.4, h: 0.25,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.cyanDeep, charSpacing: 0.5,
      });
      s.addText(row.agent, {
        x: 5.4, y: cy + 0.5, w: 3.4, h: cardH - 0.6,
        fontFace: FONT_HEAD, fontSize: 14, bold: true, color: C.accent, lineSpacingMultiple: 1.2,
      });
      // DESC column
      s.addText("WHAT IT DOES", {
        x: 8.95, y: cy + 0.22, w: 3.7, h: 0.25,
        fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.muted, charSpacing: 0.5,
      });
      s.addText(row.desc, {
        x: 8.95, y: cy + 0.5, w: 3.7, h: cardH - 0.6,
        fontFace: FONT_BODY, fontSize: 12, color: C.ink2, lineSpacingMultiple: 1.4,
      });
    });

    footer(s, 8);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 9 — Pricing.
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "PRICING");

    s.addText("Flat monthly. No per-seat.", {
      x: 0.6, y: 1.95, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink,
    });
    s.addText("No hidden onboarding cliff. No surprises.", {
      x: 0.6, y: 2.65, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 14, italic: true, color: C.muted,
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
    const cW = 3.85, cH = 4.0, cY = 3.1, gap = 0.4;
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
          x: cx + cW / 2 - 0.95, y: cY - 0.22, w: 1.9, h: 0.4,
          fill: { color: C.cyan }, line: { color: C.cyan, width: 0 }, rectRadius: 0.08,
        });
        s.addText("MOST POPULAR", {
          x: cx + cW / 2 - 0.95, y: cY - 0.22, w: 1.9, h: 0.4,
          fontFace: FONT_HEAD, fontSize: 9, bold: true, color: C.ink,
          align: "center", valign: "middle", charSpacing: 1,
        });
      }
      s.addText(t.name, {
        x: cx + 0.3, y: cY + 0.3, w: cW - 0.6, h: 0.3,
        fontFace: FONT_HEAD, fontSize: 11, bold: true,
        color: isPopular ? C.cyan : C.muted, charSpacing: 1,
      });
      s.addText(t.price, {
        x: cx + 0.3, y: cY + 0.7, w: cW - 0.6, h: 1.0,
        fontFace: FONT_HEAD, fontSize: 44, bold: true,
        color: isPopular ? C.white : C.ink,
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

    // Cyan banner across bottom
    s.addShape("rect", {
      x: 0.6, y: H - 0.95, w: W - 1.2, h: 0.55,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addText("30 days to your first live agent.  Or it's free.", {
      x: 0.6, y: H - 0.95, w: W - 1.2, h: 0.55,
      fontFace: FONT_HEAD, fontSize: 14, bold: true,
      color: C.ink, align: "center", valign: "middle",
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 10 — What I'd love to learn.
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.paper };
    addLogoLockup(s);
    eyebrow(s, "TODAY'S GOAL");

    s.addText("Less pitch. More questions.", {
      x: 0.6, y: 1.95, w: 12, h: 0.7,
      fontFace: FONT_HEAD, fontSize: 36, bold: true, color: C.ink,
    });
    s.addText("What I'd love to learn from you in the next 30 minutes:", {
      x: 0.6, y: 2.65, w: 12, h: 0.4,
      fontFace: FONT_BODY, fontSize: 15, italic: true, color: C.muted,
    });

    const targetedQ = r.business_summary
      ? { q: `Where in ${companyName} do you feel owner-dependence the hardest?`,
          sub: "Sales? Ops? Finance? — that's where the first agent goes." }
      : { q: "Where do you feel owner-dependence the hardest right now?",
          sub: "Sales? Ops? Finance? — that's where the first agent goes." };

    const toolsQ = r.tools_mentioned.length > 0
      ? { q: `I saw ${r.tools_mentioned.slice(0, 2).join(" and ")} on your site. Anything else in the stack?`,
          sub: "Agents go where the work is — broader picture means a better first install." }
      : { q: "What tools do your clients live in day-to-day?",
          sub: "HubSpot? NetSuite? QuickBooks? Slack? — agents go where work lives." };

    const questions = [
      targetedQ,
      toolsQ,
      { q: "Have any of them tried AI tools that fell over?",
        sub: "Usually the cleanest entry point — they're already burned." },
      { q: "If we got this working, what would it free them up to do?",
        sub: "Helps us scope the right first agent vs the dream-state stack." },
      { q: "Realistic budget + timeline if this is a fit?",
        sub: "So pricing isn't a surprise, but isn't the headline." },
    ];
    const qY0 = 3.2, qH = 0.78;
    questions.forEach((qq, i) => {
      const qy = qY0 + i * qH;
      // Cyan filled circle
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
        fontFace: FONT_HEAD, fontSize: 16, bold: true, color: C.ink,
      });
      s.addText(qq.sub, {
        x: 1.3, y: qy + 0.36, w: W - 1.9, h: 0.36,
        fontFace: FONT_BODY, fontSize: 12, italic: true, color: C.muted,
      });
    });

    footer(s, 10);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SLIDE 11 — Thanks, Michael. (dark hero close)
  // ══════════════════════════════════════════════════════════════════════
  {
    const s = p.addSlide();
    s.background = { color: C.ink };
    // Top-left cyan accent — bookends the cover
    s.addShape("rect", {
      x: 0, y: 0, w: 4.5, h: 0.06,
      fill: { color: C.cyan }, line: { color: C.cyan, width: 0 },
    });
    s.addShape("rect", {
      x: 0, y: 0.06, w: 1.6, h: 0.04,
      fill: { color: C.cyanDeep }, line: { color: C.cyanDeep, width: 0 },
    });
    addLogoLockup(s, { dark: true });
    eyebrow(s, `THANKS, ${firstName.toUpperCase()}.`, { dark: true });

    s.addText("Let's find the\nshape of this together.", {
      x: 0.6, y: 2.1, w: 12, h: 2.8,
      fontFace: FONT_HEAD, fontSize: 64, bold: true, color: C.white,
      lineSpacingMultiple: 1.02,
    });

    // Next-step card
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
      fontFace: FONT_HEAD, fontSize: 10, bold: true, color: C.cyan, charSpacing: 1,
    });
    s.addText('A 20-minute "workflow audit."', {
      x: 0.9, y: 5.55, w: W - 1.8, h: 0.45,
      fontFace: FONT_HEAD, fontSize: 22, bold: true, color: C.white,
    });
    s.addText(
      "Pick one workflow eating the most of your time. I'll show you exactly what it looks like with an agent running it. No pressure, no commitment.",
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
    s.addText("30 days. Or it's free.", {
      x: W - 5.4, y: H - 0.4, w: 4.8, h: 0.3,
      fontFace: FONT_BODY, fontSize: 11, italic: true, color: C.cyan, align: "right",
    });
  }

  const buf = await p.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
