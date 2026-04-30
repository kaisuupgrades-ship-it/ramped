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

The 4 ascending bar charts in `var(--accent)` with opacity gradient (1.0, 0.75, 0.55, 0.35).

```html
<svg width="26" height="22" viewBox="0 0 26 22" fill="none">
  <rect x="0"  y="14" width="5" height="8"  rx="1.5" fill="var(--accent)"/>
  <rect x="7"  y="9"  width="5" height="13" rx="1.5" fill="var(--accent)" opacity=".75"/>
  <rect x="14" y="4"  width="5" height="18" rx="1.5" fill="var(--accent)" opacity=".55"/>
  <rect x="21" y="0"  width="5" height="22" rx="1.5" fill="var(--accent)" opacity=".35"/>
</svg>
```

**Logo rules:**
- Always paired with "Ramped AI" wordmark on the right (Inter 700, 18px, var(--ink))
- Minimum size: 18px wide
- Maximum size: 64px wide (in normal layout)
- Clear space: 0.5× logo width on all sides
- Never rotate, never recolor (except white-on-dark for inverted backgrounds)
- Don't drop shadows, don't outline, don't gradient on the wordmark

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
