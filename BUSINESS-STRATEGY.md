# Ramped AI — Business Strategy & Competitive Analysis (v2)

**Audited at:** 2026-04-29 · post-deploy of Phase 1 + 2 + 3 audit work.
**Author:** Senior Product/Business engagement.
**Scope:** current model deconstruction · 10-competitor matrix · SWOT · pricing review · positioning gaps · concrete recommendations across 1-week / 30-day / quarter horizons.

---

## 1. Executive summary (read this first)

Ramped sits in **a defensible-but-narrowing wedge**: done-for-you AI implementation, time-bound (30 days), money-back-guaranteed, on a flat monthly retainer. The combination of those four traits is unusual.

The good:

- **The promise is the product.** "Live in 30 days, full refund if not" is a tighter commitment than any of the 10 competitors I mapped. Most agencies say "6 weeks to first system" or "ask us." Most platforms say "self-serve, ship today." Nobody else offers the *explicit time-bound delivery + money back* that Ramped does. Keep this. Defend it.
- **Pricing is in the right band.** $2,500–5,000/mo + onboarding sits squarely in the SMB managed-services range ($2K–$20K, avg ~$3,200/mo) — premium enough to fund white-glove delivery, low enough to clear a 30-min discovery call.
- **The funnel is sharp.** Hero → problem → how it works → proof → pricing → CTA, with visible pricing, a single CTA, a refund guarantee, and (post-Phase 2) a live agent overlay. Most competitors hide pricing or load you onto a self-serve free tier first.

The hard:

- **Two structural threats are accelerating.** (1) DIY tools (Lindy, Gumloop, Zapier AI) are 1/20th the price and rapidly shedding the "you need a developer" stigma. (2) The substrate itself is becoming a product — Claude Cowork, ChatGPT Agent, OpenAI Codex Background Computer Use all launched 2025–2026 and target the same buyer with a free-or-cheap subscription. Both pressure Ramped toward "you're paying for the *outcome*, not the *automation*" — which is correct, and the messaging needs to lean harder into that.
- **Social proof is single-anchored.** One customer case (Xtractor Depot) is now repeated across hero stats, ticker, about page, and email. At $2,500–5,000/mo, sharp prospects will discount "average 14 hrs/wk saved" if it's *literally* an n=1 number. Phase 2 v1 audit flagged this; it's still open.
- **AI apps churn 30% faster than non-AI apps.** Industry data is clear: the average AI tool retains 21% annual vs 31% for non-AI. Ramped's done-for-you model fights that — but only if month-12 outcomes are as visible to the customer as month-1. The portal is the right surface; the metrics inside it need to match.
- **No vertical specialization shown publicly.** "Healthcare · Legal · Real Estate · Dental · Field Services · Logistics · Cannabis · Finance" reads as 8 industries with one shipped customer (industrial supply). Vertical case studies — even one per quarter — would be the highest-ROI marketing investment.

The opportunity, in one sentence:

> **"Your AI department, live in 30 days, on a flat monthly retainer — built and run by humans, so you don't manage it."**
> Lean into the *human-managed* angle. That's the actual moat against Claude Cowork / ChatGPT Agent / Lindy. Anyone can run an AI; very few prospects want to *operate* one.

---

## 2. Current model — what Ramped sells today

| Layer | What it is | Where it's defined |
|---|---|---|
| **Promise** | "Your AI department, live in 30 days." Money-back if not live by day 30. | hero, comparison page, FAQ |
| **Tiers** | Starter $2,500/mo + $2,500 onboarding · Growth $5,000/mo + $3,500 onboarding · Enterprise (custom, manual invoicing) | `api/_lib/stripe.js`, `/book`, `/comparison` |
| **Annual** | 12 months prepaid, $2,083/mo (Starter) or $4,167/mo (Growth) — saves $5K/$10K | `index.html`, `book.html` |
| **Discovery call** | 30 minutes. Generates a personalized roadmap via Claude before the call. | `/book` → `/questionnaire` → roadmap email |
| **Build** | 30-day delivery: Kickoff → Discovery → Build → QA → Live. Tracked in customer portal. | `portal.html`, `api/_lib/phase.js` |
| **Run** | Ongoing: agents stay live in customer's tools (Slack, email, CRM). Drafts approved via portal. Weekly digest. Support tickets. | `api/portal-*`, `api/weekly-digest.js` |
| **Channels** | Inbound from `30dayramp.com` direct + (intended) referrals. No paid acquisition visible. | site, sitemap |
| **Sales motion** | Founder-led discovery call → AI-graded prospect (A/B/C/D) → manual close. Stripe invoice on close. | `api/admin-create-invoice.js` |

### Unit economics (back-of-envelope)

Numbers are illustrative — the real CAC/LTV depends on conversion data we don't have visibility into yet.

| Lever | Reasonable assumption | Notes |
|---|---|---|
| **ACV (Starter, monthly)** | ~$32,500/yr ($2,500 × 12 + $2,500 onboarding) | rough — assumes 12-mo retention |
| **ACV (Starter, annual)** | $27,500 ($2,083 × 12 + $2,500 onboarding) — paid upfront | better cash, lower revenue/mo |
| **ACV (Growth, annual)** | $53,500 | the volume play |
| **Gross margin** | 50–70% if delivery is templated; 25–40% if every customer is bespoke | the leverage question is "how much is reusable across customers?" |
| **Time-to-cash (annual)** | ~14 days from booking call to invoice paid | strong cash-flow profile |
| **Time-to-deliver** | 30 days (the guarantee) | hard ceiling — drives operational cadence |
| **Churn** | unknown; AI app industry avg ~6%/mo monthly, ~21% annual retention | done-for-you should beat this materially |
| **Refund risk** | Unknown — but the 30-day guarantee is the central trust signal; one public refund case strengthens it; 5+ would erode it | track refund rate as a key board metric |

### Where the leverage is

In rough order:

1. **Templated agent libraries.** Each new customer's roadmap reuses an agent type (Inbound Quote Drafter, Lead Qualifier, etc.). The 4th deployment of "Inbound Quote Drafter" should take 1/4 the time of the 1st. *Track templates per agent type and measure build-time decay.*
2. **The questionnaire.** Already runs a Claude pass that grades + generates a roadmap before the call. If the roadmap is 80% right out of the gate, the discovery call collapses from "discover" to "validate." This is a major hidden lever — fast-track A-grade leads to a 15-min call.
3. **Vertical playbooks.** Once 2–3 customers in the same vertical (e.g. dental, industrial supply) ship, every subsequent prospect in that vertical is a 50% faster build. *Pick 2 verticals to win first.*
4. **Self-serve tier (NEW).** Adding a $497–997/mo "starter agent" tier (one agent, no onboarding, customer self-installs from a recipe) opens a price point Lindy/Gumloop don't reach (because they're tools) and Ramped doesn't reach (because of the $2,500 floor). Long-term option, not a Q2 priority.

---

## 3. The 10-competitor matrix

Eight direct + two adjacent. Pulled from 2026 sources (cited at end). All pricing shown is **public list, not negotiated**.

| Competitor | Model | Floor price | Ceiling | Guarantee / risk-reversal | Target customer | Tech depth | Vertical focus | Direct competitive vector |
|---|---|---|---|---|---|---|---|---|
| **Ramped AI** | Done-for-you · managed retainer | **$2,500/mo + $2,500 onb** | $5,000/mo (Growth) + custom Enterprise | **30-day live or full refund** ✓ unique | $1M+ rev SMBs, ops-heavy | Mid (custom build per customer) | Multi-industry, no public vertical lock | — |
| **Lindy.ai** | Self-serve · platform · subscription | $0 (free, 400 credits) | $200/mo (Max) + Enterprise | None — credits expire monthly | Solopreneur / small team | Low (drag-drop in chat) | Horizontal | DIY substitute · 1/12 the price · steep learning curve to match Ramped's outcomes |
| **Gumloop** | Self-serve · platform · subscription | $0 (free, 5K credits) | $37/mo Pro · Team & Enterprise custom | None | Marketers, growth ops | Low–mid (visual workflow builder) | Horizontal | DIY substitute · prosumer · "build it yourself" pitch |
| **Zapier AI Agents** | Self-serve add-on on Zapier | $33.33/mo (Agents Pro) on top of $19.99–$799/mo Zapier base | Enterprise custom $500+/user | None | Existing Zapier users | Low (UI-driven) | Horizontal | DIY substitute for prospects already on Zapier |
| **Viktor** (getviktor.com) | Self-serve · Slack-native · subscription | $0 (Starter, $100 one-time credits) | $50–$999/mo Team · Enterprise custom | None | Solopreneur / small team in Slack | Mid (autonomous code execution) | Horizontal | "AI coworker" framing — closest *positioning* competitor; pricing is far lower |
| **WhiteHorse AI** | Done-for-you · sales agents · perf-priced | **$0 + per-appointment-booked fee** | Custom audit + retainer | **"Only pay when it works"** ✓ aggressive risk reversal | B2B sales-heavy, Australia-anchored | Mid–high | Sales/lead-gen vertical | Direct positioning rival · stronger risk reversal · narrower scope (sales only) |
| **GoHighLevel AI Employee** | Agency-resold · platform + bolt-on | $97/mo platform + $97/mo AI Employee | Agencies stack at $200–600/mo to end customer | None | Agencies serving local SMBs (dental, salon, contractor) | Low (templated "Voice AI / Conversation AI") | Local-services vertical-heavy via agencies | Indirect — same end customer (dental, field services) but reached through HighLevel agencies |
| **Adept AI Labs** | (defunct — Amazon-acquired June 2024) | — | — | — | — | — | — | Used to be the high-end ACT-1 enterprise pitch; talent now at Amazon |
| **SmythOS** | Self-serve · platform · also on-prem | $30/mo | Enterprise custom (HIPAA / on-prem / VPC) | None | Developer / engineer | High (API-first, on-prem capable) | Horizontal · regulated industries | Adjacent — dev-focused; not the same buyer Ramped targets |
| **Automation Agency** | Done-for-you · low-end retainer | $249/mo | ~$2,000/mo+ | **30-day guarantee** | Marketing-task SMBs | Low (mostly templated VA-style work) | Marketing | Indirect — much lower price band, much narrower scope |
| **AI SMB Solutions** | Done-for-you · consulting | undisclosed (range $5K–25K project + retainer) | enterprise custom | "10-20 hours/employee saved within 30 days" claim | Mid-market SMB | Mid (consulting) | Multi-industry consulting | Same promise, less productized; usually slower delivery |
| *(Adjacent — substrate)* **Claude Cowork** | Self-serve · subscription | included with Claude Pro/Team | Enterprise plan | — | Knowledge workers | High (general-purpose agent) | Horizontal | Substrate threat — does *what Ramped builds* but unsupervised |
| *(Adjacent — substrate)* **ChatGPT Agent / Codex** | Self-serve · subscription | $20/mo (Plus) | $200/mo (Pro) + Enterprise | — | Knowledge workers | High | Horizontal | Same substrate threat |

### How to read this matrix

- **Risk reversal:** Ramped and WhiteHorse are the only two with serious commitment devices. Ramped's is time-bound (30 days). WhiteHorse's is outcome-bound (per appointment). Both close the "what if it doesn't work?" objection differently — Ramped's is broader; WhiteHorse's is more aggressive but only works for sales agents. **This is the most defensible piece of Ramped's positioning.**
- **Done-for-you vs self-serve:** Ramped is one of only three done-for-you players in the matrix (Ramped, WhiteHorse, Automation Agency, AI SMB Solutions). Of those, Ramped has the cleanest mid-market positioning. Automation Agency is too cheap and too narrow; WhiteHorse is sales-only; AI SMB Solutions is consulting (high-touch, slow).
- **Pricing band:** Ramped's $2,500–5,000/mo sits *above* every self-serve tool ($30–200/mo) and *below* the typical custom-AI-engagement ($30K–100K upfront). The only direct overlap is GoHighLevel's stacked-AI bundles at ~$200–600/mo via agencies — different distribution, similar end customer.

---

## 4. SWOT

### Strengths

1. **Time-bound + money-back guarantee.** Closest analogue is Stripe's "0% lost in checkout flow" guarantee — concrete, falsifiable, used in marketing. The 30-day window is short enough to be motivating, long enough to be credible.
2. **Visible, transparent pricing on a marketing site.** Lindy/Gumloop are also transparent, but they're tools. Among done-for-you peers (Viktor, WhiteHorse, AI SMB Solutions), Ramped is *the only one* with public monthly tier pricing. This is a low-friction conversion advantage.
3. **Sharp product surface.** The customer portal (Phase 1+2 hardened) is unusually polished for a 1-customer startup. Phase indicator, draft approvals, weekly digest — these are retention-engineering features that take Lindy/Gumloop years to build.
4. **Operator-narrative founder.** Andrew Yoon's Xtractor Depot story (10-yr operator, supplied SpaceX/Lucid Motors *if verifiable*) is a far stronger founder-credibility narrative than "ex-engineer at FAANG" and matches the buyer (CEO/operator).
5. **Strong audit + delivery muscle.** The repo has v1+v2 audits, Playwright suite, RLS-hardened DB, signed-token auth flows. This is operational discipline most $5K/mo agencies do not have. It compounds.

### Weaknesses

1. **Single-customer social proof.** The case-study pillar is one quote with three "Verified" chips and no third-party link. At a $30K+ ACV, a sharp CFO will ask for references.
2. **Vertical claims aren't backed.** Eight industries listed; one shipped (industrial supply). Risky if a prospect's industry is on the list.
3. **No live demo.** Phase 2 V2-B6 added a CSS overlay on the static screenshot; that's a step. A real 30-second product video or sandbox demo (à la Lindy's "try it now" hero) would 2–3× hero conversion.
4. **"AI department" is unowned naming.** It's a great phrase but it's becoming generic — Lindy uses "AI assistants," Viktor uses "AI coworkers," HighLevel uses "AI Employees." If Ramped doesn't wrap it in something proprietary (e.g. "The Ramp Stack" or "Department-as-a-Service") within 2 quarters, it'll be hard to defend.
5. **Refund-rate is a binary risk.** One public refund (single tweet) erodes the entire central commitment. Operationally, refund-rate is the #1 metric to monitor — the tail risk dwarfs everything else in margin terms.
6. **Customer portal is read-mostly.** Customers can approve drafts and pause agents, but the *configuration* of agents is admin-side only. Two implications: (a) makes Ramped indispensable for any tweak (good for retention, bad for scale), (b) feels less self-driven than Lindy/Gumloop (bad for SaaS-style multiples).

### Opportunities

1. **Vertical specialization (within 2 quarters).** Pick 2 verticals where the existing customer + Andrew's network is strongest — e.g. industrial supply (Xtractor) + one of: dental, field services, professional services. Land 2–3 customers per vertical, then publish a vertical-specific landing page + 2-page case study PDF + per-vertical pricing-onepager. ROI: each vertical-locked landing page should triple conversion vs. the generic /book.
2. **Productized add-ons.** "Live agent demo embed" for the homepage, a "starter agent recipe library" (free) to lower the consideration cost, and an "AI Health Check" $497 audit (lead-gen + qualifies). These bridge the $0–$2,500 price gap that competitors fill.
3. **Second-customer flywheel.** Use the next 3 customer wins for *named* testimonials, *photographed* logos on the customer strip, and *at least one* video testimonial. Aim for 3 by end of Q2. Replace the placeholder logos (Cascade Dental, Meridian Field, Vantage Property — currently SVG initials in the customer strip) with real ones as they ship.
4. **"Ramp Index" / industry benchmark report.** Publish a free quarterly report: "How much time are operating businesses recovering from AI in [industry]?" Pull anonymized aggregate from your own customer base (once you have ≥10 customers). Becomes the inbound SEO + earned-media engine. Kjellberg-tier brand move.
5. **White-label channel.** Once you have 5+ customers and a templated playbook, license the playbook to a regional MSP or accounting firm for a per-deployment fee. They sell to their book; Ramped runs the agents. Low CAC, high margin.
6. **Quarterly "Refund Watchdog" public number.** *If your refund rate stays low (<5%),* publish it. "30 customers shipped, 0 refunds" is a marketing weapon Lindy can never match. Wait until the number is impressive — but plan for the day you can publish it.

### Threats

1. **Substrate commoditization.** Claude Cowork, ChatGPT Agent, OpenAI Codex Background Computer Use launched 2025–2026. Each charges $20–200/mo for what is roughly Ramped's substrate. The strategic answer: *they sell software; you sell outcomes + accountability*. Re-emphasize "we run it for you" in copy and case studies.
2. **DIY tools narrowing the gap.** Lindy and Gumloop are getting visibly better month-over-month. The buyer who 12 months ago needed Ramped to build "Inbound Quote Drafter" can now spend 4 hours in Lindy and probably get 60% there. The widening question is "does the buyer want to spend those 4 hours?" — answer is no for $1M+ rev companies, yes for solopreneurs.
3. **AI-app retention crisis.** Industry-wide, AI products retain 30% worse than non-AI products year-1. Why: utility decays, novelty fades, model regression. Ramped's done-for-you model is the best structural defense — but it requires a *visible* outcome metric (hours saved this week, replies sent, leads qualified) to keep customers feeling the value. Build a quarterly business review (QBR) into the Growth tier as a formal touchpoint.
4. **Regulation drift.** The EU AI Act (effective Aug 2026 in full) and US sectoral rules (HIPAA, FINRA) are moving fast. A customer in healthcare or legal will increasingly ask: *"do you sign a BAA?" "are you SOC 2?"* — Ramped doesn't currently. WhiteHorse and SmythOS already advertise SOC 2 / HIPAA. Time to start the SOC 2 Type 1 process by Q3.
5. **Founder dependency.** All discovery calls go to Jon. All admin actions are gated on a single bearer token. All sales emails come from `jon@30dayramp.com`. This is correct for n=1 → n=5; it's a cliff at n=10. Hire #1 should be a senior implementation manager who can run the build phase end-to-end.
6. **Single payment processor.** Stripe outage = 100% revenue collection halted. Low likelihood, but a $50K ACV business should have a fallback (manual ACH for annual customers, even if Stripe is the default).

---

## 5. Pricing review

### What works

- **Three tiers + annual toggle** maps to mid-market buying behavior. Starter is the on-ramp; Growth is the deal-size optimization; Enterprise is the manual close.
- **Annual savings of $5K/$10K** is a clean lever. Annual buyers self-select for commitment (good signal).
- **Onboarding fee separates "I'm in" from "I'm browsing."** $2,500–3,500 onboarding is a meaningful filter — won't capture every prospect, but the ones it does capture are real.

### What I'd test

| Test | Hypothesis | Effort |
|---|---|---|
| **Add a "Try It" tier at $497/mo** | One agent, no onboarding, deployed in 14 days. Catches buyers who can't justify $2,500. Upsell path to Starter at month 3. | High — needs a self-serve onboarding flow to maintain margin |
| **Move Starter to $1,997/mo monthly (or keep $2,083 annual same)** | $1,997 reads materially below the psychological $2K barrier. Marginal revenue loss; meaningful conversion lift. | Low — single number change across 5 files (per CLAUDE.md) |
| **Bundle the $2,500 onboarding *into* the first month for annual buyers** | Annual buyers already commit — don't make them feel double-charged. "$25,000/yr, includes setup" is cleaner than "$25K + $2.5K onboarding." | Low — copy + Stripe invoice config |
| **Add a quarterly tier between Starter and Growth: "Pro" at $3,500/mo** | The $2.5K → $5K jump is steep. A middle tier captures buyers who outgrow Starter but don't need Growth's volume. | Medium — defines new agent quota, may dilute Growth signal |
| **Add an explicit Enterprise floor: "from $10K/mo"** | Currently "custom" reads as "we'll figure it out." Posting a floor primes anchoring + signals seriousness. | Low — copy on `/comparison` and `/book` |
| **Refund-rate counter:** "30 customers · 0 refunds since 2026" *(once true)* | Public commitment-device evidence. Publish when ratio is impressive. | Low; gated on data |

### What I would not change

- The $5K/mo Growth ceiling. Going higher slips into Enterprise; lower dilutes the SKU.
- The 30-day guarantee. Don't extend it to 60 — you'd lose half the urgency. Don't shorten it to 21 — operational risk.
- The flat-monthly framing. Per-seat or per-agent pricing fights the "you don't manage it" message and turns every renewal into a counting exercise.

---

## 6. Positioning gaps (what's missing on the site today)

Cross-referencing the site against the 10-competitor matrix:

| Gap | Ramped today | What competitors do | Recommendation |
|---|---|---|---|
| **Objection handling: "Why not Gumloop / Zapier?"** | Comparison page covers VA-vs-AI but not Ramped-vs-DIY-tools | Lindy has explicit "vs Zapier" pages; Viktor has "vs Devin/Manus" | Add `/comparison` Tab 2: "Why not just use [Lindy/Zapier/Gumloop]?" with one-line answers and the 3 reasons most prospects pay 30× more for done-for-you |
| **Compliance / security signals** | None visible | WhiteHorse cites SOC 2; SmythOS cites HIPAA + on-prem | Add "Security & compliance" section to footer with: SOC 2 (in progress), data handling, sub-processors. Even "we'll have SOC 2 Type 1 by [Q3]" is more than nothing. |
| **Vertical proof** | 8 industries listed; 1 shipped | GoHighLevel is vertical-explicit (dental, salon, contractor); WhiteHorse is sales-vertical | Pick 2 verticals; build 1-page landing per vertical with industry-specific examples. Drop the rest of the industry pill list until proof exists. |
| **Refund commitment as a number** | Stated as policy | Nobody else has this | Once data supports it: prominent "Refunded 0 of N customers since [date]" stat in hero |
| **Self-serve consideration cost** | $2,500/mo floor; no free trial; no demo sandbox | Lindy/Gumloop/Viktor all have free tiers | Add "$0 — see what we'd build for you" — generates the personalized roadmap as a marketing asset; gates the build behind paid tier |
| **Founder credibility above-fold** | "Built by Andrew Yoon — 10-year operator" — present ✓ | Viktor: "engineers from Meta AI / Oxford / Google / Tesla / Amazon" | Verify and add proof line: "Customers shipped to: SpaceX, Lucid Motors *(at Xtractor Depot)*, +N others" — only if verifiable |
| **Quarterly Business Review** | Not advertised | Most premium B2B SaaS includes QBR in higher tier | Make QBR a Growth-tier benefit. Frames the renewal conversation around outcomes, not invoices |

---

## 7. Recommendations — sequenced

### This week (low risk, high signal)

1. **Add a "vs DIY tools" section to `/comparison`.** Three rows: Build, Run, Tradeoff. Position Ramped as "you don't manage it" against Lindy/Gumloop/Zapier. ~3 hrs.
2. **Drop the industry pill list down to 2–3 verticals you can actually back.** "Industrial supply · Field services · Professional services" with case-study references where they exist. ~30 min.
3. **Move "30-day guarantee" higher in the hero.** Currently a small chip; make it a co-equal element with the headline. Pure copy/CSS. ~30 min.
4. **Add an Enterprise price floor** ("from $10K/mo · scoped on call") on `/comparison` and `/book`. ~10 min.
5. **Verify the SpaceX/Lucid claim once and for all.** Get a screenshot, a LinkedIn endorsement, or move the language to "supplied to Tier-1 EV/aerospace customers" without naming. ~1 hr (Andrew's call).

### Next 30 days

1. **Land 2 named testimonials (target: by 2026-05-29).** Source from existing customer pipeline. Photograph or video where possible. Replace placeholder customer-strip logos as new ones ship. Owner: Jon.
2. **Build one vertical landing page** (e.g. `/industrial-supply` or `/field-services`). Industry-specific copy, industry-specific roadmap example, industry-specific testimonial. Test: paid traffic A/B vs `/book`. ~12 hrs.
3. **Add a "real demo" surface.** Either: (a) record a 60-second loom of `/demo` interaction → embed on hero; or (b) commission a Loom-style screencast voiced by Jon. ~6 hrs.
4. **Productize the questionnaire as a lead magnet.** Today the questionnaire is gated behind booking. Allow a *standalone* version that emails the prospect their roadmap without booking — the booking CTA is on the roadmap page. Conversion: roadmap-viewers → booking ≈ 25–40% range, vs cold direct ≈ 2–5%. ~16 hrs.
5. **Start SOC 2 Type 1.** Tugboat / Vanta / Drata. Type 1 is ~$15–25K and 8–12 weeks. Type 2 follows in another 6 months. Without it, healthcare and legal verticals are off-limits.

### Next quarter (the strategic moves)

1. **Hire #1: Senior Implementation Manager.** Owns the build phase end-to-end. Removes Jon as the bottleneck. Salary band: $130–180K + equity. The single biggest leverage move available — without it, Ramped is capped at ~10 active customers.
2. **Build 2 vertical playbooks.** A documented + templated workflow for the top 2 verticals. Time-to-build per customer in those verticals should drop 50%+ between customer 2 and customer 5.
3. **Launch the "Ramp Index"** — quarterly anonymized benchmark report. Inbound SEO play + earned media. Aim: customer #10 onboarded with attribution to the Index.
4. **Refund-rate dashboard.** Internal at first, public once the number stays sub-5% for 6+ months. Make it a board metric.
5. **Add the $497 "AI Health Check" SKU.** A 1-hour call + 5-page roadmap delivered in 3 business days, $497, no commitment. Lead-gen + qualification. Convert ~20–30% to Starter.

### Defer (12+ months)

1. **Self-serve "$497 starter agent" tier.** Tempting but premature — would dilute the done-for-you positioning before vertical playbooks are solidified.
2. **White-label channel.** Powerful at scale; complicates support and quality. Wait for n=10 customers + a senior implementation manager.
3. **Multi-region presence.** Outside US Central. Wait until $5M ARR + first international referral inbound.

---

## 8. Metrics to track from day 1

These should land on a one-page weekly dashboard. The portal already collects most; admin needs the rollup view.

| Metric | Why it matters | Source |
|---|---|---|
| **Live customer count** | Monthly progression; vanity but motivating | `bookings` where `payment_status = subscription_active` |
| **30-day-on-time delivery rate** | The brand-defining commitment | `bookings.go_live_at` ≤ `bookings.datetime + 30 days` |
| **Refund rate** | Tail-risk metric; brand safety | Stripe events / `bookings.refunded_at` (new column) |
| **Avg time-to-first-agent-live** | Build velocity; trends should improve as playbooks land | `agent.created_at` + first `agent_runs` |
| **Hours saved / customer / week** | Customer-success metric; the renewal narrative | Aggregated from `agent_runs.hours_saved` |
| **Discovery-call → booking conversion** | Top-funnel health | (Stripe-paid bookings) / (booked discovery calls) |
| **Booking → questionnaire-completed** | Mid-funnel; if low, the questionnaire is friction | `bookings` with non-null `questionnaire` column |
| **Roadmap-emailed → booking-paid** | Late funnel; conversion-killer if low | tracked via `automation_map` field + Stripe events |
| **Net Revenue Retention (NRR)** | Upgrade $ vs churn $; the SaaS-grade health metric | Stripe subscriptions + invoice history |
| **Refund $/total revenue** | Different from refund count — a single Growth-annual refund is 10× a Starter monthly | Stripe |

---

## 9. Risks I'd watch (in priority order)

1. **Refund-rate cliff.** One refund early matters more than ten in steady state. Aggressive scoping on the discovery call beats forcing a marginal customer through onboarding.
2. **Substrate commoditization.** Anthropic Cowork + OpenAI Agent are coming for the *substrate*. Competing on substrate is a losing fight; competing on outcome + accountability is winnable.
3. **Founder bandwidth.** Jon doing every discovery call caps the business at ~6–8 calls/week → ~2 closes/week → ~8 customers/month at best. Unblock with hire #1 by end of Q2.
4. **Reputation on first failed delivery.** SMB referral networks are tight; one missed 30-day promise lands in a Slack thread. Ship a "war room" framework internally for any deal at risk by day 21.
5. **Pricing-toggle copy drift.** Already noted in v1 audit (3 places shown different prices). Re-occurs every time a price is touched. The `check-fonts.sh` / `check-tokens.sh` scripts could be extended to lint pricing consistency too.

---

## 10. The one-line strategic frame

> **Ramped sells the only thing AI tools can't: the certainty that someone else owns the outcome.**

Build everything else around that.

---

*Sources at end of doc — see Phase 4 of the engagement notes.*
