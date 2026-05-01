# Ramped AI — Brand Style Guide

Internal document for anyone writing or designing for Ramped. The goal: every touchpoint sounds like the same operator-CEO talking to another operator-CEO.

---

## Voice

We're an operator talking to an operator. Not a vendor. Not a consultant. Not a marketing department.

### The 5 voice rules

**1. Numbers over adjectives.**
- ✅ "Save 40+ hours/week"
- ❌ "Save tons of time"

**2. Specific over general.**
- ✅ "Catches stale shipping addresses, overdue invoices, mismatched POs"
- ❌ "Improves data quality"

**3. Show, don't tell.**
- ✅ "Slack message → bot replies in 14s with the cross-referenced answer"
- ❌ "Fast, intelligent responses"

**4. Operator vocabulary.**
- ✅ "Workflow", "ops VA", "ICP", "ramp", "approval loop", "outcome"
- ❌ "Solution", "platform", "synergy", "transformation", "leverage"

**5. One idea per sentence.**
- ✅ "Done in 30 days. Or it's free."
- ❌ "Our flexible engagement model offers a comprehensive go-live timeline that ensures customer success through risk-mitigated deployment."

### Words and phrases to NEVER use

| Don't say | Why | Say instead |
|---|---|---|
| Game-changer | Vague, overused | (be specific about what changes) |
| Revolutionary | Marketing speak | (a specific number) |
| Cutting-edge | Implies you're not | (the actual technology) |
| Solution | Empty word | "What we built", "what we ship" |
| Synergy | Corporate void | (just describe what works together) |
| Pivot | Startup jargon | "Change direction" |
| Disrupt | Cliche | (the actual outcome) |
| Streamline | Vague | "Cut N steps from the process" |
| Empowerment | Soft sell | (concrete capability) |
| Best-in-class | Brag without proof | "Top X% by [specific metric]" |
| Next-gen | Meaningless | (just describe the feature) |
| Mission-critical | Soft hyperbole | "Required for revenue" |
| Bandwidth | HR speak | "Time", "capacity" |
| At the end of the day | Filler | (just say the conclusion) |
| Thought leadership | Eye-rolling | (just publish good thinking) |
| World-class | Empty | (a specific benchmark) |

### Words and phrases that ARE us

- "Live in 30 days"
- "Or it's free" (the guarantee)
- "Done-for-you"
- "Same model as your accountant"
- "Operator"
- "Department"
- "Approval loop" / "approval-by-default"
- "Catches what you missed"
- "Plugged into your stack"
- "Deploy and run"
- "Owns the outcome"
- "Cross-references"
- "Heads up:"

---

## Tone modulation by channel

| Channel | Voice | Length | Example |
|---|---|---|---|
| Homepage | Confident, direct | 1-2 sentences/element | "Your AI department, live in 30 days." |
| LinkedIn | Founder-CEO, opinionated | 3-5 paragraphs | "We hired our first VA in 2019..." |
| Twitter/X | Sharp, contrarian | 1-2 tweets | "AI agency is a bad business model. AI implementation partner is a great one." |
| Email outbound | Plain, useful | 3-4 short paragraphs | "Saw {{company}} hiring an Operations VA. Quick context..." |
| Sales calls | Operator + advisor | Conversational | "Walk me through where the bottleneck is" |
| Customer support | Calm, fix-it | As short as possible | "Pushing the fix now. ETA 8 minutes." |
| Press release | Newswire formal | Standard structure | "ANNOUNCE: ..." |

---

## Visual identity

### Color palette

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0B1220` | Primary text, dark backgrounds |
| `--ink-2` | `#1A2233` | Secondary text on light, hover states |
| `--paper` | `#FAFAF7` | Page background |
| `--surface` | `#F5F5F3` | Cards, secondary surfaces |
| `--line` | `#E6E4DC` | Borders, dividers |
| `--muted` | `#5B6272` | Body copy, secondary text |
| `--accent` | `#1F4FFF` | Primary CTA, brand emphasis |
| `--accent-2` | `#0B2A8C` | Hover/pressed accent |
| `--good` | `#0F7A4B` | Success states |
| `--warn` | `#B45309` | Warnings, guarantee badge |

### Hard rules

- **Never introduce a new color** without checking the canonical table first
- **Never use red** for anything except destructive actions (it implies error)
- **Avoid #000 and #FFF** — use `--ink` and `--paper` for almost-but-not-quite black/white that feels less harsh
- **Accent is sparing** — primary CTAs and key emphasis only. Don't accent every link
- **Dark sections ARE allowed** — for premium feel (e.g. feature highlight cards), use `#0F0F12` background with `var(--accent)` glow

### Typography

| Use | Font | Weights |
|---|---|---|
| Body, headings | Inter | 400, 500, 600, 700, 800 |
| Stats, eyebrows, monospace | JetBrains Mono | 400, 500 |

- Type scale uses `clamp()` — fluid, never fixed pixel values
- Hero h1: `clamp(2.8rem, 7vw, 5rem)`, line-height 1.02, letter-spacing -.04em
- Section h2: `clamp(2rem, 4vw, 2.8rem)`, line-height 1.1, letter-spacing -.03em
- Body: 16px / 1.65 line-height / `var(--ink)` color
- Eyebrow: 11px / .12em letter-spacing / uppercase / muted color

### Logo

**Updated 2026-04-30 (v2 — authoritative)** — replaced the 4-bar mark with the arrow swoop. Source SVG provided by ChatGPT brand pack export. Gradient deep navy (`#0A2540`) → royal blue (`#006BD6`) → cyan (`#00D4FF`). Hockey-stick swoop with sharp triangular arrowhead, narrow tapered tail at lower-left, gradient direction follows the swoop axis.

```html
<svg width="30" height="30" viewBox="0 0 100 100" fill="none">
  <defs>
    <linearGradient id="rampedSwoopNav" x1="17.46" y1="84.69" x2="76" y2="11.64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0A2540"/>
      <stop offset="58%" stop-color="#006BD6"/>
      <stop offset="100%" stop-color="#00D4FF"/>
    </linearGradient>
  </defs>
  <path d="M 76 11.64 L 69.86 15.63 L 59.41 22.73 L 59.81 22.97 L 65.07 24.48 L 59.97 36.76 L 57.34 42.42 L 54.39 48.25 L 51.67 53.03 L 49.20 57.02 L 46.73 60.61 L 43.14 65.23 L 40.03 68.74 L 36.60 72.09 L 33.49 74.72 L 29.74 77.35 L 27.43 78.71 L 25.36 79.74 L 23.05 80.70 L 19.22 81.82 L 17.46 82.06 L 19.30 82.93 L 21.29 83.65 L 21.85 83.65 L 21.93 83.81 L 23.13 84.13 L 25.92 84.61 L 30.62 84.69 L 34.45 84.05 L 38.36 82.70 L 40.43 81.66 L 43.06 79.98 L 46.41 77.27 L 48.80 74.88 L 50.56 72.89 L 52.79 69.94 L 55.18 66.35 L 57.26 62.84 L 59.57 58.45 L 62.04 53.19 L 64.67 47.05 L 72.17 28.15 L 72.33 28.07 L 76 31.02 Z" fill="url(#rampedSwoopNav)"/>
</svg>
```

**Asset files:**
- `/favicon.svg` — master glyph (also used as 16/32/48 favicons)
- `/apple-touch-icon.png` — 180×180 raster
- `/android-chrome-192.png`, `/android-chrome-512.png` — Android launcher
- `/logo-master-1024.png` — App-store / high-res master
- `/logo-lockup.svg` — full RAMPED AI lockup with tagline (light mode)
- `/logo-lockup-dark.svg` — dark-mode variant

**Logo rules:**
- Always paired with "Ramped AI" wordmark on the right (Inter 700, 18px, var(--ink))
- Minimum size: 20px wide
- Maximum size: 64px wide (in normal layout)
- Clear space: 0.5× logo width on all sides
- Never rotate, never alter the gradient hue. White-fill variant allowed for use on dark accent backgrounds (e.g. Slack mockup avatars).
- Don't drop shadows, don't outline, don't gradient on the wordmark itself
- The "AI" in the wordmark uses `#00D4FF` (cyan accent) for emphasis when displayed at large lockup sizes; in masthead/inline use, the entire wordmark is `var(--ink)`

---

## CTAs (calls to action)

### Primary CTA
**"Book a discovery call →"** — appears once per page, primary visual weight, accent button

### Secondary CTAs (rotate)
- **"Get your free roadmap"** — for top-of-funnel exploration
- **"Watch a 2-min demo"** — when video is available
- **"See how it works"** — for educational content

### NEVER use
- "Learn more" (vague)
- "Click here" (broken accessibility)
- "Sign up free" (we're not freemium)
- "Get started" (overused; reserved for tier-bound flows on /book only)

### Button rules
- Primary: `background: var(--ink); color: #fff; border-radius: 10px; padding: 13px 22px;`
- Secondary: `background: #fff; border: 1px solid var(--line); color: var(--ink);`
- Both: 600 font-weight, 15px font-size, ALL caps no, ALL bold no
- Hover: subtle `transform: translateY(-1px)` + opacity .88

---

## Imagery

### Photography rules
- **Real photography or commissioned illustration** — never stock SVG icons in the hero
- **No fake customer logos** — never claim TechCrunch features, etc.
- **Real numbers, sourced** — "Avg. $12,000+/mo saved" with sample size noted

### Stock SVG icons OK in
- Pain-point cards / "bridges" sections
- FAQ icons
- Process diagrams

### Mockups
- Slack mockups: light mode by default (matches Ramped brand)
- Dark mode allowed for feature highlight sections (premium contrast)
- Always pixel-accurate Slack styling (not generic chat UI)
- Bot avatar: blue gradient with the bar-chart SVG inside

---

## Numbers to use freely

These are real and sourced:
- "30 days, or refund" (the guarantee)
- "$2,500/mo Starter, $5,000/mo Growth"
- "Save 40+ hours per week" (avg across deployments)
- "3× faster lead response time"
- "Avg. $12,000+/mo saved vs. staffing"
- "5× avg. ROI year 1"
- "24/7 AI coverage"

### Risky claims that need provenance
- "5× ROI on n=1" — soften or skip
- Customer-specific results — get permission first
- Industry stats — cite source
- "Best", "fastest", "only" — back with comparison

---

## Don't / Do checklist

Before publishing anything, verify:

| Don't | Do |
|---|---|
| ❌ Generic AI hype | ✅ Specific Ramped capability |
| ❌ "We believe..." | ✅ Direct claim |
| ❌ "We're passionate about..." | ✅ Show the work |
| ❌ Fake screenshots | ✅ Real Slack mockup or anonymized real data |
| ❌ Long subject lines | ✅ Under 50 chars |
| ❌ Multi-CTA in one piece | ✅ One primary CTA |
| ❌ Stock photos of "team meetings" | ✅ Product visuals or no image |
| ❌ Exclamation points!!! | ✅ Calm period |
| ❌ Emoji on customer-facing copy | ✅ ⚠️ in agent context only (matches Slack) |

---

## Decision tree: when in doubt

1. **Is this what I'd say to a CEO over coffee?** If no, rewrite.
2. **Could I replace any sentence with "stuff happens here"?** If yes, that sentence is filler. Cut.
3. **Does it feel like a vendor wrote it?** If yes, sound less corporate.
4. **Did I claim something I can't back with a number?** If yes, soften or add the number.
5. **Could a competitor say the exact same thing?** If yes, find what's specifically Ramped about it.

---

*Last updated: 2026-04-30. Update this when copy patterns evolve.*
