# Ramped AI — Roadmap

**Version:** v1 · synthesized at the close of the 5-phase audit/strategy engagement (2026-04-29).
**Source docs:** `AUDIT.md` (security) · `VISUAL-AUDIT.md` (design/UX) · `MOBILE-AUDIT.md` · `BUSINESS-STRATEGY.md`.
**How to use this doc:** the work below is laid out in three horizons — **week 1**, **weeks 2–4**, **next quarter**. Within each horizon, items are roughly ordered by ROI ÷ effort. Every item is tagged with the audit it came from so you can drill into context.

The *single* highest-leverage move is the senior implementation-manager hire (Q1 item). Without it, everything else in the quarter scales linearly with Jon's calendar.

---

## Status from the engagement

| Phase | Delivered | Open after this | Where |
|---|---|---|---|
| **1 · Security** | 10 patches landed (cron auth, OAuth XSS, admin-auth `?token=` removed, send-followup signed URL, `Origin: *` removed, schema reconciliation + RLS migrations 006/007) | 6 patches awaiting sign-off + ~21 medium/low findings | `AUDIT.md` |
| **2 · Visual** | All 11 Tier A fixes shipped (font loadouts standardized, dashboard.html stub, portal banner flat-ink, admin a11y, mobile sidebar reorder) + V2-B6 hero live overlay | 7 Tier B + 5 Tier C items | `VISUAL-AUDIT.md` |
| **3 · Tests** | Playwright suite (14 spec files, 139 tests, 8 projects) · `scripts/check-fonts.sh` + `scripts/check-tokens.sh` lint scripts · `scripts/e2e-test.sh` updated for Bearer auth | CI integration · pricing-toggle lint | `tests/README.md` |
| **4 · Strategy** | `BUSINESS-STRATEGY.md` (10 sections, 10-competitor matrix, SWOT, sequenced recommendations) · `Ramped-Strategy-v2.pptx` (16-slide deck) | Recommendations themselves are the roadmap below | `BUSINESS-STRATEGY.md` |
| **+ Materials tab** | Centralized library at `/admin → Materials` · `materials.json` manifest · `/api/admin-materials` CRUD · file-manager UX (drag-drop upload, edit, delete) · migration 008 + private bucket live | None — feature complete | `admin.html`, `api/admin-materials.js` |

---

## Week 1 — quick wins (≤3 hrs each, all reversible)

The intent of week 1 is **visible polish + remove embarrassing gaps**. Nothing here changes positioning fundamentally, but every item is something a sharp prospect would notice on a discovery call.

| # | Item | Source | Effort | DoD |
|---|---|---|---|---|
| W1-1 | **Verify SpaceX / Lucid Motors claim once and for all.** Either get a screenshot or LinkedIn endorsement and add proof line; or soften to "supplied to Tier-1 EV/aerospace customers" without naming. | `BUSINESS-STRATEGY.md §6` · v1 audit C11 | 1 hr (Andrew's call) | Either: about.html shows real proof OR claim is reworded. No unverified named-customer claim left on the site. |
| W1-2 | **Trim industry pill list 8 → 2–3 verticals you can back.** Drop industries with zero shipped customers; keep only `Industrial supply · Field services · Professional services` (or whatever has proof). | `VISUAL-AUDIT.md` v1 M9 · `BUSINESS-STRATEGY.md §3` | 30 min | Homepage industry pills show only verticals with at least one referenceable customer or strong founder network. |
| W1-3 | **Promote 30-day guarantee from chip → hero co-equal.** Currently a small chip; make it a co-equal element with the headline. Pure copy/CSS. | `BUSINESS-STRATEGY.md §6` | 30 min | Above-the-fold readers can't miss the guarantee. |
| W1-4 | **Add Enterprise price floor: "from $10K/mo · scoped on call".** Currently "custom" reads as "we'll figure it out." Posting a floor primes anchoring + signals seriousness. | `BUSINESS-STRATEGY.md §5` | 10 min | `/comparison` and `/book` Enterprise blocks show the floor. |
| W1-5 | **Add `/comparison` Tab 2: "Why not Lindy / Zapier / Gumloop?"** 3 rows: Build, Run, Tradeoff. Position Ramped as "you don't manage it" against DIY tools. | `BUSINESS-STRATEGY.md §6` | 3 hrs | A prospect's "why not just use Zapier?" objection is answered on-page in <30 sec. |
| W1-6 | **Push the deferred audit code-fix.** Materials API graceful-fallback patch (already on disk, awaiting commit). | this engagement | 5 min | `git push` lands; admin shows amber banner instead of HTTP 500 if migration is ever missing. |
| W1-7 | **Refresh `sitemap.xml` `lastmod` dates** to today's commit. Minor SEO hygiene. | v1 audit Phase 3 | 10 min | All canonical URLs in sitemap show fresh `lastmod`. |

**Total: ~5 hrs of Jon's time. All shippable in one focused afternoon.**

---

## Weeks 2–4 — strategic ground game (5 moves)

This horizon is about laying the foundation that compounds: testimonials, vertical playbooks, compliance posture. Each item takes a meaningful chunk of effort but is independent of the others.

| # | Item | Source | Effort | DoD |
|---|---|---|---|---|
| M1-1 | **Land 2 named testimonials (target 2026-05-29).** Source from existing customer pipeline. Photograph or video where possible. Replace placeholder customer-strip logos as new ones ship. | `BUSINESS-STRATEGY.md §4 + §6` · `VISUAL-AUDIT.md` v1 M8 | depends on Jon | 2 named testimonials on homepage; one is a video. |
| M1-2 | **Build 1 vertical landing page** (e.g. `/industrial-supply` or `/field-services`). Industry-specific copy, industry-specific roadmap example, industry-specific testimonial. Test paid traffic A/B vs `/book`. | `BUSINESS-STRATEGY.md §6` | 12 hrs | One vertical page live; paid traffic split test running. |
| M1-3 | **Add a "real demo" surface above the fold.** 60-sec Loom of `client-demo.html` running, OR a Loom-style screencast voiced by Jon. Embed on homepage hero. | `VISUAL-AUDIT.md` v2 V2-B6 (closed via CSS overlay) and v2 V2-C2 (real video still open) | 6 hrs | Homepage hero shows a real product video; LCP unchanged. |
| M1-4 | **Productize the questionnaire as a standalone lead magnet.** Today the questionnaire is gated behind booking. Allow a standalone version that emails the prospect their roadmap *without* booking — the booking CTA is on the roadmap page. | `BUSINESS-STRATEGY.md §6` · v1 audit C2 (already mitigated server-side) | 16 hrs | Standalone `/free-roadmap` flow live; conversion roadmap-viewers → booking measurable. |
| M1-5 | **Start SOC 2 Type 1.** Vanta / Drata / Tugboat. Type 1 ≈ $15–25K and 8–12 weeks. Without it, healthcare and legal verticals are off-limits. | `BUSINESS-STRATEGY.md §4 + §6` | $15–25K + ops time | SOC 2 vendor selected, kickoff scheduled. Type 1 tracker live in admin. |

---

## Next quarter — strategic investments

These are the moves that materially change the business shape. Sequenced so each unlocks the next.

| # | Item | Source | Effort | DoD |
|---|---|---|---|---|
| Q1-1 | **★ Hire #1: Senior Implementation Manager.** Owns the build phase end-to-end. Removes Jon as the bottleneck. Salary band: $130–180K + equity. **The single highest-leverage move available — without it, Ramped is capped at ~10 active customers.** | `BUSINESS-STRATEGY.md §6 + §9` | 4–6 wks search + onboarding | First customer's build-phase QBR run by IM, not Jon. |
| Q1-2 | **Build 2 vertical playbooks.** Documented + templated workflow for the top 2 verticals. Time-to-build per customer in those verticals should drop 50%+ between customer 2 and customer 5. | `BUSINESS-STRATEGY.md §3 + §6` | 3–4 wks (depends on Q1-1) | Playbook docs live; build-time-per-customer baseline + improvement tracked. |
| Q1-3 | **Launch the "Ramp Index"** — quarterly anonymized benchmark report. Inbound SEO play + earned media. Aim: customer #10 onboarded with attribution to the Index. | `BUSINESS-STRATEGY.md §4` | 2 wks (post n≥10) | First Ramp Index published; tracked in inbound attribution. |
| Q1-4 | **Refund-rate dashboard.** Internal at first, public once the number stays sub-5% for 6+ months. Make it a board metric. | `BUSINESS-STRATEGY.md §8` | 1 wk | Dashboard live in admin; integrated into weekly review. |
| Q1-5 | **Add the $497 "AI Health Check" SKU.** A 1-hour call + 5-page roadmap delivered in 3 business days, $497, no commitment. Lead-gen + qualification. Convert ~20–30% to Starter. | `BUSINESS-STRATEGY.md §6` | 2 wks | New SKU live in Stripe; first paying audit customer onboarded. |

### Outstanding security work (track in parallel — none are blocking but all matter)

These are Phase 1 audit items that need owner sign-off before applying. Each is documented in `AUDIT.md §C2-* / §H2-*` with file:line citations and ready-to-apply fix snippets.

| # | Item | Severity | Effort | Why deferred |
|---|---|---|---|---|
| S-1 | **Admin token: `localStorage` → `sessionStorage` only** + clean migration | Critical (C2-2) | 1 hr code + ops note | Changes admin UX (re-auth per tab) — wanted owner sign-off |
| S-2 | **Cloudflare Turnstile on `/api/contact`, `/api/book`, `/api/questionnaire`** | Critical (C2-4) | 4 hrs + DNS setup | Email-bombing vector; needs Turnstile site key + secret |
| S-3 | **OAuth state hardening: ephemeral signed state + drop `token=` from `/api/google-oauth-start`** | Critical (C2-5) | 2 hrs (depends on admin UI button change) | Token-leakage via Referer; depends on admin UI change |
| S-4 | **Email-change confirmation flow on `/api/portal-profile`** | High (H2-1) | 4 hrs (new endpoint + email template) | Account email takeover risk if portal URL phished |
| S-5 | **Questionnaire: require `booking_id`, remove email-only fallback** | High (H2-4) | 30 min | Could break legacy email links in flight; coordinate with email cohort |
| S-6 | **Distributed rate-limiter (Vercel KV / Upstash)** | High (H2-8) | 4 hrs + KV provisioning | Current in-memory rate limiter is per-container; bypassed at scale |
| S-7 | **Nonce-based CSP — drop `'unsafe-inline'` from `script-src`** | Medium (M2-12) | 8 hrs (touches every inline script across 22 HTML pages) | Pair with v1 M1 build-pipeline; expensive to do without it |

---

## Tier B/C visual items (open after V2-A batch)

Pulled from `VISUAL-AUDIT.md §E`. These are bigger lifts that need design judgment or budget.

| # | Item | Tier | Effort | Notes |
|---|---|---|---|---|
| V-B1 | **30-second silent demo video above the fold** | B | 4–6 hrs | Highest-ROI single visual change (V2-B6 / V2-C2). The CSS-only overlay we shipped is a placeholder; a real video is the upgrade. |
| V-B2 | **Objection-handling section: "Why $2,500/mo when self-serve is $97?"** | B | 2 hrs (copy + design) | Sits below pricing block. Three bullets + link to /comparison. Same as W1-5 but on the homepage rather than the comparison page. |
| V-B3 | **Real agent-UI screenshot for hero (not the static one)** | B | 2–3 hrs | Same as v1 B1 from the visual audit — still unbuilt. Could be commissioned via the Claude Design prompts in `CLAUDE-DESIGN-PROMPTS.md`. |
| V-B4 | **Re-flow `/admin` bookings table for narrow viewports** | B | 2 hrs | Currently horizontal-scrolls a 7-column table on mobile; no reflow. |
| V-B5 | **Inline error rendering replacing `alert(...)` in `portal.html`** | B | 1.5 hrs | 10 occurrences of `alert(err.message)` — all should render inline. |
| V-B6 | **Sticky `<thead>` + zebra striping + per-row hover on `/admin` bookings** | B | 30 min | Improves scannability at >50 bookings. |
| V-B7 | **Pricing toggle: bump active-state contrast for the muted-track edge** | B | 15 min | Currently fails WCAG AA (~3.5:1). |
| V-B8 | **Portal "Welcome, $name" banner: pre-launch vs post-go-live variants** | B | 1 hr | Same banner reads stale once a customer goes live; needs phase-aware copy. |
| V-C1 | **Replace four-bar logo mark with a distinctive single-letter or single-curve mark** | C | designer | Forgettable today. CLAUDE-DESIGN-PROMPTS.md Prompt 2 has a brief. |
| V-C2 | **Introduce a second accent color** (warm coral / amber-orange) for "Verified" / "Live" / "Active" badges | C | designer | Reduces visual monotony of all-blue accents. |
| V-C3 | **Real photography or commissioned illustration on About + Customers + Hero** | C | designer + budget | Stripe/Ramp/Notion bar; biggest "premium feel" gap. |
| V-C4 | **Per-page OG images for top 4 pages** | C | designer | Currently all share `og-image.png`. |
| V-C5 | **Custom dark-theme treatment for `/portal` welcome banner** that's part of a system, not a one-off gradient | C | designer | We landed a flat `--ink` placeholder in V2-A7; a real designed surface comes later. |

---

## Operational hygiene (ongoing, no end-state)

| Item | Cadence |
|---|---|
| **Run `bash scripts/check-tokens.sh` and `bash scripts/check-fonts.sh`** before merging any frontend PR | per-PR |
| **Run `bash scripts/e2e-test.sh` against the Vercel preview URL** before merging any backend PR | per-PR |
| **`git pull origin main && git rev-parse HEAD`** before any audit or review session | per-session |
| **Update `materials.json`** when shipping a new strategy doc, deck, or brand asset | per-artifact |
| **Bump audit docs (`AUDIT.md`, `VISUAL-AUDIT.md`, `MOBILE-AUDIT.md`)** when a finding is closed; mark as `(fixed in <commit>)` rather than deleting | per-fix |

---

## Where the leverage is, in one paragraph

If you do nothing else from this roadmap, do these three things:

1. **W1-3 + W1-5 + W1-6** — promote the guarantee, answer the DIY-tools objection on `/comparison`, push the materials API hardening. Total ≈ 4 hours, all this week.
2. **M1-1** — land 2 named testimonials by 2026-05-29. The single thing that will measurably move conversion this month.
3. **Q1-1** — start the senior implementation manager search now. Even if you're not 100% ready to hire, a 6-week pipeline is shorter than the 6 months you'd lose discovering you needed the role under load.

Everything else compounds from there.

---

*Last updated: 2026-04-29. Update this doc as items ship — mark closed items `~~struck through~~ (closed in <commit>)` rather than deleting.*
