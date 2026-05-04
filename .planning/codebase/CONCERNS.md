# Codebase Concerns

**Analysis Date:** 2026-05-04
**Source:** Full repo static analysis + AUDIT.md v2 (2026-04-29)
**Open audit issues:** 31 (5 Critical · 8 High · 12 Medium · 6 Low)

---

## Critical Security Issues

### C2-2 · Admin token stored in localStorage + unsafe-inline CSP

**Issue:** `admin.html` writes the admin token to `localStorage` (`localStorage.setItem('adminToken', token)` at line ~1399) and reads it back at line ~1339/1358. Any XSS on the same origin can read `localStorage` and exfiltrate the token. The CSP (`vercel.json:135`) allows `script-src 'unsafe-inline'`, meaning inline-script XSS is not blocked.
**Files:** `admin.html:1339,1358,1399`; `vercel.json:135`
**Impact:** Full admin compromise. Token grants read on every booking, delete on any booking, Stripe invoice creation.
**Fix approach:** Replace `localStorage` with `sessionStorage`; only persist the token *after* server validation (not before); migrate CSP to nonce-based to remove `'unsafe-inline'`.

### C2-5 · OAuth `state` parameter reuses ADMIN_TOKEN (plaintext in URL + non-timing-safe compare)

**Issue:** `api/google-oauth-start.js:24,38` puts `state: token` in the OAuth redirect URL, sending the raw `ADMIN_TOKEN` to Google, the browser history, Vercel access logs, and Referer headers. The callback (`api/google-oauth-callback.js:29`) then does `state !== ADMIN_TOKEN` — a non-timing-safe string compare.
**Files:** `api/google-oauth-start.js:24,38`; `api/google-oauth-callback.js:29`
**Impact:** Admin token leakage into Google logs, browser history, and Vercel access logs. Timing oracle (low-severity but trivially fixable).
**Fix approach:** Replace `state=ADMIN_TOKEN` with an HMAC-signed ephemeral state bound to a short TTL (`exp + nonce + HMAC`). Require Bearer auth for the OAuth start endpoint rather than a query-string token. Use `isAuthorized(req)` from `_lib/admin-auth.js`.

### C2-4 · Email-bombing via public POST endpoints (no CAPTCHA)

**Issue:** `/api/contact`, `/api/book`, and `/api/questionnaire` accept attacker-supplied email addresses and trigger Resend emails to them with no bot protection. The in-memory rate limiter (5/min/IP) is bypassed via IP rotation or multiple Vercel containers.
**Files:** `api/contact.js:42`; `api/book.js:73`; `api/questionnaire.js:195`
**Impact:** Email bombing victims, burning Resend sender reputation, draining Anthropic API budget via fake questionnaire submissions (~$0.05–0.20/each).
**Fix approach:** Add Cloudflare Turnstile (free, invisible by default). Gate all three endpoints on a verified Turnstile token before writing to Supabase or calling Claude.

---

## High Security Issues

### H2-1 · Account email takeover via `/api/portal-profile`

**Issue:** `api/portal-profile.js:112-117` applies an email change immediately (`patch.email = body.email.trim()`) without requiring the new address to confirm ownership. Anyone with a portal URL (which customers receive by email) can immediately redirect all future system emails to an attacker-controlled address.
**Files:** `api/portal-profile.js:106-118`
**Impact:** Attacker who phishes one portal link gains persistent access to billing, weekly digests, ticket replies, and future portal link refreshes sent to the new address.
**Fix approach:** Implement email-change confirmation flow: store pending change, send confirmation link to the NEW address, only apply change upon click. Also add a security notice to the OLD address as early warning (security notice already exists; confirmation gating does not).

### H2-4 · Questionnaire still has email-only fallback (LLM abuse vector)

**Issue:** `api/questionnaire.js:262-268` still accepts `{ email: "...", ... }` with no `booking_id` and will trigger a full Claude call + Resend email to any submitted address. The `console.warn` logs but does not block.
**Files:** `api/questionnaire.js:262-268`
**Impact:** Unlimited LLM cost ($0.05–0.20 per call) and email spam to arbitrary addresses.
**Fix approach:** Remove the email-only fallback entirely. Return `400` if `booking_id` is missing. This was prescribed in v1 audit (C2) but the fallback remains active.

### H2-3 · `agent_runs` schema collision between migration 001 and 004

**Issue:** Migration `001_agent_logging.sql` creates `agent_runs` with columns `(client_id, agent_type, status, input_summary, error_message, ...)`. Migration `004_stripe_onboarding_agents.sql:62` also calls `CREATE TABLE IF NOT EXISTS agent_runs` with a completely different schema `(agent_id, booking_id, action, outcome, hours_saved, ...)`. Because of `IF NOT EXISTS`, migration 004's schema is silently skipped on any database that ran 001 first.
**Files:** `db/migrations/001_agent_logging.sql`; `db/migrations/004_stripe_onboarding_agents.sql:62`
**Impact:** The portal activity feed, weekly digest, and agent admin views all query 004-schema columns that don't exist, returning empty arrays silently. These features are non-functional in production. Migration 006 (`db/migrations/006_fix_agent_runs_schema.sql`) was written to address this — verify it has been applied.
**Fix approach:** Run `db/migrations/006_fix_agent_runs_schema.sql` which renames the 001-shape table to `agent_runs_legacy` and creates the 004-shape table fresh. Also retire or retarget `api/_lib/logger.js` which still writes old-schema columns.

### H2-8 · In-memory rate limiter bypassed at horizontal scale

**Issue:** `api/_lib/validate.js:66-80` uses `const buckets = new Map()` which lives inside a single serverless container. Vercel boots additional containers under load — each has its own empty map. Effective cap under load: 5 × (number of containers) × (number of IPs).
**Files:** `api/_lib/validate.js:66-80`
**Impact:** Rate limiting is ineffective against any sustained attack or even organic load spikes. Combined with C2-4 email-bombing, the cap is not a real control.
**Fix approach:** Replace with Vercel KV (or Upstash Redis) distributed rate limiter. Use raw fetch against the KV REST API — no build step required. Existing callers must be made async.

### H2-7 · No RLS on portal/agent/Stripe tables

**Issue:** `db/migrations/003_portal.sql` and `004_stripe_onboarding_agents.sql` create `portal_events`, `support_tickets`, `support_messages`, `stripe_events`, `onboarding_documents`, `agents`, `agent_runs`, `agent_drafts` without enabling Row Level Security. Only `001_agent_logging.sql` enabled RLS on its tables. Migration 007 was written to fix this — verify it has been applied.
**Files:** `db/migrations/003_portal.sql`; `db/migrations/004_stripe_onboarding_agents.sql`
**Impact:** If `SUPABASE_ANON_KEY` ever appears in client-side code (a common future mistake for a startup adding widgets), the `anon` role can read all customer tickets, agent activity, and Stripe events.
**Fix approach:** Apply `db/migrations/007_rls_hardening.sql` which enables RLS + service_role policies on all affected tables.

---

## Medium Security Issues

### M2-1 · `getClientIp` trusts X-Forwarded-For (rate-limit bypass)

**Issue:** `api/_lib/validate.js:82-86` reads the first entry from `X-Forwarded-For`, which is client-controlled. An attacker can rotate `X-Forwarded-For` values to bypass IP-based rate limiting.
**Files:** `api/_lib/validate.js:82-86`
**Impact:** Rate limiting is spoofable without proxy rotation.
**Fix approach:** On Vercel, use `x-real-ip` (Vercel-set, last hop) as the canonical IP for rate-limit keying. Fall back to `remoteAddress` only. Never trust `X-Forwarded-For` as the primary key.

### M2-2 · `IP_HASH_SALT` falls back to a public default

**Issue:** `api/portal-track.js:18`: `const IP_SALT = process.env.IP_HASH_SALT || 'ramped-default-salt-rotate-me'`. If the env var is not set, IP hashes are computed with a known, public salt — defeating the privacy promise of hashing.
**Files:** `api/portal-track.js:18`
**Impact:** IP addresses can be reverse-looked-up from hashes if an attacker has a list of candidate IPs.
**Fix approach:** Hard-fail: `if (!process.env.IP_HASH_SALT) ip_hash = null`. Log a warning. Never fall back to a known string.

### M2-5 · `confirmDialog` injects `msg` as `innerHTML`

**Issue:** `admin.html:1304` does `bd.querySelector('.cdialog-msg').innerHTML = msg`. Any caller that passes user-controlled or Supabase-returned string content here has an XSS sink.
**Files:** `admin.html:1304`
**Impact:** Stored XSS in admin UI if any data path passes user content through `confirmDialog`.
**Fix approach:** Default `confirmDialog(plainMsg)` to use `textContent`; add a separate `confirmDialogHtml(htmlMsg)` for the rare cases where HTML is intentional.

### M2-7 · Upload MIME allowlist accepts `text/html`

**Issue:** `api/portal-upload-url.js:18`: `ALLOWED_MIME = /^(... |text\/.+)$/i` matches `text/html`. A customer can upload an HTML file to Supabase Storage. If the storage bucket serves files with their declared MIME type, an admin preview path could execute it.
**Files:** `api/portal-upload-url.js:18`
**Impact:** XSS in admin preview paths if HTML uploads are served with `Content-Type: text/html`.
**Fix approach:** Tighten regex to `text/(plain|csv)` only. Explicitly reject `text/html`.

### M2-8 · Stripe webhook idempotency race condition

**Issue:** `api/stripe-webhook.js:55-67` uses `recordEventOnce` which returns `true` when the INSERT succeeds AND (incorrectly) also on race conditions where two concurrent handlers both attempt the insert. The `r.ok || r.status === 201` check doesn't distinguish a 409 Conflict (duplicate PK) from a successful insert.
**Files:** `api/stripe-webhook.js:55-67`
**Impact:** Duplicate Stripe event processing possible under concurrent delivery.
**Fix approach:** Check `r.status === 409 || (data?.code === '23505')` for the PK collision case, and return `false` from `recordEventOnce` in that scenario.

### M2-10 · Resources refresh secret compared with `!==` (non-timing-safe)

**Issue:** `api/resources-refresh.js:124`: `if (!secret || provided !== secret)` — uses standard string equality, not constant-time comparison.
**Files:** `api/resources-refresh.js:124`
**Impact:** Timing oracle on the CRON_SECRET. Low practical exploit risk given Vercel's CDN jitter, but trivially fixable.
**Fix approach:** Use the same `safeEqual` helper from `_lib/cron-auth.js` or `_lib/admin-auth.js`.

### M2-11 · Timezone not validated against IANA set

**Issue:** `api/availability.js:78` accepts `timezone` as a free-form string. Only a regex `/^[A-Za-z_]+\/[A-Za-z_/]+$/` is applied (also in `api/portal-profile.js:100`). Invalid timezone values are passed to `Intl.DateTimeFormat` which silently falls back or throws.
**Files:** `api/availability.js:78`; `api/portal-profile.js:100`
**Impact:** Malformed timezones could cause booking time calculations to silently error or use wrong times.
**Fix approach:** Validate against `Intl.supportedValuesOf('timeZone')` and reject if not in the list.

### M2-12 · CSP allows `'unsafe-inline'` for `script-src`

**Issue:** `vercel.json:135` CSP: `script-src 'self' 'unsafe-inline' ...`. This allows any injected inline script to execute (amplifying XSS sinks).
**Files:** `vercel.json:135`
**Impact:** Eliminates CSP as a meaningful XSS defense.
**Fix approach:** Migrate to nonce-based CSP. Per-request nonce in the `Content-Security-Policy` header + `<script nonce="...">` on every inline block. This is a large change requiring coordination with the build pipeline (audit M1).

---

## Tech Debt

### No build step — `styles.css` is a frozen Tailwind artifact

**Issue:** The repo has no `package.json`, no Tailwind config, and no build pipeline. `styles.css` is a committed, pre-compiled, minified single-line Tailwind v4 output. Adding any utility class requires hand-editing the minified blob or a developer rebuilding Tailwind locally and committing.
**Files:** `styles.css`; all HTML pages
**Impact:** Cannot safely extend the design system. New utilities added ad-hoc by hand-editing compiled output will be overwritten if Tailwind is ever rebuilt. Design drift is guaranteed.
**Fix approach:** Audit M1 — add `package.json`, `tailwind.config.js`, `npm run build` script. Move all per-page `:root` token blocks into a single `tokens.css`. Coordinate with CI/build step.

### Design tokens duplicated inline across 18+ pages

**Issue:** Every HTML page declares its own `:root { --ink, --paper, --line, ... }` block. Tokens have already drifted:
- `--paper`: `#FAFAF7` (most pages) vs `#FAFAFA` on `about.html`
- `--line`: `#E6E4DC` (most) vs `#E5E8EF` on two pages
- `--surface`: `#F5F5F3` vs `#F4F5F7` vs `#F7F8FA`
**Files:** All `.html` pages at root
**Impact:** Visual inconsistency. Every design update requires editing 12+ files. Drift compounds over time.
**Fix approach:** Part of audit M1 (build pipeline). Consolidate tokens into a shared CSS file.

### Pricing defined in four separate places

**Issue:** Pricing appears independently in `index.html` (JS toggle), `book.html` (`tierLabels` map), `comparison.html` (static text), `one-pager.html` (static text), and `pricing-onepager.html` (static text). A price update requires synchronized edits to all locations.
**Files:** `index.html`; `book.html`; `comparison.html`; `one-pager.html`; `pricing-onepager.html`
**Impact:** Pricing inconsistency is a conversion killer (noted in v1 audit: annual-default on homepage shows `$2,083/mo`; clicking through to `/book` shows `$2,500/mo` from `tierLabels`).
**Fix approach:** Part of audit M1 (build pipeline). Shared constants module. Short-term: verify all 5 locations after every pricing change using `grep -n "2,083\|2,500\|4,167\|5,000" *.html`.

### No server-side rate limiting for Stripe product/price creation

**Issue:** `api/_lib/stripe.js:185-196` creates a new Stripe `Product` and `Price` on every monthly subscription creation. Idempotency keys are used (`prod_{tier}_{billing}`, `price_{tier}_{billing}_{amount}`), but these are not booking-scoped — they are shared across all bookings of the same tier/billing. If Stripe ever invalidates a cached product/price, all new subscriptions fail.
**Files:** `api/_lib/stripe.js:185-212`
**Impact:** Fragile Stripe integration. Comment in code acknowledges: "Audit follow-up: cache these."
**Fix approach:** Store `stripe_product_id` and `stripe_price_id` in Vercel env or Supabase config table on first creation; reuse on subsequent calls.

### `billing` parameter destructured in `book.js` but never persisted

**Issue:** `api/book.js:117,125-126` reads and validates the `billing` param but it is not included in the Supabase `INSERT` payload.
**Files:** `api/book.js:117-185`
**Impact:** Billing cadence (monthly/annual) chosen at booking time is lost. The portal billing view and Stripe subscription creation cannot know which billing cycle the customer selected.
**Fix approach:** Add `billing_cadence: billing || null` to the bookings insert payload (line ~178).

### `api/_lib/logger.js` writes legacy `agent_runs` schema

**Issue:** `api/_lib/logger.js:44` inserts into `agent_runs` using the migration-001 column set (`client_id`, `agent_type`, `input_summary`). After migration-006 renames the old table and creates the new schema, this logger will break silently or log to the wrong table.
**Files:** `api/_lib/logger.js:44`
**Impact:** Agent logging is broken or goes to the archived table post-migration.
**Fix approach:** After applying migration-006, either retarget `logger.js` to the new schema (columns: `agent_id`, `booking_id`, `action`, `outcome`, `hours_saved`) or retire it entirely if no current call sites use it.

---

## Fragile Areas

### Cron jobs depend on `CRON_SECRET` being set in Vercel

**Area:** `api/reminders.js` and `api/weekly-digest.js`
**Files:** `api/_lib/cron-auth.js:30`
**Why fragile:** `isCronConfigured()` fails closed — if `CRON_SECRET` is not set in Vercel env, all cron invocations return `401` and no reminders or weekly digests are sent. There is no alert or monitoring for this. A Vercel env reset or mis-deploy would silently disable both crons.
**Safe modification:** Always verify `CRON_SECRET` is set and test manually after any Vercel env change. Vercel cron logs will show `401` if missing.

### Portal token TTL is 90 days — no revocation mechanism

**Area:** `api/portal-data.js`, `api/portal-profile.js`, `api/portal-billing.js`
**Files:** `api/_lib/map-token.js` (TTL: `signMapToken(id, 7776000)` = 90 days)
**Why fragile:** Portal links in customer emails are valid for 90 days with no server-side revocation. If an email is compromised, the attacker has a 90-day window. There is no endpoint to invalidate issued tokens. HMAC tokens are stateless by design.
**Safe modification:** Short-term: accept the tradeoff. Long-term: add a `portal_token_revoked_at` column and check it in `verifyMapToken` wrapper.

### Admin dashboard is a single 1600+ line HTML file

**Area:** `admin.html`
**Files:** `admin.html`
**Why fragile:** All admin JS is inline in one massive file. No module boundaries. One JS error breaks the entire admin UI. `confirmDialog` uses `innerHTML` (M2-5 above). Multiple `onclick="fn('${id}')"` patterns (M2-4 above).
**Safe modification:** Do not add new admin features via inline script interpolation. Use `data-id` attributes + `addEventListener` for new interactive elements.

### `api/questionnaire.js` is a long, multi-concern file

**Area:** LLM call + booking lookup + email send + Supabase write
**Files:** `api/questionnaire.js`
**Why fragile:** Questionnaire handler calls Anthropic, sends two Resend emails, and mutates the bookings table in a single flow. A timeout or error in any step leaves the booking in an inconsistent state. No retry logic.
**Safe modification:** Any change to the Claude prompt must be tested against actual booking data. The user fields are interpolated into the system prompt (L2-3) — a prompt injection concern when modifying the prompt structure.

---

## Missing Critical Features

### Stripe payments not end-to-end wired for self-serve

**Issue:** The Stripe infrastructure (`api/_lib/stripe.js`, `api/admin-create-invoice.js`, `api/admin-create-subscription.js`, `api/stripe-webhook.js`) is built and functional when invoked manually by an admin. However, the public `/book` flow does not create a Stripe customer or send an invoice automatically. Billing is admin-initiated post-booking.
**Blocks:** Clients cannot pay without admin intervention. No automated payment-gating for portal access.
**Files:** `api/book.js` (no Stripe calls); `api/admin-create-invoice.js` (manual trigger only)

### No CAPTCHA/bot protection on any public form

**Issue:** `/api/contact`, `/api/book`, `/api/questionnaire` have no bot protection. The audit recommends Cloudflare Turnstile.
**Blocks:** Protects sender reputation and Anthropic budget. Required before meaningful scale.

### No email confirmation for new bookings

**Issue:** A prospect can book with any email address. No ownership verification before the booking is persisted and calendar invite sent. The `billing` param also is not persisted (see tech debt above).
**Blocks:** Spam bookings, incorrect calendar invites, email bombing via fake bookings.

### `portal-profile-confirm-email.js` endpoint does not exist

**Issue:** The H2-1 fix plan (`AUDIT.md:296`) calls for a `api/portal-profile-confirm-email.js` endpoint to complete email-change confirmation. The endpoint is referenced in the fix design but has not been created. Currently `api/portal-profile.js` applies email changes immediately.
**Files:** `api/portal-profile.js:114` (applies immediately)

---

## Test Coverage Gaps

### No tests for security-critical auth helpers

**What's not tested:** `api/_lib/admin-auth.js` (timing-safe compare), `api/_lib/map-token.js` (HMAC verify/sign), `api/_lib/cron-auth.js` (cron bearer check)
**Files:** `api/_lib/admin-auth.js`; `api/_lib/map-token.js`; `api/_lib/cron-auth.js`
**Risk:** A refactor could break constant-time comparison without detection.
**Priority:** High

### Admin endpoints not covered by CI

**What's not tested:** The GitHub Actions workflow (`verify.yml`) intentionally skips admin endpoint tests: "ADMIN_TOKEN intentionally unset — admin-endpoint tests skip when missing."
**Files:** `.github/workflows/verify.yml:58-59`
**Risk:** Regressions in admin-delete, admin-update, admin-create-invoice, admin-agents go undetected until production.
**Priority:** Medium

### No tests for Stripe webhook handler

**What's not tested:** `api/stripe-webhook.js` — signature verification, event routing, idempotency, booking status updates.
**Files:** `api/stripe-webhook.js`
**Risk:** Stripe event handling regressions (double-payment, missed cancellation events) go undetected.
**Priority:** High

### No integration test for the full booking → questionnaire → email flow

**What's not tested:** End-to-end: `api/book.js` → `api/questionnaire.js` → Resend email + roadmap generation. The e2e script (`scripts/e2e-test.sh`) does not appear to test this path.
**Files:** `api/book.js`; `api/questionnaire.js`
**Risk:** A change to either file could break the core revenue flow without CI catching it.
**Priority:** High

---

## Performance Bottlenecks

### `client-demo.html` is 136KB uncompressed

**Problem:** Large page weight for a static demo.
**Files:** `client-demo.html`
**Cause:** All per-industry demos are inlined.
**Improvement path:** Lazy-load per-industry demo content on click.

### Google Fonts loaded synchronously on every page

**Problem:** Round-trip to `fonts.googleapis.com` blocks first paint on cold loads.
**Files:** All HTML pages
**Improvement path:** Self-host Inter and JetBrains Mono with `font-display: swap`.

---

## Dependencies at Risk

### No `package.json` — Node version unpinned

**Risk:** Vercel may upgrade its Node.js runtime. No `.nvmrc` or `engines` field pins the version. API code uses native `fetch` (Node 18+) and `AbortSignal.timeout` (Node 17.3+).
**Impact:** A Vercel runtime bump to a major version could silently break API endpoints.
**Migration plan:** Add `package.json` with `"engines": { "node": ">=20" }` as part of the M1 build pipeline work.

### Tailwind v4 `styles.css` with no config

**Risk:** The committed `styles.css` is a frozen Tailwind v4 build output. If Tailwind v4 introduces breaking changes to its utility names, the frozen file remains on the old semantics while any documentation or tooling refers to the new ones.
**Impact:** Developer confusion; no path to add new utilities without a local Tailwind build.
**Migration plan:** Add Tailwind config + build script as part of M1.

---

## Low-Priority Issues

| # | Issue | File | Fix |
|---|---|---|---|
| L2-1 | OAuth callback renders refresh token as unobscured plaintext | `api/google-oauth-callback.js:82` | Add auto-copy + show/hide toggle. Token currently renders unmasked in the browser. |
| L2-3 | User questionnaire fields interpolated into Claude system prompt | `api/questionnaire.js:56-116` | Pass user data as a `user`-role message; keep system prompt rule-only. Defense-in-depth. |
| L2-5 | `permanent: false` on `/dashboard` and `/questionnaire-preview` redirects | `vercel.json:27,33` | Set `permanent: true`; delete orphaned source files. |
| L2-6 | `roadmap.html` does not load Inter font | `roadmap.html` | Add the Inter `<link>` block matching other pages. |
| L3 | `404.html` doesn't link to `/book` or `/comparison` | `404.html` | Add secondary CTA: "Book a discovery call →". |
| H1 | `hello@30dayramp.com` on `map-result.html:783` (should be `jon@`) | `map-result.html:783` | Replace with `jon@30dayramp.com`. |
| sitemap | Sitemap missing `/about`, `/resources`, `/roadmap`, `/questionnaire`, `/privacy`, `/one-pager` | `sitemap.xml` | Add all canonical URLs; auto-stamp `lastmod` from CI. |

---

## Audit Item Status (v2 — 2026-04-29)

Items marked as **fixed in AUDIT.md** and confirmed present in source:
- C1 (IDOR on get-map/get-roadmap) — FIXED: HMAC-signed tokens in `api/_lib/map-token.js`
- C2-1 (cron no auth) — FIXED: `api/_lib/cron-auth.js` + gated in `reminders.js` and `weekly-digest.js`
- C2-3 (reflected XSS on OAuth callback) — FIXED: `escHtml()` in `api/google-oauth-callback.js:16`
- H2-5 (`?token=` query-string fallback) — FIXED: removed from `api/_lib/admin-auth.js`
- H2-6 (send-followup unsigned URL) — FIXED: `signMapToken` used in `api/send-followup.js:83-87`
- H2-2 (weekly-digest UA bypass) — FIXED: `isCronAuthorized` in `api/weekly-digest.js:41`
- H3 (reminders idempotency) — FIXED: `reminded_24h_at`/`reminded_1h_at` in migration 002
- H4 (send-followup uses ADMIN_PASSWORD) — FIXED: now imports `isAuthorized` from admin-auth
- M2-9 (resources wildcard CORS) — FIXED: allowlist in `api/resources.js`

Items **still open** requiring owner sign-off:
- C2-2 (localStorage → sessionStorage, nonce CSP) — behavior-changing UX
- C2-4 (Turnstile bot protection) — requires DNS + env var setup
- C2-5 (OAuth state = ADMIN_TOKEN) — requires OAuth re-wiring
- H2-1 (email-change confirmation) — requires new endpoint + new email
- H2-4 (questionnaire booking_id required) — may break legacy email flows
- H2-8 (distributed rate limiter) — requires KV provisioning

---

*Concerns audit: 2026-05-04. Sources: static analysis + AUDIT.md v2 (2026-04-29). Patch status verified against live source files.*
