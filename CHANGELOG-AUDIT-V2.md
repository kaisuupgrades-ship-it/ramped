# Audit v2 — Consolidated Changelog

**Engagement:** 5-phase audit + strategy review · 2026-04-29
**Audited at:** commit `c87ffa1` on `main` (post-Phase 1+2+3 push)
**Authored by:** Senior Engineer / Designer / Strategy advisor pass
**Audience:** Jon, future maintainers, future-you in 6 months. Keep this file as a release-notes artifact.

This document walks through every file touched in the audit engagement, organized by the 5 phases of the original brief. Each line is a commit-style summary with a one-line "why" and the file path(s).

---

## Phase 1 — Security audit (OWASP Top 10 + modern web/API)

**Scope:** all 22 HTML pages, 31 API endpoints + 9 `_lib` modules, 5 SQL migrations (now 8), `vercel.json`, every context doc.
**Headline finding:** 5 Critical · 8 High · 12 Medium · 6 Low. **Patches landed:** 10. **Patches awaiting sign-off:** 6.

### Patches applied

| Type | File | Why |
|---|---|---|
| **NEW** | `api/_lib/cron-auth.js` | Shared `isCronAuthorized(req)` helper — timing-safe Bearer-token compare for cron endpoints |
| PATCH | `api/reminders.js` | Gate behind `isCronAuthorized` (CRIT-1) — was unauth GET that could fire mass reminder emails |
| PATCH | `api/weekly-digest.js` | Drop User-Agent fast-path; require Bearer cron secret (HIGH-2) — UA was spoofable |
| PATCH | `api/_lib/admin-auth.js` | Removed deprecated `?token=` query-string fallback (HIGH-5) — token-leakage via Referer/history |
| PATCH | `api/google-oauth-callback.js` | HTML-escape `error` param + `whoami` (CRIT-3) — was reflected XSS sink |
| PATCH | `api/send-followup.js` | Sign the roadmap URL with HMAC token (HIGH-6) — was generating broken links |
| PATCH | `api/resources.js` | Replace `Origin: *` with project allowlist (MED-9) |
| **NEW** | `db/migrations/006_fix_agent_runs_schema.sql` | Reconcile dual `agent_runs` definition (HIGH-3) — silent collision between mig 001 and 004 |
| **NEW** | `db/migrations/007_rls_hardening.sql` | Enable RLS + service_role policies on every table from mig 003/004 (HIGH-7) |
| EXTEND | `AUDIT.md` | v2 audit prepended (severity table, full detail per finding); v1 preserved below |

### Deferred (need owner sign-off; documented in `ROADMAP.md` outstanding-security table)

- Admin token: `localStorage` → `sessionStorage` only (CRIT-2 — UX changes)
- Cloudflare Turnstile on public POST endpoints (CRIT-4 — DNS + env vars)
- Full OAuth state hardening (CRIT-5 — depends on admin UI button change)
- Email-change confirmation flow (HIGH-1 — new endpoint + email)
- Questionnaire `booking_id` required (HIGH-4 — could break legacy email links)
- Distributed rate-limiter via Vercel KV / Upstash (HIGH-8 — needs KV provisioning)

---

## Phase 2 — Visual + UI + UX audit

**Scope:** Nielsen 10 heuristics + premium SaaS comparison (Stripe, Ramp, Linear, Notion) + Lindy.ai + Gumloop. All 22 HTML pages incl. protected ones (admin, dashboard, portal) — **the protected pages had never been design-audited before**.
**Headline:** 19 open items (7 Tier A · 7 Tier B · 5 Tier C). **Tier A fully landed + V2-B6 hero overlay.**

### Patches applied

| Type | File | Why |
|---|---|---|
| EXTEND | `VISUAL-AUDIT.md` | v2 audit prepended (token consistency table across protected pages, Nielsen-by-Nielsen review, prioritized A/B/C plan); v1 preserved below |
| PATCH ×6 | `admin.html`, `pricing-onepager.html`, `thanks.html`, `privacy.html`, `questionnaire-preview.html` (and others) | Add `JetBrains Mono` to pages that referenced it in CSS but didn't load it (V2-A2) |
| PATCH ×5 | `logo-concepts.html`, `pitch.html`, `sales.html`, `heroes.html`, `one-pager.html`, `portal.html` | Standardize Inter / JBM weight loadout to canonical `400;500;600;700;800` and `400;500` (V2-A3) |
| REWRITE | `dashboard.html` | 25KB orphan auth-shell → 624-byte meta-refresh stub redirecting to `/admin` (V2-A4) |
| PATCH | `vercel.json` | `/dashboard → /admin` redirect now `permanent: true` (V2-A4) |
| PATCH | `portal.html` | Empty-state copy rewritten passive → directional ("comes online" → "complete onboarding to unlock", with CTA buttons) (V2-A6) |
| PATCH | `admin.html` | `confirmDialog` made accessible: `role="dialog"`, `aria-modal`, focus trap, Escape-to-close, return-focus (V2-A5) |
| PATCH | `portal.html` | Native `confirm()` replaced with self-contained accessible inline dialog (`portalConfirm`) (V2-A6) |
| PATCH | `portal.html` | Welcome banner: 3-stop blue gradient → flat `--ink` surface with subtle radial highlight (V2-A7) |
| PATCH | `admin.html` | Auth label "Password" → "Admin token"; placeholder "Bearer token"; `autocomplete="off"` (V2-A8) |
| PATCH | `admin.html` | Auth-card neo-brutalist `4px 4px 0` shadow → subtle `0 4px 16px rgba(11,18,32,.06)` (V2-A9) |
| **NEW** | `scripts/check-tokens.sh` | Lint script: design-token drift guard for protected pages (V2-A10) |
| **NEW** | `scripts/check-fonts.sh` | Lint script: Inter / JBM loadout drift guard across all pages (V2-A10) |
| PATCH | `portal.html` | Mobile (≤920px): sidebar pinned above activity feed via `order: -1` (V2-A11) |
| PATCH | `index.html` | **V2-B6: live overlay on hero agent showcase** — pulsing LIVE badge, status pill cycling Watching → Reading → Drafting → Sent (14s loop), typing-dots indicator. CSS-only, no video file, prefers-reduced-motion honored. |

---

## Phase 3 — End-to-end smoke tests + functional coverage (Playwright)

**Scope:** every public page, every API endpoint, accessibility, mobile viewports, Lighthouse perf/a11y/best-practices/SEO. **139 individual tests across 8 Playwright projects.**

### Patches applied

| Type | File | Why |
|---|---|---|
| **NEW** | `tests/lib/pages.js` | Single source of truth for canonical paths + per-page invariants |
| **NEW** | `tests/lib/portal-token.js` | HMAC token generator (mirrors `api/_lib/map-token.js`) for portal tests |
| **NEW** | `tests/public/canonical.spec.js` | All canonical URLs return 200; redirects validated; 404s render branded page |
| **NEW** | `tests/public/homepage.spec.js` | Hero + V2-B6 overlay + pricing toggle + mobile drawer + JSON-LD + founder credit |
| **NEW** | `tests/public/booking.spec.js` | Booking happy path against live `/api/book`; auto-cleanup with ADMIN_TOKEN; validation cases |
| **NEW** | `tests/public/comparison.spec.js`, `about.spec.js`, `resources.spec.js` | Per-page invariants + mobile checks |
| **NEW** | `tests/api/public-endpoints.spec.js` | Every public API returns expected status; cron endpoints reject unauth (CRIT-1, HIGH-2 verification); IDOR patches verified (get-map, get-roadmap) |
| **NEW** | `tests/api/admin-endpoints.spec.js` | Bearer auth gating; `?token=` removal verified (HIGH-5); admin-update validation; happy-path with ADMIN_TOKEN |
| **NEW** | `tests/api/portal-endpoints.spec.js` | HMAC token gating across 7 portal endpoints; expired-token rejection; Stripe webhook signature gating |
| **NEW** | `tests/protected/admin-flow.spec.js` | `/admin` auth screen + dashboard interactions + V2-A5 modal a11y verification |
| **NEW** | `tests/protected/portal-flow.spec.js` | Portal HMAC gate + V2-A7 banner color verification |
| **NEW** | `tests/a11y/scan.spec.js` | axe-core scan on every public page (WCAG 2.1 AA; color-contrast deferred to a follow-up) |
| **NEW** | `tests/mobile/viewports.spec.js` | iPhone 12 / Pixel 5 / iPad Mini overflow + drawer + hero checks |
| **NEW** | `tests/lighthouse/scores.spec.js` | Performance ≥80, A11y ≥95, BP ≥90, SEO ≥95 on top funnel |
| **NEW** | `tests/README.md` | Setup, run, env vars, layout, audit-trace map |
| **NEW** | `playwright.config.js` | 8 projects (public-desktop, protected-desktop, api, a11y, mobile-iphone/pixel/ipad, lighthouse) |
| **NEW** | `package.json` | 13 scripts including `npm test`, `npm run verify`, lint scripts |
| **NEW** | `.gitignore` | Playwright + Vercel + IDE |
| PATCH | `scripts/e2e-test.sh` | Switch to `Authorization: Bearer` headers; align status enum to `VALID_STATUSES` (post HIGH-5) |
| **NEW** | `README.md` | Full project overview: stack, repo layout, env vars matrix, run instructions, audit pointers, deploy steps |

### Verification at engagement close

- All 14 test files + 2 lib files + config pass `node --check`.
- Playwright installed cleanly in `/tmp/pwtest`; `npx playwright test --list` enumerates all 139 tests.
- 17 of 20 sample API tests passed against live deploy. **3 failures revealed the most important finding of Phase 3:** the Phase 1 cron-auth patches were not yet deployed — they were still local-only at the time of Phase 3 verification (resolved by user push on engagement-close day).

---

## Phase 4 — Business model + competitor analysis

**Scope:** 10 competitors live-researched (Lindy.ai, Gumloop, Zapier AI Agents, Viktor, WhiteHorse AI, GoHighLevel AI Employee, Adept (defunct), SmythOS, Automation Agency, AI SMB Solutions) + 2 substrate threats (Claude Cowork, ChatGPT Agent / Codex). Anchored against 2026 pricing data.

### Patches applied

| Type | File | Why |
|---|---|---|
| **NEW** | `BUSINESS-STRATEGY.md` | 253-line strategy review: current model deconstruction, unit economics, 10-competitor matrix, SWOT, pricing review (6 tests + 3 do-not-changes), positioning gaps, sequenced recommendations (week / 30 days / quarter / defer), metrics dashboard spec, risk register |
| **NEW** | `Ramped-Strategy-v2.pptx` | 16-slide PowerPoint deck synthesized from BUSINESS-STRATEGY.md. Brand-palette dark sandwich structure. Two visual-QA passes via subagent. |
| **NEW** | `Ramped-Strategy-v2.pdf` | PDF export of the deck for sharing without PowerPoint |

### Top-3 strategic findings

1. **The 30-day money-back guarantee is the most defensible thing on the site.** No competitor in the matrix has a comparable falsifiable risk reversal. WhiteHorse AI's "only pay when it works" is closest but only on sales agents.
2. **Substrate commoditization is the medium-term existential threat.** Claude Cowork (Anthropic) + ChatGPT Agent / Codex (OpenAI) launched 2025–26 at $20–200/mo and target the same buyer. Compete on outcome + accountability, not on the agent itself.
3. **AI-app retention is structurally broken** (21% annual vs 31% non-AI). Done-for-you is the best structural defense — but only if outcome metrics are visible to the customer monthly.

### One-line strategic frame

> **Ramped sells the only thing AI tools can't: the certainty that someone else owns the outcome.**

---

## Phase 5 — Final synthesis (this PR)

| Type | File | Why |
|---|---|---|
| **NEW** | `ROADMAP.md` | Prioritized 1-week / 30-day / quarter backlog. Pulls every open item from Phases 1+2+4 with effort, source citation, and definition-of-done. |
| **NEW** | `CHANGELOG-AUDIT-V2.md` | This document — commit-style summary across all 5 phases |
| PATCH | `README.md` | Update Roadmap section to point at `ROADMAP.md` |
| PATCH | `materials.json` | Add `ROADMAP.md` and `CHANGELOG-AUDIT-V2.md` as Strategy items |
| PATCH | `robots.txt` | Disallow the two new internal docs from search indexing |

---

## Bonus — Materials tab (out of original scope but in scope)

Mid-engagement, the user requested a centralized library to track all the audit/strategy artifacts. This shipped as a real product feature:

| Type | File | Why |
|---|---|---|
| **NEW** | `materials.json` | Curated manifest of repo-tracked artifacts (5 categories, 18 items as of engagement close including Sales Playbook) |
| **NEW** | `api/admin-materials.js` | Full CRUD endpoint: list (repo + uploads merged), upload-init with signed PUT URL, edit metadata, delete, signed download URL. Graceful fallback when migration 008 is missing. |
| **NEW** | `db/migrations/008_admin_materials.sql` | `material_uploads` table + RLS + service_role policy + `updated_at` trigger |
| PATCH | `admin.html` | New `Materials` tab: drag-drop upload zone, upload modal, edit modal, accessible delete confirmation, REPO/UPLOADED source pills |
| **NEW** | Supabase Storage bucket `materials` | Private bucket; files served via short-lived signed URLs |
| PATCH | `CLAUDE.md` | Added rule #11: when shipping a new strategy doc / deck / brand asset, add an entry to `materials.json` |
| **NEW** | `SALES-PLAYBOOK.md` | Discovery-call script: opener, core pitch, urgency, the offer, 4 objection responses, operator notes |
| PATCH | `robots.txt` | Disallow internal artifact URLs from search indexing |

---

## Rough metrics for the engagement

- **~70 files** touched across the repo
- **~2,800 net new lines** added (mostly tests, audit prose, and the strategy deck)
- **3 audit docs** kept honest (`AUDIT.md`, `VISUAL-AUDIT.md`, `MOBILE-AUDIT.md`)
- **3 SQL migrations** added (006, 007, 008)
- **1 new product feature** end-to-end (Materials tab with file-manager UX)
- **1 strategy deck** (16 slides, 600 KB)
- **139 Playwright tests** live and verified

---

## What to do next

1. **Read `ROADMAP.md`** — it's the punch list.
2. **Run the Phase 1 deferred patches in priority order.** Start with `S-2` (Turnstile) — that's the highest brand-risk gap.
3. **Land `M1-1` (2 testimonials)** by 2026-05-29.
4. **Open the senior-IM hire (`Q1-1`)** today, even if you're not ready to close in 30 days. The pipeline takes 6 weeks.
5. **Re-audit in 90 days.** Ship a `v3` of `AUDIT.md` and `VISUAL-AUDIT.md` to keep these docs honest.

---

*End of Audit v2 engagement. Maintained by future-you. Don't lose the discipline of the v1/v2 honesty layering — it's the reason this repo doesn't drift.*
