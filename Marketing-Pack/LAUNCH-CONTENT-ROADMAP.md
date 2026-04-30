# Launch Content Roadmap — Ramped AI

Comprehensive production plan for everything we should have ready for the public launch + first 60 days. Tailored to Ramped's specific business model (premium B2B service, $2.5K-$5K/mo, operators/CEOs, multi-vertical).

Every item is tagged with:
- **Tool** — what we'll use to make it
- **Tier** — A (must-have for launch), B (within 30 days), C (polish over time)
- **Status** — ✅ done, 🔄 in progress, ⏳ planned, ❌ blocked

---

## TIER A — Must-have for launch (next 14 days)

### 🎬 Slack demo videos (the centerpiece)

The Ramped Bot in Slack with the bar-chart logo as PFP, handling real workflows. These are the highest-converting content for our buyer (operators recognize the pain immediately).

| # | Scenario | Persona | URL | Status |
|---|---|---|---|---|
| 1 | Ops question — "where's Acme's shipment?" | Ops manager | `/demos/ops` | 🔄 building |
| 2 | Sales lead intake — hot lead from website | Sales lead | `/demos/sales` | 🔄 building |
| 3 | Finance pull — October close before board call | CEO/CFO | `/demos/finance` | 🔄 building |
| 4 | Customer support — ticket triage with proactive heads-up | Support lead | `/demos/support` | 🔄 building |
| 5 | Quote intake — RFQ → personalized response in 14s | Sales/ops | `/demos/quote-intake` | ⏳ planned |
| 6 | Inventory alert — low-stock before reorder threshold | Procurement | `/demos/inventory` | ⏳ planned |
| 7 | Meeting prep — customer history before a call | CEO/AE | `/demos/meeting-prep` | ⏳ planned |
| 8 | Follow-up — drip emails for stalled deals | Sales | `/demos/follow-up` | ⏳ planned |

**Tool:** HTML/CSS animations (same pattern as homepage hero, scaled up). Each demo gets its own URL so it can be linked in sales emails, embedded in LinkedIn posts, screen-recorded as MP4 for ads.

**Distribution:**
- Each demo URL = 1 LinkedIn post ("here's what Ramped Bot looks like for {{vertical}}")
- Screen-record each as MP4 for paid LinkedIn ads
- Embed in `/comparison` page next to "vs DIY tools" copy
- Embed in vertical-specific landing pages once we make them

---

### 📋 First customer case studies

Same structure as the (deleted) Xtractor draft, but for real customers. The case study template is already in `/Marketing-Pack/CASE-STUDY-TEMPLATE.md`.

| # | Customer | Vertical | Status |
|---|---|---|---|
| 1 | Xtractor Depot | Lab equipment / logistics | ⏳ needs your numbers |
| 2 | Cascade Dental Group | Dental / multi-location healthcare | ⏳ needs permission |
| 3 | Meridian Field Services | Field services | ⏳ needs permission |
| 4 | Vantage Property Group | Property mgmt | ⏳ needs permission |

**Tool:** HTML pages at `/customers/{slug}` + screen recordings of customer's actual Ramped Bot in Slack.

**Distribution:**
- Each customer logo on homepage links to their case study
- Each case study = 1 LinkedIn post + 1 founder X thread
- Send the relevant case study with every cold email (vertical-matched)

---

### 🎨 Brand identity assets

| # | Asset | Spec | Tool | Status |
|---|---|---|---|---|
| 1 | Bar-chart logo | SVG, opacity gradient | inline SVG (already brand-approved) | ✅ done |
| 2 | Logo lockup variations sheet | Horizontal, stacked, mono, on-dark, on-light | HTML in `MARKETING-VISUALS.html` | ✅ done |
| 3 | Brand mascot character — "Ramped Bot" | Stylized robot/agent, reusable across all video | Higgsfield (Nano Banana Pro or Flux 2) | ⏳ planned |
| 4 | Founder headshot — Andrew Yoon | Pro photographer, multi-pose | external | ⏳ blocked on shoot |
| 5 | Sound logo / brand audio sting | 1-2s signature sound for video intros | Suno or commission | ⏳ planned |
| 6 | Animated logo intro | 2-3s, particles assembling into bar chart | Higgsfield Seedance | ⏳ planned |

---

### 📱 Static social ad creatives (10+ variants)

Already built first 6 in Claude Design + `MARKETING-VISUALS.html`. Need to extend.

| # | Asset | Dimensions | Status |
|---|---|---|---|
| 1 | LinkedIn sponsored "Stop hiring VAs" | 1200×627 | ✅ done (Claude Design + HTML) |
| 2 | Instagram metric card "40+" | 1080×1080 | ✅ done |
| 3 | Twitter/X dark stat card | 1600×900 | ✅ done |
| 4 | Display skyscraper "Live in 30 days. Or it's free." | 300×600 | ✅ done (HTML) |
| 5 | Email signature banner | 600×200 | ✅ done (HTML) |
| 6 | Logo lockup sheet | 1200 wide | ✅ done (HTML) |
| 7 | LinkedIn carousel "30-Day Ramp" | 1080×1080 × 5 slides | ⏳ Claude Design (was failing) |
| 8 | Founder quote card | 1080×1080 | ⏳ planned |
| 9 | Customer testimonial card | 1080×1080 × 4 (one per case study) | ⏳ blocked on testimonials |
| 10 | "vs DIY tools" comparison graphic | 1600×900 | ⏳ planned |
| 11 | Pricing tier card | 1080×1080 | ⏳ planned |
| 12 | "What 14 seconds looks like" hook image | 1080×1080 | ⏳ planned |

---

### ✉️ Email templates

| # | Asset | Status |
|---|---|---|
| 1 | Cold outbound — 4 sequences × 4 emails | ✅ done (`EMAIL-OUTBOUND.md`) |
| 2 | Onboarding drip — 7 emails for /book prospects | ✅ done (`ONBOARDING-EMAILS.md`) |
| 3 | Welcome email (post-signup) | ⏳ planned |
| 4 | Weekly digest (already shipped to customers) | ✅ done (in `api/weekly-digest.js`) |
| 5 | Newsletter masthead design | ⏳ planned |
| 6 | Holiday/seasonal banners | ⏳ planned |

---

## TIER B — Within 30 days

### 🎬 Cinematic video assets (Higgsfield MCP)

Once Higgsfield MCP is connected, generate b-roll clips that combine with the Slack demos for full commercials.

| # | Asset | Length | Where | Status |
|---|---|---|---|---|
| 1 | "Exhausted operator at desk" hook | 5-8s | Higgsfield Seedance | ⏳ planned |
| 2 | "Relief / aspiration" counter scene | 5-8s | Higgsfield Seedance | ⏳ planned |
| 3 | Particle logo animation reveal | 3-5s | Higgsfield Seedance | ⏳ planned |
| 4 | "Hands typing on keyboard" macro | 5s | Higgsfield Seedance | ⏳ planned |
| 5 | "Coffee pouring + sunlight" texture | 5s | Higgsfield Seedance | ⏳ planned |
| 6 | "City skyline at golden hour" b-roll | 5-10s | Higgsfield Seedance | ⏳ planned |

**Goal:** mix-and-match library of 6-10 cinematic clips that we can stitch with Slack demo screen recordings + voiceover to produce custom commercials per channel.

---

### 🎙️ Founder content (Andrew Yoon)

| # | Asset | Length | Status |
|---|---|---|---|
| 1 | Founder origin story — the long version | 90-120s | ⏳ needs recording |
| 2 | "Why I built Ramped" — 30s elevator | 30s | ⏳ needs recording |
| 3 | Andrew's voiceover on the hero commercial | 15-30s | ⏳ needs recording |
| 4 | Podcast appearance prep doc | n/a | ⏳ planned |
| 5 | Substack/blog series — 4 posts (Why I built / How it works / Cost analysis / Future) | n/a | ⏳ planned |
| 6 | Office/desk B-roll for talking head cuts | 30-60s | ⏳ needs filming |

**Tool:** iPhone or DSLR, ScreenFlow/Descript for editing. Real human voice — DO NOT use TTS for founder content.

---

### 🎯 Vertical-specific landing pages

Each vertical gets its own landing page that mirrors the homepage but with vertical-specific copy + demo + case study.

| # | Vertical | URL | Status |
|---|---|---|---|
| 1 | Logistics & distribution | `/for/logistics` | ⏳ planned |
| 2 | Dental / multi-location healthcare | `/for/dental` | ⏳ planned |
| 3 | Field services | `/for/field-services` | ⏳ planned |
| 4 | Property management | `/for/property-management` | ⏳ planned |
| 5 | Manufacturing | `/for/manufacturing` | ⏳ planned |
| 6 | Professional services | `/for/professional-services` | ⏳ planned |

**Tool:** HTML, same masthead/layout as homepage, vertical-specific copy variants from `LANDING-PAGE-COPY.md`.

---

### 📊 Interactive content

| # | Asset | URL | Status |
|---|---|---|---|
| 1 | ROI calculator | `/roi-calculator` | ⏳ planned |
| 2 | "Which agents would I get?" quiz | `/free-roadmap` (already exists) | ✅ done |
| 3 | Live agent count widget on homepage | embed | ⏳ planned |
| 4 | Customer logo carousel with case-study links | hero section | ✅ done (links wired up) |

---

## TIER C — Polish over time (months 2-6)

### 📚 Content marketing (Substack/blog)

| # | Asset | Status |
|---|---|---|
| 1 | "Why I'm building an AI department" (founder origin essay, 1500w) | ⏳ planned |
| 2 | "The 4-VA problem" (positioning piece) | ⏳ planned |
| 3 | "Why most AI implementations fail in 2026" | ⏳ planned |
| 4 | "What 30 days actually looks like" (process deep-dive) | ⏳ planned |
| 5 | "How we know an agent is broken before the customer does" (technical credibility) | ⏳ planned |
| 6 | Quarterly "patterns across our customers" report | ⏳ planned |

---

### 🎤 Podcast / public appearances

| # | Asset | Status |
|---|---|---|
| 1 | Pitch deck for podcast appearances | ⏳ planned |
| 2 | List of target podcasts (SaaStr, Founder Coffee, 20VC, Lenny's, etc.) | ⏳ planned |
| 3 | Speaker bio | ⏳ planned |
| 4 | Conference talk — 30-min "Building AI Departments" | ⏳ planned |

---

### 🎁 Partner / integration co-marketing

| # | Asset | Status |
|---|---|---|
| 1 | Slack partnership listing | ⏳ planned |
| 2 | HubSpot marketplace listing | ⏳ planned |
| 3 | NetSuite SuiteApp listing | ⏳ planned |
| 4 | "Built on Anthropic Claude" badge (with permission) | ⏳ planned |

---

### 💼 Sales enablement

| # | Asset | Status |
|---|---|---|
| 1 | Sales deck (already exists v2) | ✅ done |
| 2 | Demo loop video (auto-plays at events) | ⏳ planned |
| 3 | Trade show booth video (60s loop) | ⏳ planned |
| 4 | Customer reference call playbook | ⏳ planned |
| 5 | Mutual action plan (MAP) template | ⏳ planned |
| 6 | Pricing PDF (1-pager) | ✅ done |

---

### 🎨 Misc / long tail

| # | Asset | Status |
|---|---|---|
| 1 | T-shirt design for team / customer giveaways | ⏳ planned |
| 2 | Sticker designs (laptop swag) | ⏳ planned |
| 3 | Conference badge swag | ⏳ planned |
| 4 | Holiday card design | ⏳ planned |
| 5 | Investor update template (monthly) | ⏳ planned |
| 6 | Press kit (logo files, headshots, screenshots) | ⏳ planned |

---

## Production strategy — what to ship in what order

### Today/this week (highest impact, fastest):
1. ✅ Marketing-Pack copy decks (16 docs)
2. ✅ Marketing visuals HTML (6 ad creatives)
3. 🔄 Slack demo pages — first 4 (Ops, Sales, Finance, Support)
4. Then: 4 more Slack demos (Quote, Inventory, Meeting prep, Follow-up)

### Next week:
1. Get Higgsfield MCP connected
2. Generate brand mascot character via Higgsfield
3. Generate 4-6 cinematic b-roll clips
4. Stitch first commercial in ChatCut with Andrew's VO

### Week 3-4:
1. First customer case studies live (need permission)
2. First 3 vertical landing pages (logistics, dental, field services)
3. Founder talking head video — origin story
4. Launch first paid LinkedIn ads with Marketing Visuals

### Month 2:
1. ROI calculator
2. Substack blog launch
3. Press kit + first podcast appearances
4. Conference / event materials

---

## Channel-by-channel content cadence (when this is all built)

| Channel | Cadence | Mix |
|---|---|---|
| LinkedIn (founder) | 3x/week | 60% educational, 30% demos, 10% direct CTA |
| LinkedIn (company) | 1x/week | Customer wins, product updates, behind-the-scenes |
| Twitter/X (founder) | 5x/week | Hot takes, threads, demo screenshots |
| Instagram | 3x/week + daily stories | Reels (demos), carousels (timelines), founder POV |
| Email newsletter | 1x/week | Customer story + thinking + invite to call |
| Substack/blog | 1x/2 weeks | Long-form thinking |
| Podcast guest spots | 2x/month (target) | Founder voice on partner shows |
| Paid LinkedIn | always-on | $50-200/day testing |

---

## Owner / dependencies

| Asset | Who/what blocks it |
|---|---|
| Customer testimonial videos | Need permission from customer + 30 min of their time |
| Founder talking head | Andrew's calendar |
| Vertical landing pages | Marketing copy already written; just need HTML build |
| Cinematic AI video | Higgsfield MCP connection (~5 min setup) |
| Sound logo | Suno generation or freelance composer (~$200) |
| Press kit | Real photographer ($500-1000 for shoot) |

---

*Roadmap last updated 2026-04-30. Refresh quarterly. Cross off completed items, promote Tier B → A when relevant.*
