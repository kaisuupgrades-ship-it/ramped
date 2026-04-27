# Claude Design — paste-ready prompts for Ramped AI assets

These prompts are pre-loaded with the brand context Claude Design needs. Open
[claude.ai](https://claude.ai), switch to the Claude Design tool, paste a prompt,
iterate until it looks right, then export.

**Brand context to mention if Claude Design asks:**
- **Name:** Ramped AI
- **URL:** 30dayramp.com
- **Tagline:** "Your AI department, live in 30 days."
- **Sector:** Premium B2B SaaS — done-for-you AI implementation for operating businesses
- **Tone:** Operator-confident, plain-spoken, time-bound. Not playful, not "techy." Closer to Stripe / Ramp / Notion than to a typical "AI startup" aesthetic.
- **Core colors:**
  - Ink (text, dark UI): `#0B1220`
  - Paper (warm cream background): `#FAFAF7`
  - Line (subtle borders): `#E6E4DC`
  - Muted (secondary text): `#5B6272`
  - Accent (primary brand blue): `#1F4FFF`
  - Accent dark: `#0B2A8C`
  - Good (success green): `#0F7A4B`
  - Warn (amber for guarantee badges): `#B45309`
- **Typography:** Inter for sans-serif body and headlines (weights 400, 500, 600, 700, 800). JetBrains Mono for numbers, code, and small caps eyebrows (weights 400, 500).

---

## Prompt 1 — Open Graph image (most urgent)

> I need an Open Graph share image for `30dayramp.com` at exactly **1200×630 pixels**, target file size 80–150 KB PNG. This is what shows on Slack, LinkedIn, iMessage when someone shares the URL.
>
> **Brand:** Ramped AI. We deploy production AI agents into operating businesses, live in 30 days. Premium B2B SaaS, ~$2,500–5,000/mo customers.
>
> **Composition:** dark navy background using `#0B1220` with a subtle radial gradient adding `#1F4FFF` at 8% opacity in the top-right corner. Bottom-left: small wordmark "Ramped AI" in white Inter ExtraBold (800) at ~26 px. Center: the headline "Your AI department, live in 30 days." in white Inter ExtraBold at ~96 px, ranging from -.03em letter-spacing, max two lines. Bottom-right corner: a small pill-shaped badge "30-DAY GUARANTEE" in JetBrains Mono uppercase 14 px, amber `#B45309` text on a translucent amber background.
>
> Generous whitespace. No icons, no illustrations, no decorative shapes. Just type on dark with a hint of brand blue glow. Looks expensive and quiet, like Stripe's social cards.
>
> Export as PNG. Show me three variations: (a) headline centered, (b) headline left-aligned with the wordmark stacked above it, (c) headline broken across three lines with a small upward-trajectory mark at the start.

---

## Prompt 2 — Favicon (multi-resolution)

> Make me a favicon for Ramped AI that works at 16×16, 32×32, 48×48, and 180×180 (apple-touch-icon). The current placeholder is four ascending bars; I want to replace it with something more memorable.
>
> **Constraints:**
> - Single mark on a transparent background.
> - Recognizable at 16×16 (the smallest size browser tabs use). Anything intricate disappears at that scale.
> - Brand color: solid `#1F4FFF` (or the gradient variants `#1F4FFF` → `#0B2A8C`).
> - Should *not* read as a "generic SaaS chart icon."
>
> **Three directions to explore, give me one of each:**
>
> (a) **Stylized "R"** — a single character mark in a custom-feeling typeface (rounded but not soft). Think Notion's "N" or Linear's "L" — confident, geometric, no ornamentation.
>
> (b) **30-day cycle motif** — a circular arc that closes, suggesting "thirty days, then done." Subtle, almost a clock face.
>
> (c) **Rising trajectory** — a single bold curve going up and to the right, with a small endpoint dot. Less generic than the four-bar version we have.
>
> Export each as: SVG (master), PNG @ 32×32, PNG @ 180×180, and a multi-resolution `.ico` containing 16/32/48 px embeddings.

---

## Prompt 3 — apple-touch-icon (180×180)

> Single 180×180 PNG. This is what shows when someone adds 30dayramp.com to their iPhone home screen. iOS will round the corners automatically — design as a square edge-to-edge.
>
> **Composition:** the chosen favicon mark from Prompt 2 (whichever direction won), centered, on a brand-blue gradient background `#1F4FFF` → `#0B2A8C` at 135°. Mark itself in white. Generous padding around the mark — ~25% of the canvas should be empty space on each side.
>
> No text, no shadow, no shine. Looks like Stripe's or Linear's home-screen icon.

---

## Prompt 4 — three pain-section illustrations (80×80 each)

> I have three "pain point" cards on the homepage. Each currently uses a generic stock SVG icon. I want three custom mini-illustrations to replace them, each at **80×80 SVG**, line-illustration style, **single color** (`#1F4FFF`), **2 px stroke weight**, friendly-but-professional. Style reference: Stripe's customer-page illustrations or Notion's product-page line drawings — tight, intentional, lightly illustrated rather than icon-flat.
>
> Each illustration should fill the canvas with breathing room (~10 px padding from edges). No text inside the illustration itself.
>
> **Pain 1: "You know AI could help — but don't know where to start."**
> Visualize: a small figure standing at a fork in a path, three arrows branching forward into different directions. The figure isn't moving — they're considering. A faint dashed line under the figure suggesting hesitation.
>
> **Pain 2: "Consultants give you decks, not working software."**
> Visualize: a presentation slide on an easel with a chart on it; a cursor or pointer hovering near it; behind/beside the slide, a closed laptop with the screen blank. Make it clear: the deliverable was a slide, not a system.
>
> **Pain 3: "Your team is stuck doing work that should be automated."**
> Visualize: a person at a desk with a stack of papers/tickets in front of them, plus a small "loop" symbol (a circular arrow) suggesting the same work happens over and over. Slight slump in the figure's posture.
>
> Export as three separate SVG files. Make sure paths use `currentColor` so we can theme them at runtime if needed.

---

## Prompt 5 — Mocked agent UI screenshot for the homepage hero

> I need a desktop UI mockup of an "AI agent inbox" — what someone deploying our product would actually see. This will go on the homepage as visual proof that the product exists. Format: **1280×720 PNG**, 16:9.
>
> **Style reference:** Linear, Stripe Dashboard, or Notion's product screenshots — clean, modern, mostly monochrome with strategic accent color use.
>
> **Composition (3-column layout):**
>
> **Left column (250 px wide) — sidebar.** Brand color block at top with a small "Ramped" wordmark. Below it: nav items (Inbox · Deals · Quotes · Reports), all in JetBrains Mono small caps. Active state on "Inbox" — accent-blue left border, slightly darker bg.
>
> **Center column (~580 px wide) — incoming work queue.** Header reads "Quote intake" in Inter Bold 18 px. Below, a list of 5–6 incoming items styled as cards. Each shows: company name (e.g. "Bishop Industries", "Acme Manufacturing", "Northwind Logistics" — fictional B2B names), a one-line subject ("RFQ for 200 valves, ship deadline Mar 8"), a relative timestamp ("4m ago"), and a status pill. Three of the cards have a green pulsing dot + "Agent active" pill in green. One card has an amber pill "Needs human review" with an exclamation icon.
>
> **Right column (~440 px wide) — agent in action.** Header reads "Bishop Industries · in progress" in Inter Bold. Below: a chat-style transcript showing the agent's work. Two or three "thoughts" in light gray italic ("Reading email... matched product code GVK-200 to active inventory... drafting reply"). Then a draft email block with To/From/Subject/Body. Body shows a polite, specific quote response. At the bottom, two buttons: a primary "Send" in accent blue, a secondary "Edit" in white with a border.
>
> **Color treatment:** the whole UI uses our brand colors — dark text `#0B1220` on white, accent `#1F4FFF` for primary buttons and active states, `#FAFAF7` for the canvas border, soft green `#0F7A4B` for the "Agent active" pills.
>
> **Final touches:** a subtle outer drop shadow on the whole window so it feels like a floating screenshot. Browser chrome at top (three traffic-light dots, URL bar with `app.30dayramp.com`).
>
> Export as PNG with transparent corners (or square — I'll round-corner it in CSS). Also give me an SVG version if you can — I want to keep it crisp at 2x DPI.

---

## How to use these in our codebase once Claude Design exports them

1. **Drop the file into the project root** (or `/assets/` if you want to organize).
2. **Tell me the filename and where to wire it up.** I'll handle:
   - Updating `<meta property="og:image">` and Twitter card refs to the new OG image.
   - Replacing the four-bar SVG logo in the nav with the new mark (across all 18 HTML pages).
   - Replacing `apple-touch-icon.png`.
   - Generating a multi-resolution `.ico` from the SVG mark using ImageMagick / a free online converter (I'll give you the exact CLI command if you have it installed, otherwise the [favicon.io](https://favicon.io) flow).
   - Swapping the three pain-section SVGs.
   - Wiring the agent UI screenshot into the homepage hero (or a new "See it in action" section right under the hero).

Just send me the exported asset (or a public URL Claude Design gives you) and I'll handle the rest in a follow-up PR.

---

## A note on iteration

Don't expect Claude Design to nail any of these on the first generation. The OG image is the easiest (text on dark) — typically 1–2 iterations. The pain illustrations and the agent UI mockup will take 4–6 rounds. Tell it specifically what's wrong each time ("the figure is too small", "the second screenshot needs more whitespace", "the green pill should be smaller").

If a generation looks 80% right, ask Claude Design to "keep everything but fix [specific thing]" rather than starting over.

For the agent UI mockup specifically: Claude Design might want to render real-looking emails with too much detail. Push back — say "the body text should be readable but generic, not dense. This is a hero illustration, not a documentation screenshot."
