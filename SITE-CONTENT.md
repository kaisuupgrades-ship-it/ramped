# 30dayramp.com — Site Content Spec

A complete, sentence-level extraction of every customer-facing page. The goal: Claude Design (or any rebuilder) can recreate the site from this document alone, without ever opening the original HTML.

---

## Brand essentials

- **Logo / mark:** Ramped AI swoop — an SVG path filled with a navy → blue → cyan linear gradient (`#0A2540` → `#006BD6` → `#00D4FF`). Defined inline on every page (id varies per location: `rampedSwoopNav`, `rampedSwoopFooter`, `rampedSwoopDemo`, `rampedSwoopMsg`, etc.). Source path: `/favicon.svg`.
- **Wordmark:** "Ramped AI" — Inter, weight 700, letter-spacing −0.02em.
- **Tagline / positioning line:** "Your AI department, live in 30 days."
- **Footer descriptor:** "AI implementation for operating businesses."
- **Email:** `jon@30dayramp.com` (the only contact address — never `hello@`, `support@`, or `contact@`).
- **Domain:** `30dayramp.com` (canonical: `https://www.30dayramp.com/`).
- **Founder credits used in copy:** "Andrew Yoon — 10-year operator and founder of Xtractor Depot" (homepage). Co-founder Jonathan Roh on `/about`.
- **Copyright line:** "© 2026 Ramped AI. All rights reserved."

---

## Global navigation (canonical masthead)

Every customer-facing page embeds a "byte-identical" masthead. It's a sticky bar at `top:0; z-index:40;` containing:

1. **Header bar** (height 64px, max-width 1120px):
   - Left: Ramped AI swoop logo + wordmark, link to `/`.
   - Right desktop nav (`aria-label="Primary"`):
     - `About` → `/about`
     - `Pricing` → `/#pricing`
     - `Compare` → `/comparison`
     - `Book a call →` → `/book` (filled primary button on dark backgrounds)
   - Right mobile: a primary "Book a call →" button + a hamburger that toggles the mobile drawer (`#mobile-nav-drawer`) with the same four items. Drawer closes on link click and on Escape; `aria-expanded` and `aria-controls` are wired correctly.
2. **Stats ticker bar** (immediately under the header, 38px tall, dark `var(--ink)` background, `aria-label="Key stats"`):
   Six items repeating, scrolling left at 36s per loop, paused on hover. Each item is JetBrains Mono, 11.5px, uppercase, with a green `●` dot:
   - "Save 40+ hours per week"
   - "30-day go-live guarantee"
   - "3× faster lead response time"
   - "Avg. $12,000+ / mo saved vs. staffing"
   - "5× avg. ROI in year 1"
   - "24/7 AI coverage — no sick days"

**Footer (used on most pages):**

- Left: 22×22 swoop + "Ramped AI" wordmark + tagline "AI implementation for operating businesses."
- Right inline nav (font-size:13px, `color:var(--muted)`):
  - `How it works` → `/#how-it-works`
  - `Pricing` → `/#pricing`
  - `About` → `/about`
  - `Compare` → `/comparison`
  - `Book a call` → `/book`
  - `Privacy` → `/privacy`
  - (homepage also includes `/demo`; resources page also includes `/resources`)
- Bottom row: "© 2026 Ramped AI. All rights reserved." on the left, `mailto:jon@30dayramp.com` link on the right.

**Note on `/about` masthead:** the About link in nav is highlighted with `aria-current="page"` and a `var(--surface)` background. Same pattern on `/book` (Book a call button highlighted) and `/comparison`.

---

## Pages

### / (Homepage — `index.html`)

**Title:** `Ramped AI — Your AI department, live in 30 days`
**Meta description:** `We deploy AI agents into your operating business — answering calls, routing leads, and automating your highest-friction workflows. Flat monthly fee. Go-live guarantee.`
**Canonical:** `https://www.30dayramp.com/`
**OG image:** `/og-image.png`

#### Hero (centered, with grid-bg + radial glows)

- **H1:** Two lines.
  - Line 1: "Your AI department,"
  - Line 2 (gradient-painted span `.hero-h1-accent`): "live in 30 days."
  - Type clamp: `clamp(2.8rem, 7vw, 5rem)`, line-height 1.02, letter-spacing −0.04em, max-width 1000px.
- **Subheadline (`.hero-sub`, 1.125rem, max-width 640px):**
  > "Done-for-you AI implementation. We build, deploy, and run AI agents inside your operating business — automating your highest-friction workflows on a flat monthly fee."
- **CTA row (centered):**
  - Primary: "Book a discovery call →" → `/book` (`.btn-primary.btn-large`)
  - Secondary: "Get your free roadmap" → `/free-roadmap` (`.btn-ghost.btn-large`)
- **Guarantee strip (prominent, amber-themed `.hero-guarantee` block):**
  - Shield icon (amber, 20×20).
  - Strong: "30-day go-live guarantee — full refund if we miss."
  - Small: "No fine print. No partial payments. No questions."
- **Founder credit (`.hero-founder`):**
  > "Built by **Andrew Yoon** — 10-year operator and founder of Xtractor Depot."

#### Interactive Slack-style demo (`#demo-shell` — vanilla JS state machine, NOT React)

A full faux-workspace UI mounted into the hero. Structure:

- Toolbar with traffic lights and faux URL `workspace.ramped.ai / agents / ramped-bot`.
- Sidebar:
  - "Northwind" workspace badge ("N", "12 agents online").
  - **Channels** group: `#general`, `#sales-pod`, `#deal-room`, `#finance-leads`, `#inventory-alerts`.
  - **AI Agents** group: "Ramped Bot" (LIVE pill, active), "Ops Agent", "Finance Agent".
  - Day card: "Day · 30 / 30 · ● Deployment complete".
- Chat header: Ramped Bot avatar (swoop), title "Ramped Bot", subtitle "Your AI department · trained on Northwind data", chip "● Live in production".
- Chat stream `#demo-stream` — populated dynamically.
- Composer: disabled input "Ask Ramped Bot anything, or pick a playbook above…", disabled "Send" button. Hint shows "Connected to **HubSpot**, **NetSuite**, **QuickBooks**, **Gong**, **Slack**" and `⌘K commands`.

**Four playbooks (the `WORKFLOWS` JS object, surfaced as clickable buttons):**

1. **`lead` — "Handle inbound lead"**
   - Subtitle: "HubSpot → Slack → Calendar"
   - Icon: 🎯 on a blue gradient.
   - User prompt: "New inbound lead just came in from the website demo form — Sara Chen, Director of Ops at Northwind Logistics. Run the inbound playbook."
   - Bot intro: "On it. Pulling Sara's profile and Northwind's signal data now — give me a moment to enrich."
   - Steps (label · duration · integrations):
     1. "Enriching lead from Clearbit + LinkedIn" · 950ms · clearbit
     2. "Scoring fit against ICP model" · 800ms
     3. "Looking up Northwind in HubSpot" · 700ms · hubspot
     4. "Drafting personalized outreach" · 1100ms
     5. "Booking discovery slot in Calendar" · 800ms · calendar
     6. "Posting handoff to #sales-pod" · 600ms · slack
   - Success title: "Lead routed and meeting booked."
   - Success metrics: Time to first touch = 47s · Pipeline added = $12,400 · Fit score = 94 / 100.
   - Aha moment: "Agent learned from your last 12 closed-won deals — Sara fits the profile of a 32-day cycle, so I queued a tighter follow-up cadence."
   - Detail: "Sent a Loom recap to Sara, looped in **@marcus** as AE, and dropped the Northwind brief into the deal record. Next touch fires in 26 hours if no reply."

2. **`inventory` — "Automate inventory"**
   - Subtitle: "NetSuite reorder + SKU forecast", icon: 📦 on orange gradient.
   - User prompt: "Run the weekly inventory pass. Flag anything tracking below safety stock and trigger reorders where the math works."
   - Bot intro: "Pulling SKU velocity from NetSuite and cross-checking against the demand model. Running the reorder logic now."
   - Steps: "Fetching 14,200 active SKUs from NetSuite" (900ms, netsuite); "Running 30-day demand forecast" (1100ms); "Flagging SKUs below safety stock" (700ms); "Validating supplier lead times" (800ms); "Generating purchase orders" (950ms, netsuite); "Notifying ops in #inventory-alerts" (600ms, slack).
   - Success title: "62 SKUs reordered, 3 flagged for review."
   - Metrics: POs generated = 62 · Stockouts prevented = $84,200 · Hours saved = 11h.
   - Aha: "Three SKUs hit a seasonality spike I haven't seen before — paused those for a human review instead of auto-firing."
   - Detail: "POs sit in `Pending Approval` in NetSuite. The 3 flagged items are in **#inventory-alerts** with my reasoning attached."

3. **`finance` — "Process finance report"**
   - Subtitle: "QuickBooks → variance memo", icon: 📊 on purple-blue gradient.
   - User prompt: "Close Q3 — pull the actuals from QuickBooks, compare to plan, and draft the variance memo for Friday's board prep."
   - Bot intro: "Closing Q3 now. Reconciling actuals, building the variance walk, and drafting the memo with footnotes."
   - Steps: "Reconciling 1,847 transactions in QuickBooks" (1100ms, quickbooks); "Mapping to plan categories" (850ms); "Computing line-item variances" (700ms); "Drafting executive variance memo" (1100ms); "Generating board-ready charts" (800ms); "Sharing draft with #finance-leads" (500ms, slack).
   - Success title: "Q3 close packet ready for review."
   - Metrics: Variance vs plan = +4.2% · Memo turnaround = 9 min · Manual hours saved = 14h.
   - Aha: "Spotted a recurring duplicate from one vendor across June and July — I held those out and flagged for AP review before they hit the memo."
   - Detail: "Memo and charts are in **#finance-leads**. Two notes added for the CFO: **OpEx** ran hot on cloud spend, and **headcount** came in under by $86k."

4. **`sales` — "Qualify sales call"**
   - Subtitle: "Gong recap + MEDDIC scoring", icon: 📞 on green-blue gradient.
   - User prompt: "Discovery call with Acme Robotics just wrapped — process the recording, score the deal, and update the pipeline."
   - Bot intro: "Got the recording. Pulling the transcript, scoring against MEDDIC, and updating HubSpot. Should take under a minute."
   - Steps: "Transcribing 38-min call from Gong" (1100ms, gong); "Extracting champion + decision criteria" (900ms); "Scoring against MEDDIC framework" (750ms); "Updating deal record in HubSpot" (700ms, hubspot); "Drafting follow-up email + summary" (950ms); "Posting recap to #deal-room" (500ms, slack).
   - Success title: "Acme Robotics qualified — moved to Stage 3."
   - Metrics: MEDDIC score = 78% · Deal size = $148k · Close confidence = High.
   - Aha: "Their CTO mentioned a 6-week procurement freeze — I flagged the timeline and pre-built a phased rollout option for your follow-up."
   - Detail: "Updated **Acme Robotics — Pilot** in HubSpot. Follow-up email is in your drafts. Two flags: budget signed-off, but legal review may add 2 weeks."

**Integration metadata** (used to render lit-up pills under the process card): hubspot (label "HubSpot", abbr "H", bg #ff7a59), clearbit ("Clearbit", "C", #3b82f6), calendar ("Calendar", "📅", #22c55e), slack ("Slack", "#", #a855f7), netsuite ("NetSuite", "N", #f59e0b), quickbooks ("QuickBooks", "Q", #10b981), gong ("Gong", "G", #ef4444).

**Demo behavior:** clicking a playbook clears the stream, posts the user prompt, then animates each step with a spinner, eventually showing the integrations grid lighting up, the success card with metrics, then the aha + detail cards. `prefers-reduced-motion` shortens delays 4×.

#### Customer proof — Xtractor Depot (small inline quote, dark v3 section)

- Logo: `/xtractordepot-logo.jpg` (48×48).
- Name: "Xtractor Depot"
- Meta: "Industrial equipment supplier · Founder"
- Three stat blocks: **14h** saved/wk · **8 min** response · **30d** to live.
- Quote (verbatim):
  > "Honestly, I was skeptical. We'd tried software before and it always ended up as one more thing to manage. By day 30 we had a live agent handling our quote intake — no babysitting required. **I wish we'd done this two years ago.**"
- Cite: "— Andrew, Founder, Xtractor Depot"

#### 30-day Timeline (4-up cards, dark v3 section)

- Eyebrow pill: "30-DAY DEPLOYMENT · BUILT-IN GUARANTEE"
- H2: "From kickoff to **live agents** in 30 days." (the second clause is the orange/blue-gradient `.accent`)
- Lede: "Four weeks. Four milestones. A working AI department by the end of the month — or your money back."
- Cards (each has step number, eyebrow, H3, paragraph, animated bar fill):
  1. **Week 1 · Diagnose** — "Map your stack & find the wins." — "Workshops with your team. Audit of NetSuite, HubSpot, QuickBooks, Slack. Locked deployment plan." (`--fill: 0.25`)
  2. **Week 2 · Build** — "Wire the agents into production." — "Custom agent built and integrated with your real systems. First workflow running end-to-end in staging." (`--fill: 0.50`)
  3. **Week 3 · Test** — "Pressure-test on real volume." — "Run agents against last quarter's data. Tune the edges. Approval flows wired into Slack." (`--fill: 0.75`)
  4. **Week 4 · Live** — "Production. Day-one ROI." — "Agents take live traffic. Daily health checks. Monthly retainer kicks in for ongoing iteration." (`--fill: 1`)

#### FAQ section (`#faq`)

- Eyebrow: `FAQ`
- H2: "Common questions"
- Lede: "We deploy AI agents into your operating business — automating your highest-friction workflows. Flat monthly fee. Go-live guarantee."
- Six `<details>` items (white cards on the v2 paper, transparent in v3 dark):
  1. **How is this different from hiring an AI consultant?** "We build and run the agents ourselves. You get working software, not a strategy deck."
  2. **Do I need technical staff to work with you?** "No. We handle everything — setup, integration, training, and maintenance. Your team just uses the results."
  3. **What kinds of businesses do you work with?** "Established businesses with real workflows to automate. We work best with companies doing $1M+ in revenue that have repetitive, high-volume processes."
  4. **What if it doesn't work in 30 days?** "You get a full refund. No questions asked."
  5. **What does the monthly fee cover?** "Uptime, maintenance, iteration, and ongoing improvements. As your business grows, we expand the system without a new engagement."
  6. **How long does onboarding take?** "Most clients are live within 30 days. We run a structured onboarding — discovery, build, test, launch — and your first automation is typically running in week two."
- After the grid, a CTA: "Get your free automation map →" → `/questionnaire`. Subtext: "2-minute questionnaire · your personalized AI deployment map, free."

#### Pricing (`#pricing`)

- Eyebrow: `Pricing`
- H2: "Simple, performance-backed pricing."
- Lede: "We guarantee your AI agent goes live within 30 days — or you get a full refund. No partial payments, no fine print."
- Compare hint: "Wondering how this compares to hiring a VA? See the full breakdown →" (link to `/comparison`)
- **Billing toggle:** Monthly / Annual segmented control. Annual is default. When annual is on, a green pill shows "🎁 2 months free".
- **Three cards (Tailwind grid, equal heights):**

##### Starter
- Annual: `$2,083/mo` · "billed annually · save $5,000 · + $2,500 onboarding"
- Monthly: `$2,500/mo` · "+ $2,500 one-time onboarding"
- Best for: "5–30 employees"
- Features:
  - Custom AI agent trained to your business
  - Up to 5 workflow automations
  - 3–5 software integrations
  - Monthly check-in call
  - All compute & hosting included
- CTA: "Get started →" → `/book?tier=starter&billing={annual|monthly}`

##### Growth (★ Most popular — outlined in `--accent`, gradient-bg, slightly elevated `translateY(-6px)`)
- Annual: `$4,167/mo` · "billed annually · save $10,000 · + $3,500 onboarding"
- Monthly: `$5,000/mo` · "+ $3,500 one-time onboarding"
- Best for: "30–100 employees"
- Features:
  - Custom AI agent — expanded scope
  - Up to 15 workflow automations
  - 10+ software integrations
  - Weekly check-ins + monthly strategy call
  - All compute & hosting included
- CTA: "Get started →" → `/book?tier=growth&billing={annual|monthly}` (filled with `--accent`)

##### Enterprise
- Headline: "From $10K/mo"
- Note: "Scoped on call · Custom SLA"
- Best for: "100+ employees"
- Features:
  - Full AI operations buildout
  - Unlimited workflow automations
  - Custom development & integrations
  - Dedicated support + QBRs
  - White-label option available
- CTA: "Let's talk →" → `/book?tier=enterprise&billing={annual|monthly}`

**Guarantee banner (under the cards):**
- Shield icon (amber, 22×22 in a 44×44 cream circle).
- Strong: "30-day guaranteed satisfaction or your money back."
- Subtext (color #92400E): "If your AI agent isn't live and running within 30 days, you get a full refund. No questions, no partial payments, no fine print."

**Below the banner:** "Not ready to commit? **Book a free 30-minute discovery call first.**" (link to `/book`)

#### Final CTA (dual-radial-gradient dark card, `#get-started`)

- Eyebrow pill: "30-DAY GUARANTEE · OR YOUR MONEY BACK"
- H2: "Ready to ramp **your AI department?**" (gradient on the second clause)
- Lede: "30-minute call. We'll map your highest-leverage automation, scope a deployment plan, and show you the exact ROI math — free, no commitment."
- CTAs:
  - Primary: "Book a discovery call →" → `/book`
  - Ghost: "Get your free roadmap" → `/free-roadmap`
- Trust strip (3 inline pills): "Free · No commitment" / "30 minutes" / "Live in 30 days, or refund"

#### Homepage scripts

- Smooth-scroll for `a[href^="#"]`.
- `setBilling(isAnnual)` toggles all the prices, the green badge, and rewrites every `[data-tier-cta]` `href` to `/book?tier=X&billing=Y`. Default = annual.
- IntersectionObserver count-up animation for any `[data-countup]` element.
- IntersectionObserver staggers the `.in-view` class onto the four timeline cards (140ms apart).
- Slack-demo state machine — see "Implementation notes" at the bottom.

#### Homepage JSON-LD

Three `<script type="application/ld+json">` blocks: `WebSite`, `Organization`, and `FAQPage` (mirroring the six FAQ items).

---

### /about — `about.html`

**Title:** `About — Ramped AI`
**Meta description:** `Meet the team behind Ramped AI — operators who built the AI department they wished they'd had.`
**Canonical:** `https://www.30dayramp.com/about`

#### Hero (proportions matched to homepage)

- Eyebrow pill: "About Ramped AI"
- H1 (clamp 2.2rem–3.4rem): "Built by operators,<br>for operators."
- Lede (max-width 620px):
  > "Ramped AI was founded by business owners who experienced the problem firsthand — manual, repetitive tasks draining time and capping growth. We didn't hire consultants to solve it. We built the AI department we wished we'd had."
- Founder credit: "Founded by **Andrew Yoon** — 10-year operator at Xtractor Depot."

#### Origin story section

- Eyebrow: `Our story`
- H2: "We lived the problem before we built the solution."
- Three paragraphs:
  1. "Running Xtractor Depot — a fast-scaling physical-goods business supplying extraction equipment to clients from cannabis operators to SpaceX and Lucid Motors — meant dealing with an endless stream of manual, repetitive tasks. Quote intake. Follow-up emails. Lead qualification. Status updates. Each one small on its own. Together, they consumed weeks of productive time every month."
  2. "Existing AI tools promised automation but delivered dashboards. Consultants delivered decks, not working software. The market had a clear gap: no one was actually building and running the systems for you on an ongoing basis."
  3. "Ramped AI was founded to close that gap. We deploy a fully operational AI department for any operating business — live in 30 days, on a flat monthly retainer. No technical staff required. No endless onboarding. Just results."

#### Team section (white in v2, transparent dark in v3)

- Eyebrow: `The team`
- H2: "Operators first. Technologists second."
- Lede: "Two co-founders. We've spent years inside operating businesses — running them, banking them, building for them — and we know exactly what it costs to have the wrong systems."

##### Andrew Yoon — Co-Founder & CEO
- Avatar: `/assets/team/andrew.jpg` (72×72, circular, object-position center 32%).
- Bio paragraphs:
  1. "Andrew founded Xtractor Depot in 2016, growing it into a multi-industry supplier of precision lab equipment to clients ranging from cannabis operators to SpaceX and Lucid Motors. A Saint Louis University accounting graduate, he started his entrepreneurial journey in college."
  2. "Running a fast-scaling physical-goods business exposed a universal gap: no one was building and running AI automation systems for operating businesses on an ongoing basis. That insight became Ramped AI."
  3. "Outside the office, Andrew plays ice hockey, golf, tennis, and paintball. He lives in Los Angeles County with his wife Steph and their dogs."
- Tags: Operations · B2B Sales · Manufacturing · AI Strategy

##### Jonathan Roh — Co-Founder & COO
- Avatar: `/assets/team/jonathan.jpg`.
- Bio paragraphs:
  1. "A University of Missouri Trulaske College of Business graduate and Dean's List honoree, Jonathan started his career in commercial banking, working closely with owner-operators across manufacturing, distribution, and professional services."
  2. "Hundreds of conversations later, he kept seeing the same pattern: manual workflows wasting hours every week, delaying customer responses, holding back businesses ready to scale. That insight led him to co-found Ramped AI alongside Andrew."
  3. "As COO, Jonathan owns day-to-day execution and client delivery — making sure every implementation runs autonomously from week one. A Missouri native, he's based in the Chesterfield area."
- Tags: Operations · Client Delivery · Banking & Finance · Process Design

#### Values section ("How we work")

- Eyebrow: `How we work`
- H2: "A few things we care deeply about."
- Four cards (icon + title + paragraph):
  1. **Results, not reports** — "We measure success by hours saved and revenue recovered — not decks delivered or dashboards built."
  2. **We own the risk** — "30-day go-live guarantee with a full refund if we miss it. We don't get paid unless it works."
  3. **One bill, everything included** — "AI compute, hosting, maintenance, and iteration — all covered. No surprise invoices, no 'that's out of scope.'"
  4. **Grows with you** — "As your business scales, we expand the system. No new engagement, no renegotiation — just more automation."

#### CTA section (centered)

- H2: "Ready to ramp?"
- Lede: "Book a free 30-minute discovery call. We'll map out your biggest automation win and show you exactly what it's worth."
- CTA: "Book a free discovery call →" → `/book`
- Fineprint: "Free · No commitment · Live in 30 days or it's free"

#### About JSON-LD

`AboutPage` schema with `mainEntity` containing two `Person` objects (Andrew + Jonathan), with their `alumniOf` colleges.

---

### /book — `book.html`

**Title:** `Book a Discovery Call — Ramped AI`
**Meta description:** `Schedule a free 30-minute discovery call with the Ramped AI team.`
**Canonical:** `https://www.30dayramp.com/book`

**Layout:** Two-column "booking shell" inside `<main>`. Box-shadow `4px 4px 0 var(--ink)` for the brutalist edge.

#### Left panel (info)

- H1 (22px, weight 700): "Book a free 30-min discovery call"
- Lede: "We'll map out exactly what AI can automate in your business — no pitch, just a real conversation."
- "What we'll cover" list (4 ✓ bullets):
  - "Where AI can save you 10+ hours/week right now"
  - "Which workflows to automate first for fastest ROI"
  - "What a 30-day implementation looks like for your business"
  - "Honest assessment — if it's not a fit, we'll tell you"
- **Guarantee badge** (cream surface in v2, dark amber in v3):
  - Shield icon.
  - Title: "30-day go-live guarantee"
  - Body: "If your AI agent isn't live in 30 days, you get a full refund. No questions, no partial payments, no fine print."

#### Right panel — multi-step booking flow (`#booking-step`)

The right panel renders one step at a time, swapping content as the user progresses.

##### Step 1 — Calendar
- Loaded by `/api/availability` (returns `{ days_available, start_hour, end_hour, slot_duration_min, blocked_dates }`). Falls back to defaults if API is down: Mon–Fri, 9–17, 30-min slots.
- Calendar nav: ‹ MonthName YYYY › . Day-of-week headers Su Mo Tu We Th Fr Sa.
- Past dates disabled. Today gets a 2px ring in `--accent`. Selected day fills with `--accent`.
- Footer note: "Times in your local timezone".

##### Step 2 — Slot picker
- Back button: "← {Weekday, Month Day}".
- TZ note: "Times shown in your local timezone · **{IANA tz}**".
- Slot grid (2 columns). Slots within 30 min of now, or already booked (from `/api/book?date=…` `booked` array), are disabled.
- Slots are computed from a Chicago-time anchor (`HOST_TZ = 'America/Chicago'`) and rendered in the visitor's timezone.

##### Step 3 — Form
- Back button: "← {Weekday, Month Day} at {time}".
- If a `tier` URL param was passed, a blue tier-interest badge renders above the form. Tier labels (annual default):
  - `starter` → "Starter · $2,083/mo (billed annually · save $5,000)"
  - `growth` → "Growth · $4,167/mo (billed annually · save $10,000)"
  - `enterprise` → "Enterprise · from $10K/mo · scoped on call"
  - In monthly mode: "Starter · $2,500/mo", "Growth · $5,000/mo", same enterprise line.
  - Format: `📋 Plan interest: …`
- Fields:
  - **Your Name** (label "YOUR NAME *", required, autocomplete name, placeholder "Jane Smith")
  - **Work Email** (label "WORK EMAIL *", required type=email, autocomplete email, placeholder "jane@company.com")
  - **Company Name** (label "COMPANY NAME", optional, autocomplete organization, placeholder "Acme Inc.")
  - **What can we help with?** (label "WHAT CAN WE HELP WITH?", textarea rows=3, placeholder "Brief context helps us prep…")
- Submit button: "Confirm booking →" (full width, ink background).
- Client-side validation: name length ≥ 2, email regex + invalid-TLD blocklist (`invalid|test|example|localhost|local`).
- Submits to **`POST /api/book`** with body:
  ```json
  { "datetime": "<UTC ISO>", "name", "email", "company", "notes",
    "timezone": "<visitor IANA>", "tier": "<starter|growth|enterprise|''>", "billing": "<annual|monthly>" }
  ```
- Error mapping:
  - 409 → "That slot was just booked — please pick another time." (auto-redirects to slot picker after 2s)
  - 429 → "Too many requests — please wait a moment and try again."
  - other → server `error` field or "Something went wrong — please try again."
- Captures `booking_id` from the response and stores on `window._lastBookingId` for the inline questionnaire.

##### Step 4 — Confirmation + post-booking questionnaire
- ✓ block: "You're booked!" + "{Weekday, Month Day} at {time}" + "Confirmation sent to {email} · Google Meet link coming before the call." + "Need to change it? **Reschedule or cancel**." (mailto link to `jon@30dayramp.com` with prefilled subject + body).
- Indigo callout: "🗺️ Help us prepare your roadmap" / "Answer a few quick questions so we can build your custom automation plan before the call. Takes ~2 minutes."
- 12-step inline questionnaire (the `Q_STEPS` array — see the `/questionnaire` page for the same data, conceptually):
  1. **`pain_points` (checkbox)** — "What's eating your team's time?" / "Select all that apply" — Lead follow-up & nurturing · Scheduling & calendar management · Answering repetitive questions · Quotes & proposal sending · Order / invoice processing · Appointment reminders & no-shows · Customer support tickets · Social media posting · Data entry & reporting · Employee onboarding.
  2. **`industry` (text)** — "What industry are you in?" / placeholder "e.g. Real Estate, E-commerce, Law, Cannabis…"
  3. **`team_size` (radio)** — "How big is your team?" — 1–5 · 6–15 · 16–50 · 51–100 · 100+
  4. **`revenue` (radio)** — "Annual revenue?" — Under $300K/yr · $300K–$1M/yr · $1M–$5M/yr · $5M+/yr
  5. **`lead_source` (radio)** — "How do clients find you?" — Referrals · Instagram / LinkedIn · Cold outreach · Google / SEO · Paid ads · Word of mouth
  6. **`inbound` (radio)** — "How do customers primarily contact you?" — Phone / Voice · Email · Website / Form · Social media DM · Walk-in · Multiple channels
  7. **`integrations` (checkbox)** — "Which platforms does your business use?" — WhatsApp Business · Instagram / Facebook DM · SMS / Text (Twilio) · Telegram · Slack · Discord · Email (Gmail / Outlook) · Website chat · Shopify · Google Calendar · Airtable · Make / Zapier · HubSpot · Salesforce / Other CRM · Notion · ClickUp / Asana / Monday · Stripe · QuickBooks / Xero
  8. **`crm` (radio)** — "Current CRM?" — HubSpot · Salesforce · GoHighLevel · Pipedrive · Other CRM · No CRM yet
  9. **`email_provider` (radio)** — "Email provider?" — Google Workspace / Gmail · Outlook / M365 · Both · Other
  10. **`device_os` (radio)** — "What OS does your team use?" — Mac · Windows · Linux / Server · Mixed / Not sure
  11. **`ai_tools` (checkbox)** — "Are you using AI tools in your business?" — ChatGPT / OpenAI · Claude / Anthropic · Google Gemini · Microsoft Copilot · Make AI / Zapier AI · Not using AI yet
  12. **`automation_goal` (textarea, optional)** — "What's the first thing you'd want an AI agent to handle?" / placeholder "e.g. 'Follow up with leads that haven't responded in 48 hours and automatically book them…'"
- Each step shows `Step {n} of 12` plus a 3px progress bar that fills with `--accent`.
- Step 1 has a "Skip for now" link that jumps directly to the final "You're all set" state.
- Radio steps auto-advance after 220ms.
- On submit, posts to **`POST /api/questionnaire`** with `{ email, booking_id, pain_points, automation_goal, industry, team_size, revenue, lead_source, inbound, integrations, crm, email_provider, device_os, ai_tools, tier }`.
- Submitting state: 🗺️ "You're all set!" / "We're building your custom automation roadmap now. You'll receive it before the call so we can hit the ground running." / "See you on the call!" / "← Back to home"
- Skip-to-end state: "✓ You're all set!" / "We'll send a Google Meet link before the call. See you soon!" / "← Back to home"

#### URL params
- `?tier=starter|growth|enterprise` — surfaces the tier-interest badge.
- `?billing=annual|monthly` — controls which price set the badge displays. Default annual.

#### Book JSON-LD
`Service` schema with `provider` = Ramped AI, `offers` = Starter, Growth, Enterprise (price keys partially visible — Starter = $2,500/MON USD, etc.).

---

### /comparison — `comparison.html`

**Title:** `VA vs. AI Agents — Ramped AI`
**Meta description:** `See why founders are replacing virtual assistants with AI agents from Ramped AI. A full cost, availability, and performance comparison.`
**Canonical:** `https://www.30dayramp.com/comparison`

#### Hero

- Pill (with green dot): "AI vs. VA — A breakdown founders actually need"
- H1 (3 lines, gradient `--accent` on second clause):
  - "Why founders are choosing"
  - "**AI agents** over"
  - "virtual assistants"
- Lede: "A VA is a person — with a timezone, a sick day, and a learning curve. An AI agent is infrastructure. Here's the honest comparison, line by line."
- CTAs: "Get started with Ramped →" → `/book` and "See a live agent demo" → `/#demo-shell`

#### 01 — Head to head (full comparison table)

Eyebrow: `01 — Head to head`
H2: "The full comparison"
Lede: "Every dimension that matters when you're deciding where to put $30K–$48K a year."

| Category | Virtual Assistant (col-va) | Ramped AI (col-ramp-win) |
|---|---|---|
| Cost | $2,500–$4,000/mo · $30K–$48K per year, indefinitely | From $2,500/mo + $2,500 onboarding · Predictable, scales with workflows · ✓ Winner |
| Setup time | 2–6 weeks to hire & onboard · Then weeks more to be productive | Live in 30 days · Guaranteed deployment timeline · ✓ Winner |
| Availability (hours) | ~8 hrs/day, 5 days/week · Timezone-dependent | 24/7/365 · No downtime, no timezone friction · ✓ Winner |
| Response time | Minutes to hours · Depends on workload & hours | < 60 seconds · Consistent, every time · ✓ Winner |
| Consistency | Variable — good days and bad days · Human error, fatigue, mood | Identical output every run · Same quality at 2am as 2pm · ✓ Winner |
| Scalability | Hire another person · Linear cost, linear effort | Handle 10× volume, same cost · No additional headcount needed · ✓ Winner |
| Sick days & turnover | Yes — and re-training costs time & money · Average VA tenure: 18 months | Zero sick days. No turnover. · Institutional knowledge never walks out · ✓ Winner |
| Learning curve | 90 days to full productivity · You pay during ramp-up | Trained on your SOP from day 1 · No productivity tax on your team · ✓ Winner |
| Money-back guarantee | None · Sunk cost if it doesn't work out | Full refund if not live in 30 days · We don't get paid if we don't deliver · ✓ Winner |
| Deep relationship building | ✓ Human warmth, long-term rapport · Personal connection over time | Handles volume; rep closes the relationship · Agent qualifies & nurtures, human closes |

(Mobile: "Swipe to see more →" hint with right fade gradient.)

#### 02 — The math (3-year cost comparison)

Eyebrow: `02 — The math`
H2: "What it actually costs over 3 years"
Lede: "Most founders compare monthly VA cost to monthly retainer cost and stop there. That misses the compounding advantage."

**VA card** (border-left amber):
- Chip: "Virtual Assistant"
- Big number: **$108,000**
- Subtitle: "Total spend over 3 years (mid-range $3k/mo)"
- Bullets (✕ icons):
  - $3,000/mo × 36 months = $108,000
  - Plus 2–4 weeks of lost time onboarding
  - Re-training costs when VA turns over
  - Only available ~40 hrs/week max
  - Every new task = more instructions = more time from you
- Bar fill 100%, label "$108K baseline"

**Ramped card** (border-left `--good` green):
- Chip: "Ramped AI"
- Big number: **$92,500**
- Subtitle: "Total over 3 years (Starter: onboarding + $2,500/mo)"
- Bullets (✓ icons):
  - $2,500 onboarding + $2,500/mo × 36 = $92,500
  - Live and productive from day 30
  - Zero turnover risk — knowledge compounds
  - Runs 24/7 — 3× the coverage hours
  - Volume scales without adding headcount
- Bar fill 86%, label "~86% of VA cost — with 3× the coverage hours"

**Ink callout (white-on-ink card):**
- Eyebrow: "The bottom line"
- H3: "Save ~$15K over 3 years.<br/>Get 3× the hours. Zero turnover risk."
- Subtext: "That's before you factor in a single lead captured at 11pm, a missed call that actually got followed up, or a proposal that went out the same day instead of next week."
- CTA: "Start saving now →" → `/book`

#### 03 — Why it works (Three things a VA can't do)

Eyebrow: `03 — Why it works`
H2: "Three things a VA can't do"
Lede: "These aren't edge cases. They're the scenarios that show up every week in every growing business."

Three cards:

1. **Works 24/7** — clock icon (blue bg)
   - "A lead fills out your form at 9pm on a Friday. Your VA is offline. Your AI agent responds in under 60 seconds, qualifies the lead, and books the meeting — before your competitor even opens their email Monday morning."
   - Coverage comparison bars: VA ~40 hrs/wk vs Ramped 168 hrs/wk.

2. **Never forgets a lead** — phone-ring icon (green bg)
   - "VAs context-switch, get pulled into other tasks, and miss follow-ups. An AI agent has one job: move every lead through the pipeline with the exact right message at the exact right time. No exceptions. No forgotten threads."
   - Stats: 62% VA average follow-up rate · 100% AI agent follow-up rate.

3. **Scales instantly** — bolt icon (amber bg)
   - "Your VA handles 30 tasks a week. You land a new contract and need 300 done. You either hire, scramble, or drop things. With an AI agent, 10× volume is just another Tuesday. No hiring cycle. No quality dip."
   - Cost to 10× capacity: 10× VA cost (hire more people) · $0 Ramped cost (already included).

#### 04 — vs DIY tools (Lindy/Zapier/Gumloop)

Eyebrow: `04 — vs DIY tools`
H2: "Why not just use Lindy or Zapier?"
Lede: "DIY automation tools work — if you have the time. Most $1M+ businesses don't. Here's the actual tradeoff."

| | DIY tools (Lindy · Zapier · Gumloop) | Ramped AI (Done-for-you · monthly retainer) |
|---|---|---|
| Who builds it | You. 4–40 hours per workflow. · Plus learning the tool's quirks. | We do. ~1 hour of your time briefing us. · Discovery call → roadmap → live in 30 days. |
| Who runs it | You. Monitor. Fix when it breaks. · Plus debugging when an integration silently fails. | We do. Agent goes down → we fix it. · You don't notice unless we ask you to weigh in. |
| Memory + learning | Workflow steps only. No memory. · Each run starts fresh; no context across calls. | Agents have a live knowledge base. · Refines its own playbooks based on what worked. |
| Sticker price | $30–200/mo · Self-serve subscriptions. | $2,500/mo + onboarding · Flat retainer · no per-seat · no per-task. |
| Total cost (you-time included) | $30/mo + ~10 hrs/wk of your time · At $200/hr operator-time, that's $8,000/mo of your time alone. | $2,500/mo · ~30 min/week from you · All build + run hours come out of our budget, not yours. |
| Risk reversal | None. Cancel anytime. · If it doesn't work, you lose the time you invested. | **30-day go-live guarantee — full refund if we miss.** · No fine print. No partial payments. |

**Bottom-line ink callout:**
- Eyebrow: "The bottom line"
- H3: "DIY tools sell software.<br/>Ramped sells the outcome — and owns it."
- Subtext: "If you have the time and patience to learn another tool and become its operator, Lindy and Gumloop are great. If you want agents running your business while you focus on the parts only you can do, that's the trade Ramped exists to make."
- CTA: "Book a discovery call →" → `/book`

#### 05 — Fair questions (objection handling)

Eyebrow: `05 — Fair questions`
H2: "Things we hear from founders"

Four cards:

- **"My VA knows my business. Will an agent understand context?"** — "We spend week one of every engagement encoding your SOPs, your voice, your decision logic, and your history into the agent. It knows your business on day 30. And it never forgets what it learned."
- **"What if I need something done that the agent can't do?"** — "We design around your actual workflow — not a generic template. If a task requires human judgment, we build a handoff into the agent so the right thing gets escalated to the right person, every time."
- **"I'm not technical. Can I manage this myself?"** — "You don't need to. That's the whole point. We operate it for you, just like an outsourced IT partner. If something breaks or needs updating, that's on us — not you."
- **"What happens if AI gets it wrong?"** — "We build confidence thresholds and human-in-the-loop checkpoints for high-stakes decisions. The agent handles volume and speed. You stay in control of anything that matters most."

#### Final CTA (`#get-started`, dark ink background)

- Pill: "Limited spots available — apply now"
- H2 (white): "Ready to retire your VA<br/>and build something that scales?"
- Lede: "Book a free 30-min call. We'll map your biggest operational bottleneck and show you what an agent would do with it."
- CTAs: "Book a free 30-min call →" → `/book` (paper button) · "See the agent demo" → `/#demo-shell` (ghost)
- Fineprint: "No pitch deck. No sales cycle. Just a real conversation about your operations."

#### Comparison JSON-LD
`FAQPage` schema mirroring the four objection-handling Q&As.

---

### /agent-library — `agent-library.html`

**Title:** `Agent Library — See Ramped Bot work | Ramped AI`
**Meta description:** `See the AI agents Ramped builds for operating businesses, working in real Slack workflows. Ops, sales, finance, customer support — Ramped Bot replies in seconds, with proactive heads-ups.`
**Canonical:** `https://www.30dayramp.com/agent-library`

**Special note:** every scenario embeds a pixel-perfect Slack mockup (purple sidebar #3F0E40, traffic-light chrome, Lato font) with looping 14-second animations: customer message appears → bot typing indicator → bot reply with action buttons → "Replied · Xs · …" green pill. `prefers-reduced-motion` collapses to static frames. The page nav uses a simplified masthead (no mobile drawer toggle in the HTML) and a custom 3-column footer.

#### Hero

- Eyebrow: "Agent library · Live in your stack"
- H1: "See Ramped Bot work."
- Deck: "Every Ramped agent lives where your team already does — **Slack, HubSpot, NetSuite, QuickBooks, Gmail**. Below, four real workflows we deploy in the first 30 days, replying in **14 seconds or less**, catching errors humans miss, asking before they send."
- TOC pills (anchor links): `Ops · Inventory question` (`#ops`) · `Sales · Lead intake` (`#sales`) · `Finance · Monthly close` (`#finance`) · `Support · Ticket triage` (`#support`)

#### Scenario 01 — Operations (`#ops`)

- Meta: `Scenario 01 · Operations · 14s response`
- H2: "\"Are we still shipping Acme's order?\" — answered in 14 seconds."
- Body para 1: "Marcus, your ops manager, asks the question that used to take 12 minutes of cross-checking NetSuite, the tracking portal, and the customer's last invoice. Ramped Bot does it instantly — **and catches the stale shipping address before the package leaves the warehouse**."
- Body para 2: "This is where most operators meet Ramped Bot for the first time. The question is mundane. The agent's answer is what makes them stop and say \"wait, what?\""
- Integrations chips: Slack · NetSuite · UPS API · Gmail
- Outcomes: **14s** response time · **−12 min** per question · **11/mo** errors caught
- Slack mockup conversation:
  - Channel `#support` (4 members), workspace "Acme"
  - Marcus Chen (av-cust orange) — 10:42 AM: "Are we still on track to ship Acme's Q3 inventory order? Andrew's asking."
  - Ramped Bot [APP] typing — "Pulling order #2847 from NetSuite…"
  - Ramped Bot [APP] reply: "Pulled order #2847 — picked & packed yesterday, UPS Ground, ETA **Wed Nov 12**.<br>⚠️ **Heads up:** shipping address is the old Reno warehouse. Acme relocated last month. Drafted a confirm email — want me to send?<br>→ View draft · View in NetSuite"
    - Action buttons: green "Send draft" / white "Edit"
  - Replied pill: "Replied · 14s · ticket #1247 closed · 12 min saved"

#### Scenario 02 — Sales (`#sales`)

- Meta: `Scenario 02 · Sales · 11s response`
- H2: "Hot lead in. Bot enriches. You get a meeting on the calendar."
- Body para 1: "Sarah flags a website lead. Ramped Bot pulls the company's HubSpot record, runs a Clearbit enrichment, scores it against your ICP, drafts an intro reply with your Cal link, and pings the owner. Total time: **11 seconds**. Total work for Sarah: **one click**."
- Body para 2: "Most ops teams bleed 2-3 weeks of revenue on slow lead response. Ramped Bot closes that gap instantly — even at 11pm on a Sunday."
- Integrations: Slack · HubSpot · Clearbit · Calendly
- Outcomes: **3×** faster response · **+$120K** pipeline added/mo · **0 leads** missed overnight
- Slack mockup conversation:
  - Channel `#sales` (7 members)
  - Sarah Kim (av-cust-2 purple) — 2:14 PM: "Hot lead just came through the website — Acme Industrial. Can you take a look?"
  - Ramped Bot typing: "Enriching from HubSpot + Clearbit…"
  - Ramped Bot reply: "**Acme Industrial** — 87 employees, $12M ARR, manufacturing.<br>Form notes: *\"replacing 2 inside reps\"* — strong fit. ICP score **9/10**. Drafted intro w/ your Cal link & tagged @Sarah.<br>→ View draft · View in HubSpot"
    - Actions: green "Send" / "Edit"
  - Replied: "Replied · 11s · meeting booked Wed 2pm · pipeline +$120K"

#### Scenario 03 — Finance (`#finance`)

- Meta: `Scenario 03 · Finance · 9s response`
- H2: "Board call in 20 minutes. Bot pulls the close."
- Body para 1: "Andrew, the CEO, needs October's number before he walks into the boardroom. Used to mean texting the bookkeeper, waiting, double-checking. Now: ask in Slack, get revenue + top expense category + flagged anomalies in **9 seconds**."
- Body para 2: "The bot also catches **3 invoices over 60 days unpaid** — the kind of cash-flow leak that's sitting in plain sight in every accounting system but nobody pings about."
- Integrations: Slack · QuickBooks · Stripe · Drive
- Outcomes: **9s** to close summary · **−45 min** before each board call · **$42K** collections flagged
- Slack mockup:
  - Channel `#finance` (3 members)
  - Andrew Yoon (av-cust-3 teal) — 4:42 PM: "Quick — what does October close look like? Board call in 20 min."
  - Ramped Bot typing: "Pulling October from QuickBooks + Stripe…"
  - Ramped Bot reply: "**October close:** Revenue **$1.24M (+18% MoM)**. Top expense: cloud infra **$87K (+32%)** — flagging.<br>⚠️ 3 invoices >60d unpaid totaling **$42K**. Queued the deck in Drive.<br>→ View summary · View P&L"
    - Actions: green "Open deck" / "Email collections"
  - Replied: "Replied · 9s · summary posted to #leadership · saved 45 min"

#### Scenario 04 — Customer Support (`#support`)

- Meta: `Scenario 04 · Customer Support · 18s response`
- H2: "Customer ticket. Bot drafts. You approve. Sent."
- Body para 1: "Jennifer, your customer success lead, watches a ticket land in `#cs-inbox`. Ramped Bot reads it, pulls the customer's order history, drafts a personalized response with the right tracking info, and queues it for one-click approval. **The bot never sends without you.**"
- Body para 2: "Approval-by-default is the difference between \"AI is risky\" and \"AI is just another teammate.\" Every customer-facing touchpoint goes through your team's review. The bot just does the busywork."
- Integrations: Slack · Zendesk · Shopify · UPS API
- Outcomes: **18s** median response · **−9 hrs/wk** support workload · **100%** human approval
- Slack mockup:
  - Channel `#cs-inbox` (5 members)
  - Jennifer R. (av-cust-4 pink) — 11:08 AM: "New ticket from Karen at @ParkviewClinic — says her shipment hasn't arrived. Can you check?"
  - Ramped Bot typing: "Pulling ticket #4127 + UPS tracking…"
  - Ramped Bot reply: "Order #5512 — UPS scan delayed at Reno hub due to weather. New ETA **tomorrow 3pm**.<br>Drafted reply to Karen with the new tracking + a **15% credit on her next order** for the inconvenience.<br>→ View draft · View ticket"
    - Actions: green "Send draft" / "Edit"
  - Replied: "Replied · 18s · ticket #4127 in queue · awaiting your approval"

#### CTA section (dark ink)

- H2: "Want this running in your business?"
- Lede: "Book a 30-minute discovery call. We'll map your top three workflows and show you exactly which agents we'd build first. Live in 30 days. Or it's free."
- CTA: "Book a discovery call →" → `/book`

#### Custom footer (3-column, agent-library only)

- Col 1: Logo + "Done-for-you AI agents in your operating business. Live in 30 days. Or it's free."
- Col 2 (Product): About · Compare · Book a call
- Col 3 (Company): Team · `jon@30dayramp.com` · Privacy
- Bottom: "© 2026 Ramped AI. All rights reserved. · 30dayramp.com"

---

### /free-roadmap — `free-roadmap.html`

**Title:** `Get your free AI automation roadmap — Ramped AI`
**Meta description:** `Tell us about your business. Get a personalized roadmap of the 3–5 AI agents we'd build for you. Free. No call required. ~3 minutes.`
**Canonical:** `https://www.30dayramp.com/free-roadmap`

**Layout:** Two-column main grid (5fr / 4fr on desktop, stacked on mobile). Right column is sticky on desktop.

#### Left column (hero)

- Amber pill eyebrow (warn-colored on cream): "Free · ~3 min · No call required"
- H1 (clamp 2rem–3.2rem): "Get a personalized AI roadmap for **your business**." (the second clause is `--accent` blue)
- Lede: "Tell us about your operation. Our AI consultant generates a custom roadmap of the **3–5 agents we'd build for you** — what they'd do, which tools they'd live in, and how many hours they'd save your team each week. Emailed in under 60 seconds."
- Three checkmark bullets:
  1. "**Specific to you.** If you use HubSpot + Slack, the roadmap names HubSpot + Slack. No generic advice."
  2. "**No call required.** Most prospects book a call after reading the roadmap. Some don't. Either way, the roadmap is yours."
  3. "**Useful even if you DIY.** Take the roadmap. Build it in Lindy, Zapier, n8n, whatever. We'll be here when you want it done for you."
- Amber-bordered guarantee strip:
  - Strong: "30-day go-live guarantee — full refund if we miss."
  - Small: "If you decide to work with us. The roadmap itself is free, no strings."

#### Right column — form card

- H2: "Tell us about your business"
- Sub: "We'll generate your roadmap and email it to you in under 60 seconds."

**Form fields (`#free-roadmap-form`, POSTs to `/api/free-roadmap`):**
- Row 1: Your name * (text, max 120, autocomplete name, placeholder "Andrew") + Email * (email, max 254, placeholder "andrew@company.com")
- Company * (text, max 200, autocomplete organization, placeholder "Xtractor Depot")
- Industry (select):
  - "— Select —"
  - Industrial supply / Manufacturing
  - Field services
  - Professional services
  - Healthcare
  - Legal
  - Real estate
  - Dental / Medical
  - Logistics
  - SaaS / Technology
  - Other
- Row 2: Team size (select: 1–5, 6–20, 21–50, 51–200, 200+) + Annual revenue (select: Under $500K, $500K–$1M, $1M–$5M, $5M–$25M, $25M+)
- "Where's the friction? (pick any)" — checkbox-pill group `#fr-pain`:
  - "Lead follow-up takes too long" (label "Lead follow-up")
  - "Inbox / email triage" (label "Email triage")
  - "Quote / proposal generation" (label "Quotes / proposals")
  - "Customer support / replies" (label "Customer support")
  - "Reporting / analytics" (label "Reporting")
  - "Scheduling / calendar" (label "Scheduling")
  - "Manual data entry / CRM updates" (label "CRM updates")
  - "Other repetitive workflow" (label "Other")
- Tools (text, max 500, placeholder "Slack, HubSpot, Gmail, Stripe, Notion…") — comma-split into array.
- Automation goal (textarea, max 500, optional, placeholder "Replying to inbound RFQs within 5 min so we stop losing deals to faster competitors…")
- Submit button: "Generate my roadmap →"
- Fineprint: "We'll email your roadmap in under 60 seconds. No spam, no follow-up calls — unless you book one."

**Success card (replaces form on success):**
- ✓ check
- H2: "Your roadmap is on the way."
- Body: "Check your inbox in the next 60 seconds. We've sent it to **{email}**. Read it, share it with your team, sleep on it."
- Sub: "When you're ready, here's the next step:"
- CTA: "Book a 30-min discovery call →" (href can be overridden by `book_url` from API response)
- Fallback hint: "Don't see the email? Check spam, or email **jon@30dayramp.com**."

**API contract:**
```
POST /api/free-roadmap
{ name, email, company, industry, team_size, revenue, tools: [], automation_goal, pain_points: [] }
→ { ok: true, book_url? }   on success
→ { error: "…" }            on failure
```

#### Page-specific footer
Single-line: "© 2026 Ramped AI · About · Privacy · jon@30dayramp.com" (centered, 12px muted).

---

### /resources — `resources.html`

**Title:** `AI Resources — Ramped AI`
**Meta description:** `Curated updates from the frontier of AI — Anthropic, OpenAI, DeepMind, The Batch, MIT Tech Review. Refreshed daily.`
**Canonical:** `https://www.30dayramp.com/resources`

**Special note:** content is dynamic. The HTML ships with skeleton placeholders; on load, JavaScript fetches from **`GET /api/resources`** and renders article cards. The page persists no canonical article list of its own.

#### Hero

- Eyebrow: "AI Resources · Refreshed Daily"
- H1: "AI Resources"
- Lede: "Curated updates from the frontier of AI — refreshed daily from Anthropic, OpenAI, DeepMind, and more."

#### Filter tabs (`role="tablist"`)

Six pill buttons that filter the article list:
- All (default active)
- Anthropic
- OpenAI
- DeepMind
- The Batch
- MIT Tech Review

#### Article grid (`#articles-grid`)

While loading, three skeleton-loader cards. Once `/api/resources` resolves, the grid is replaced with `<a class="article-card ink-shadow" target="_blank" rel="noopener noreferrer">` cards, each containing:

- Source badge (one of `badge-anthropic | badge-openai | badge-deepmind | badge-thebatch | badge-mittechreview | badge-default` — colored chips matching brand).
- Article title (the `a.title`).
- Optional summary paragraph.
- Date in "Mon DD, YYYY" format.

If the API returns an empty list, the grid shows an empty-state with: "No articles yet" + "Check back soon — the feed refreshes daily at 8 AM UTC."

A `#article-count` line ("N article(s)" or "N {Source} article(s)") appears below the grid once data has loaded.

#### CTA strip (white slab on v2, dark in v3)

- Eyebrow: "Ready to ramp?"
- H2: "Put AI to work in your business."
- Body: "Deploy production AI agents in 30 days or your money back. No strategy decks — just results."
- CTAs: "Book a free call →" → `/book` · "Watch a demo" → `/#demo-shell`

#### Footer
Standard footer + an extra `Resources` link (active, in `--accent`).

---

### /thanks — `thanks.html`

**Title:** `Thanks — Ramped AI`
**Meta description:** `We got your info — we'll reach out within one business day.`
**Canonical:** `https://www.30dayramp.com/thanks`
**Robots:** `noindex`

**Note:** the file on disk appears truncated (cuts off mid-sentence at the fineprint paragraph). Recreate the visible content as below; the missing tail is presumably "Questions in the meantime? Email **jon@30dayramp.com**." plus a closing footer block.

#### Header (slimmed-down, page-specific)

- Sticky header bar with `Ramped AI` logo + wordmark on the left.
- Right side: a single ghost button "← Back home" → `/`.

#### Main (centered, 640px max)

- Big green ✓ check (56×56 in pale-green pill).
- H1: "Got it — we'll reach out within one business day."
- Lede: "Thanks for telling us about your business. A real person on our team (usually Jon) will review what you sent and follow up by email with next steps."
- Action row:
  - Primary: "Book a free 30-min call →" → `/book`
  - Ghost: "Back to homepage" → `/`
- Fineprint (truncated on disk; reconstruct as):
  > "Questions in the meantime? Email **jon@30dayramp.com**."

---

### /privacy — `privacy.html`

**Title:** `Privacy Policy — Ramped AI`
**Meta description:** `Privacy Policy for Ramped AI — how we collect, use, and protect your information.`
**Canonical:** `https://www.30dayramp.com/privacy`
**Robots:** `noindex`

**Layout:** narrow `prose` column (max-width 720px), left-aligned typography.

- H1: "Privacy Policy"
- Updated stamp: "Last updated: April 20, 2026"

Body (verbatim — this is legal copy, preserve exactly):

> Ramped AI ("we", "us", or "our") operates **30dayramp.com**. This policy explains what information we collect, how we use it, and your rights regarding that information.

#### 1. Information We Collect
- **Contact information** — name, work email, and company name when you submit a form on our site.
- **Booking information** — name, email, company, and selected appointment time when you book a discovery call.
- **Usage data** — standard server logs including IP address, browser type, and pages visited. We do not use invasive tracking or sell your data.

#### 2. How We Use Your Information
- To respond to your inquiry or confirm your scheduled call.
- To send a calendar invitation and meeting link for booked appointments.
- To improve our website and services.
- We do not sell, rent, or share your personal information with third parties for marketing purposes.

#### 3. Data Storage & Security
> Booking data is stored in [Supabase](https://supabase.com), a SOC 2 Type II compliant platform. Email confirmations are sent via [Resend](https://resend.com). We take reasonable technical precautions to protect your data but cannot guarantee absolute security of data transmitted over the internet.

#### 4. Third-Party Services
> Our site is hosted on [Vercel](https://vercel.com). We use Google Fonts for typography. These services may collect standard access logs. We do not use advertising networks or tracking pixels.

#### 5. Cookies
> We do not use tracking cookies or advertising cookies. Our site may set session-related cookies necessary for basic functionality.

#### 6. Your Rights
> You may request deletion of your personal data at any time by emailing [jon@30dayramp.com](mailto:jon@30dayramp.com). We will respond within 30 days.

#### 7. Children's Privacy
> Our services are not directed at individuals under 18. We do not knowingly collect personal information from minors.

#### 8. Changes to This Policy
> We may update this policy from time to time. Changes will be posted on this page with a revised "Last updated" date.

#### 9. Contact
> Questions about this policy? Email us at [jon@30dayramp.com](mailto:jon@30dayramp.com).

#### 10. Data Processing for Questionnaire Submissions
> When you submit your business questionnaire via our contact form, the information you provide (business description, goals, time drains, tools, and availability) is stored in Supabase and sent by email to our team at [jon@30dayramp.com](mailto:jon@30dayramp.com). We use this information solely to prepare for and conduct your discovery call. We do not use it for advertising, training AI models, or share it with any third party outside of the subprocessors listed in Section 4.

(Standard footer.)

---

### /404 — `404.html`

**Title:** `404 — Page Not Found | Ramped AI`
**Meta description:** `Page not found — return to Ramped AI home.`
**Robots:** `noindex`

**Note:** the file on disk is truncated mid-sentence. Visible content:

#### Layout

- Full-page dark background (`var(--ink)` #0B1220) with subtle 32×32 grid lines (`grid-bg`).
- Top-left absolute logo link: 26×26 swoop + "Ramped AI" wordmark.
- Center stage: a giant ghost "404" (JetBrains Mono, 18vw, opacity 0.08) sitting behind the content.

#### Content (centered)

- Pill badge (mono, blue): "404 — Not Found"
- H1: "This page doesn't exist."
- Hairline divider.
- Sub paragraph (truncated on disk — reconstruct from the visible "But your A…" stub as something like):
  > "But your AI department could. Head back home and pick a path."
- (Likely follows) Primary "btn-home" CTA — back to `/` (styled: blue accent button "Take me home →").

When rebuilding, keep the dark-on-white-text aesthetic distinct from the rest of the site (the 404 is the only fully-dark page in v2; in v3 it already aligns).

---

### /questionnaire — `questionnaire.html`

**Title:** `Get Your Custom Automation Map — Ramped AI`
**Meta description:** `Answer 10 questions and get a custom AI automation map built for your business before your call.`
**Canonical:** `https://www.30dayramp.com/questionnaire`

**Special note:** this page is **gated** — if no `?email=…` URL parameter is present, the script immediately redirects to `/book`. It's intended as a post-booking deliverable handoff (the user lands here with `?email=…&booking_id=…`).

#### Page header

- Page eyebrow (with green dot): "Pre-call deliverable"
- H1 (.page-title): "Get your custom<br>automation map"
- Subtitle: "10 quick questions. We build a tailored automation plan before your Map Call — so your 60 minutes goes straight to action, not discovery."

#### Benefit strip (3 inline items)

- ⏱ "2 minutes to complete"
- 🗺 "Custom map before your call"
- 💰 "ROI quantified in dollars"

#### Progress bar

`Step {n} of 11` label + percentage on the right + animated fill bar (`role="progressbar"`).

#### Eleven steps (the `STEPS` array)

1. **`time_sinks` (checkbox, required, min 1)** — "What's eating your team's time?" / hint "Select all that apply — we'll prioritize the biggest wins."
   - Lead follow-up & nurturing
   - Answering repetitive questions
   - Scheduling & calendar
   - Quotes & proposals
   - Order / invoice processing
   - Customer support tickets
   - Data entry & reporting
   - Employee onboarding

2. **`industry` (text, required)** — "What industry are you in?" / hint "Be specific — this shapes the AI persona and workflows we design." / placeholder "e.g. Cannabis retail, Real estate, Healthcare, E-commerce…"

3. **`team_size` (radio, required)** — "How big is your team?" / hint "Full-time employees including yourself." — 1–10 · 11–25 · 26–50 · 51–100 · 100+

4. **`revenue` (radio, required)** — "Annual revenue?" / hint "Helps us right-size the deployment and pricing tier." — Under $300K · $300K–$1M · $1M–$5M · $5M–$20M · $20M+

5. **`channels` (checkbox, required)** — "How do customers reach you?" / hint "These are the channels your AI coworker will live in." — Phone / Voice · Email · Website / Form · Walk-in · Instagram DM · WhatsApp · Multiple channels

6. **`platforms` (checkbox, optional)** — "Which platforms does your business use?" / hint "We'll wire integrations in order of impact." — Slack · Shopify · HubSpot · Salesforce · Gmail · Outlook · Google Calendar · Airtable · QuickBooks · Other

7. **`os` (radio, required)** — "What OS does your team use?" / hint "Affects how we set up local integrations and onboarding." — Mac · Windows · Linux / Server · Mix

8. **`crm` (radio, required)** — "Do you have a CRM?" / hint "We'll connect your AI coworker here first." — HubSpot · Salesforce · Pipedrive · Other CRM · No CRM yet

9. **`email_provider` (radio, required)** — "Email system?" / hint "Your primary business email — this is often the first integration." — Google Workspace / Gmail · Outlook / Microsoft 365 · Both · Other

10. **`existing_ai` (radio, required)** — "Are you using AI today?" / hint "We'll build on what's already working — not replace it." — ChatGPT / OpenAI · Claude / Anthropic · Google Gemini · Microsoft Copilot · Make AI / Zapier AI · Not using AI yet

11. **`contact` (compound, required)** — "Last step — where should we send your map?" / hint "We'll email your custom automation map and have it ready before your call."
    - **Your name** * (text, autocomplete name, placeholder "Jane Smith")
    - **Company** * (text, autocomplete organization, placeholder "Acme Co.")
    - **Work email** * (email, autocomplete email, placeholder "you@company.com")
    - **Anything else?** *(optional)* (textarea, placeholder "e.g. We're a dispensary chain with 3 locations, biggest pain is weekend DM volume…")

**Step UX:** chip-style options (label wraps a hidden input + an SVG check/radio). Radios auto-advance after 200ms. Checkboxes toggle on click. Text input advances on Enter. "← Back" button on every non-first step. The final-step button is "Generate my map →"; intermediate "Continue →" / "Almost done →" on step 10.

#### Loading overlay (`#loading-overlay`, full-screen)

Five animated steps progressing on a 22-second timeline:
- "Analyzing your time sinks"
- "Selecting AI skills for your stack"
- "Building your 30-day Sprint plan"
- "Calculating ROI projections"
- "Finalizing your custom map"

#### Submit

POSTs to `/api/questionnaire` with the payload:
```json
{
  "email":            "<verified email from URL or contact step>",
  "booking_id":       "<URL param if present>",
  "name":             "<contact.name>",
  "company":          "<contact.company>",
  "industry":         "<answers.industry>",
  "team_size":        "<answers.team_size>",
  "revenue":          "<answers.revenue>",
  "customer_channel": "<answers.channels.join(', ')>",
  "tools":            "<answers.platforms array>",
  "device_os":        "<answers.os>",
  "crm":              "<answers.crm>",
  "email_provider":   "<answers.email_provider>",
  "ai_tools":         "<answers.existing_ai as array>",
  "pain_points":      "<answers.time_sinks array>",
  "bottleneck":       "<contact.notes>"
}
```

#### Success state (replaces the steps container)

- ✅
- H2: "You're all set!"
- Body: "Your automation roadmap is being built. We'll have it ready before your call — check your inbox."
- Sub: "See you soon! 👋"

#### Page-specific footer
Single-line minimal footer: `30dayramp.com · Privacy · "Your answers are used only to build your map."`

---

## Forms (cross-page summary)

### Free Roadmap (`/free-roadmap`)
- **Endpoint:** `POST /api/free-roadmap`
- **Required:** name, email, company.
- **Outcome:** server emails the prospect a generated roadmap (model: claude-sonnet-4-5 per project rules), responds with `{ok:true, book_url?}`.

### Booking (`/book`)
- **Availability:** `GET /api/availability` → `{ days_available, start_hour, end_hour, slot_duration_min, blocked_dates }`.
- **Existing slots:** `GET /api/book?date=YYYY-MM-DD` → `{ booked: [iso, …] }`.
- **Create:** `POST /api/book` body `{ datetime, name, email, company, notes, timezone, tier, billing }` → `{ booking_id, … }` or `409` (conflict) / `429` (rate limit) / generic error.
- Triggers Google Calendar invite via OAuth refresh token + Resend confirmation email.

### Booking-flow inline questionnaire (also `/book`)
- 12 steps (see /book section).
- POST `/api/questionnaire` with the booking_id captured from the prior call.

### Standalone Questionnaire (`/questionnaire`)
- 11 steps, gated by `?email=…`.
- POST `/api/questionnaire` (same endpoint).

### Hero/Final form on homepage (vestigial — handler exists but no live form on current homepage)
- Code wires `handleFormSubmit('hero-form', …)` and `handleFormSubmit('final-form', …)` to POST `/api/contact` with `{name, email, company}`. Marked for future use; no rendered form ships with the current build.

---

## Pricing tiers (canonical numbers — must stay in lockstep across `index.html`, `book.html` `tierLabels`, `comparison.html`, `one-pager.html`, `pricing-onepager.html`)

### Starter
- Monthly: **$2,500/mo** + $2,500 onboarding
- Annual: **$2,083/mo** billed annually · save $5,000 · + $2,500 onboarding
- Best for: 5–30 employees
- Features:
  - Custom AI agent trained to your business
  - Up to 5 workflow automations
  - 3–5 software integrations
  - Monthly check-in call
  - All compute & hosting included

### Growth (Most popular)
- Monthly: **$5,000/mo** + $3,500 onboarding
- Annual: **$4,167/mo** billed annually · save $10,000 · + $3,500 onboarding
- Best for: 30–100 employees
- Features:
  - Custom AI agent — expanded scope
  - Up to 15 workflow automations
  - 10+ software integrations
  - Weekly check-ins + monthly strategy call
  - All compute & hosting included

### Enterprise
- From **$10K/mo**, scoped on call · Custom SLA
- Best for: 100+ employees
- Features:
  - Full AI operations buildout
  - Unlimited workflow automations
  - Custom development & integrations
  - Dedicated support + QBRs
  - White-label option available

**3-year math (used on /comparison):**
- VA mid-range: $3,000/mo × 36 = **$108,000**
- Ramped Starter: $2,500 onboarding + ($2,500/mo × 36) = **$92,500**
- Net Ramped savings: ~$15K · 3× the coverage hours · zero turnover.

**Standard CTA copy:**
- Primary: "Book a discovery call →" (or "Book a free 30-min call →" on long-form CTAs)
- Secondary: "Get your free roadmap" (sends to `/free-roadmap`) or "Get started →" on tier-bound flows.

---

## Customer / case-study content

### Xtractor Depot
- Industry: Industrial equipment supplier (extraction equipment)
- Founder: Andrew Yoon (now also CEO of Ramped AI)
- Size signal: serves cannabis operators through SpaceX, Lucid Motors
- Year founded: 2016
- Headline stats used in copy:
  - **14h saved per week**
  - **8 min** average response time (down from much longer)
  - **30 days** to live deployment
- Quote (homepage proof block):
  > "Honestly, I was skeptical. We'd tried software before and it always ended up as one more thing to manage. By day 30 we had a live agent handling our quote intake — no babysitting required. **I wish we'd done this two years ago.**"
  > — Andrew, Founder, Xtractor Depot
- Logo asset: `/xtractordepot-logo.jpg`

This is currently the only published case study on the live site.

---

## Homepage FAQ (cross-referenced)

1. **How is this different from hiring an AI consultant?** — "We build and run the agents ourselves. You get working software, not a strategy deck."
2. **Do I need technical staff to work with you?** — "No. We handle everything — setup, integration, training, and maintenance. Your team just uses the results."
3. **What kinds of businesses do you work with?** — "Established businesses with real workflows to automate. We work best with companies doing $1M+ in revenue that have repetitive, high-volume processes."
4. **What if it doesn't work in 30 days?** — "You get a full refund. No questions asked."
5. **What does the monthly fee cover?** — "Uptime, maintenance, iteration, and ongoing improvements. As your business grows, we expand the system without a new engagement."
6. **How long does onboarding take?** — "Most clients are live within 30 days. We run a structured onboarding — discovery, build, test, launch — and your first automation is typically running in week two."

(Comparison page adds four more — see Section 05 of /comparison.)

---

## Brand v3 design tokens (the canonical dark theme — `v3-theme.css`)

```css
:root{
  /* Backgrounds, near-black to dark gunmetal */
  --bg-0:#07090d;       /* page */
  --bg-1:#0b0f17;
  --bg-2:#11161f;
  --bg-3:#161c27;
  --bg-4:#1c2331;       /* highest elevation */

  /* Lines / borders */
  --v3-line:#1f2735;
  --v3-line-2:#2a3344;

  /* Text */
  --text-0:#f4f6fa;     /* primary */
  --text-1:#c5cdd9;     /* body */
  --text-2:#8b94a3;     /* muted */
  --text-3:#5a6373;     /* most muted (eyebrows, hints) */

  /* Accent system */
  --blue:#3b82f6;        /* royal blue — emphasis, links, gradient text */
  --blue-2:#60a5fa;
  --blue-glow:rgba(59,130,246,0.35);

  --orange:#fb923c;      /* primary CTA on dark backgrounds */
  --orange-2:#fdba74;
  --orange-glow:rgba(251,146,60,0.3);

  --v3-green:#34d399;    /* success / live indicators */

  /* Radii */
  --radius-sm:8px;
  --radius-md:12px;
  --radius-lg:16px;
  --radius-xl:24px;
}
```

**Usage rules (from CLAUDE.md):**

- Body background = `--bg-0` plus two radial glows: blue (top-center) and orange (top-right).
- Hero H1 second clause is gradient-painted: `linear-gradient(120deg, var(--blue-2) 0%, var(--orange) 90%)` with `-webkit-background-clip:text; color:transparent`. Never paint full sentences — only the differentiating clause.
- Primary CTA on dark = `--orange` (#fb923c). Royal blue `--blue` for emphasis, links, gradient text.
- Guarantee badge re-tuned to a yellow-gold (distinct from orange) to avoid semantic confusion.
- Inter weights loaded everywhere: 400, 500, 600, 700, 800. JetBrains Mono: 400, 500, 600. `font-feature-settings: "ss01","cv11"` is set on body.
- Border radii: `--radius-sm:8px`, `--radius:12px` (alias `--radius-md`), `--radius-lg:16px`, `--radius-xl:24px`.

**Legacy v2 tokens (still inline on cream pages until migrated — see `BRAND-V3-MIGRATION.md`):**

```css
:root{
  --ink:#0B1220;        /* near-black */
  --ink-2:#1A2233;
  --paper:#FAFAF7;      /* cream */
  --surface:#F5F5F3;    /* slightly darker cream */
  --line:#E6E4DC;       /* hairline */
  --muted:#5B6272;
  --accent:#1F4FFF;     /* royal blue accent */
  --accent-2:#0B2A8C;
  --good:#0F7A4B;       /* success green */
  --warn:#B45309;       /* amber */
}
```

---

## Implementation notes

- **Stack:** static HTML + Vercel serverless. **No framework, no build step, no `package.json`.** Tailwind is precompiled into a single-line `/styles.css`; treat as build artifact (do not hand-edit). Per-page styles live inline in each HTML head.
- **Pages:** 18 customer-facing HTML files at the root. Each page declares its own v2 `:root { … }` block; v3 overrides ship via `/v3-theme.css` (loaded after each inline block, so it wins specificity ties).
- **Fonts:** Inter (400–800) + JetBrains Mono (400–600) loaded via Google Fonts. Some pages additionally load Lato (Slack mockup on `/agent-library`).
- **Routes (`api/*.js`, Vercel serverless Node):**
  - `GET /api/availability` — booking calendar config.
  - `GET /api/book?date=…` — booked-slot list. `POST /api/book` — create booking, send confirmation email + Google Calendar invite.
  - `POST /api/questionnaire` — accepts both the inline (`/book`) and standalone (`/questionnaire`) payloads. Uses Anthropic Claude (`claude-sonnet-4-5`) to generate the roadmap, sends emails via Resend, mutates the booking row in Supabase.
  - `POST /api/free-roadmap` — generates and emails the roadmap; returns optional `book_url`.
  - `POST /api/contact` — wired but no live form references it on the current homepage build.
  - `GET /api/resources` — feeds the daily-AI-updates grid.
  - `GET/POST /api/get-map`, `GET /api/get-roadmap` — public-by-UUID read endpoints (audit-flagged for future signed-token migration).
  - `/api/reminders` — cron, every 30 min (`vercel.json`).
- **Database:** Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`). The `bookings` table has a `UNIQUE(datetime)` constraint — must be preserved.
- **Email:** Resend (`RESEND_API_KEY`).
- **Calendar:** Google OAuth → Calendar API (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`). Host timezone is `America/Chicago`.
- **LLM:** Anthropic Claude — model `claude-sonnet-4-5` (`ANTHROPIC_API_KEY`). Used by `/api/questionnaire` and `/api/free-roadmap`.
- **Admin auth:** bearer token `ADMIN_TOKEN`, constant-time compared via `api/_lib/admin-auth.js`. (One file — `api/send-followup.js` — still reads `ADMIN_PASSWORD`; pending fix.)
- **Analytics:** Vercel Insights via `<script defer src="/_vercel/insights/script.js">` on every customer-facing page (excluded from `/admin`, `/dashboard`).
- **JSON-LD:** `WebSite` + `Organization` + `FAQPage` on `/`; `AboutPage` (with two `Person` entries) on `/about`; `Service` on `/book`; `FAQPage` on `/comparison`.
- **Security headers (vercel.json):** HSTS preload, CSP allowing `'self' 'unsafe-inline'` plus Vercel scripts, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, strict referrer, locked-down `Permissions-Policy`.
- **Accessibility / motion:**
  - Skip-to-main link on every page.
  - Mobile drawer with `aria-expanded`, `aria-controls`, Escape-to-close.
  - `prefers-reduced-motion: reduce` disables the ticker, the count-up animation, the timeline-card stagger, the agent-library Slack animations, and shortens the homepage Slack-demo durations 4×.

### Interactive demo (homepage)

The Slack-style demo on `/` is a vanilla JavaScript state machine — **not React**. Preserve as-is.

- Mount target: `#demo-stream` (chat) inside `#demo-shell` (workspace).
- Workflows defined in a `WORKFLOWS` object (4 entries: `lead`, `inventory`, `finance`, `sales`) — see homepage section above for full content.
- Integration metadata in an `INTEGRATION_META` lookup.
- Bot avatar SVG inlined as `BOT_SVG` (the swoop with a `rampedSwoopMsg` linearGradient id).
- `running` flag prevents overlap; `SPEED` is 4× when `prefers-reduced-motion: reduce` is on.
- Each step animates: spinner → step label → process card with integration pills lighting up → success card with metrics → aha + detail blocks.
- `el(tag, props, children)` is a tiny vanilla DOM helper used in lieu of JSX.

### Pages-list reminder

The 11 pages this spec covers: `/` (index.html), `/about`, `/book`, `/comparison`, `/agent-library`, `/free-roadmap`, `/resources`, `/thanks`, `/privacy`, `/404`, `/questionnaire`. Other pages on the site (e.g. `/demo`, `/one-pager`, `/pricing-onepager`, `/admin`, `/dashboard`) are out of scope here.

### Known content-on-disk truncation

Two files appear to be cut off mid-content on disk and need reconstruction during rebuild:
- `/thanks` — fineprint paragraph cuts off after "Questions in the meantim". Reconstruct as: "Questions in the meantime? Email **jon@30dayramp.com**." plus closing `</main>` and a standard footer.
- `/404` — sub paragraph cuts off after "But your A". Reconstruct as something like: "But your AI department could." (or similar one-line nudge), followed by the primary "Take me home →" button to `/` and a closing layout.
