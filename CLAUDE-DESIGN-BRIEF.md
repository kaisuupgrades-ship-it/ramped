# Brief for Claude Design — Option 2: Full multi-page site

Copy-paste this whole file into Claude Design as your first message in a fresh chat. Then attach `SITE-CONTENT.md` from this same folder when prompted.

---

## What I'm asking for

Expand your `Ramped AI Prototype` (the dark-theme one with the interactive bot demo, gradient hero, timeline cards, and dual-radial-gradient final CTA) into a **complete multi-page static website** for `30dayramp.com`.

Use the **same design system** as the prototype — same tokens, same hero treatment, same demo, same timeline component, same final CTA card, same masthead/footer language. Don't redesign — just expand.

I want the final deliverable to be **standalone HTML files** I can deploy to Vercel as-is (no framework, no build step required). Same approach as the original prototype.

## Pages to build (priority order)

1. **`index.html`** — Homepage. Use your prototype as-is, but make sure:
   - The interactive Slack-style demo is preserved exactly (same 4 playbooks)
   - Pricing section is included (3 tiers — see SITE-CONTENT.md)
   - FAQ section is included (5–6 questions — see SITE-CONTENT.md)
   - Xtractor Depot inline quote between demo and timeline
2. **`about.html`** — Founder story + team
3. **`book.html`** — Discovery call booking (calendar + 12-step form)
4. **`comparison.html`** — VA vs AI agents comparison (with the big table)
5. **`free-roadmap.html`** — Lead magnet form
6. **`questionnaire.html`** — Post-booking 11-step questionnaire
7. **`thanks.html`** — Form-submission confirmation
8. **`privacy.html`** — Privacy policy
9. **`404.html`** — Error page
10. **`resources.html`** — AI news feed (dynamic, fetches from `/api/resources`)
11. **`agent-library.html`** — Customer-style scenarios with Slack mockups

## What's in the attached SITE-CONTENT.md

Every word of every page, verbatim:

- **Hero copy** for each page (eyebrow / H1 / lede / CTAs / trust signals)
- **All section H2s and body paragraphs** in document order
- **All cards / tiles / stat blocks** with their full sentences
- **Pricing tiers** — exact numbers ($2,083 / $2,500 / $4,167 / $5,000 / $10K floor), feature lists, billing toggle behavior
- **All forms** — every field, label, placeholder, validation rule, where it POSTs to
- **The 4 demo workflows** — full WORKFLOWS object for the bot playback
- **The agent-library scenarios** — 4 Slack-style conversations with all messages and action buttons
- **Comparison tables** — 10-row VA table + 6-row DIY-tools table
- **Customer proof** — Xtractor Depot case study (the only real one)
- **FAQ Q&As** — full text
- **Privacy policy** — full text (legal compliance)
- **Brand v3 tokens** — the dark-theme CSS variable block
- **Stack / API notes** — Vercel serverless, Supabase, Resend, Google Calendar OAuth, Anthropic Claude

## Hard constraints (don't deviate)

- **Email:** Only `jon@30dayramp.com`. Never `hello@`, `support@`, etc.
- **Pricing:** Don't change the numbers. Starter `$2,500/mo` (or `$2,083/mo annual`), Growth `$5,000/mo` (or `$4,167/mo annual`), Enterprise `From $10K/mo`. Plus `$2,500` Starter onboarding / `$3,500` Growth onboarding.
- **CTA copy:** Primary CTA is **"Book a discovery call →"**. Secondary is **"Get your free roadmap"**. Don't invent variants.
- **Domain / canonical URLs:** `https://www.30dayramp.com/{path}` for every page.
- **30-day go-live guarantee** is the central commitment. Reinforce it in hero, pricing, FAQ, and final CTA.
- **No fictional logos / stock customer claims.** The only published customer is Xtractor Depot.
- **The interactive demo on the homepage is functionally complete** — keep my workflows, keep my state machine. You can restyle the visual chrome but don't change what it does.
- **Tone:** Founders / operators / CEOs. Plain, confident, specific. No "we're passionate" filler. No emoji in body copy.

## What I'd love (nice-to-have)

- Make the **30-day timeline** the same visual treatment across pages where it makes sense (about, free-roadmap, questionnaire).
- Use the **dual-radial-gradient final CTA card** as the closing section on every customer page (ABout, comparison, etc.) so the site feels coherent.
- **Hover/focus states** on every interactive element — the prototype was generous with motion, keep that energy.
- A **proper 404** designed in the dark theme (the current one is OK but could be branded better).

## What I'll handle on my side

- DNS / Vercel deployment
- Real API endpoints (the form payload shapes are documented in SITE-CONTENT.md)
- Cal.com / Calendar integration on `/book` (you can mock with a dummy calendar component or embed)
- The `/api/resources` feed for `/resources` (you just build the static skeleton)
- Email templates (separate project)

## Output format

Give me **one HTML file per page**, each self-contained (inline CSS + JS like your prototype, no framework). Or — if it's more efficient — give me one shared CSS file (like `/styles.css`) and the per-page HTML files thin.

Bundle everything in a single `.zip` export when you're done so I can drop it in.

---

That's the full brief. Read SITE-CONTENT.md, then ask me anything that's ambiguous before you start building.
