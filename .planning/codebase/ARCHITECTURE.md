<!-- refreshed: 2026-05-04 -->
# Architecture

**Analysis Date:** 2026-05-04

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser / Client                            │
│  index.html  book.html  admin.html  portal.html  questionnaire.html │
│  (static HTML, inline JS, /styles.css)                              │
└──────┬──────────────┬───────────────┬──────────────────┬───────────┘
       │ fetch()      │ fetch()       │ adminFetch()     │ fetch()
       ▼              ▼               ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Vercel Serverless API  (api/*.js, ESM)                 │
│                                                                     │
│  Public endpoints         Admin endpoints      Portal endpoints     │
│  /api/book                /api/admin           /api/portal-data     │
│  /api/availability        /api/admin-update    /api/portal-profile  │
│  /api/questionnaire       /api/admin-delete    /api/portal-billing  │
│  /api/contact             /api/admin-agents    /api/portal-tickets  │
│  /api/free-roadmap        /api/admin-tickets   /api/portal-track    │
│  /api/get-map             /api/admin-materials /api/portal-onboard  │
│  /api/get-roadmap         /api/admin-create-*  /api/portal-upload-url│
│  /api/resources           /api/send-followup   /api/portal-approve-draft│
│  /api/generate-map        /api/availability(PUT)/api/portal-toggle-agent│
│                                                                     │
│  Cron endpoints           Auth-gated           OAuth flow           │
│  /api/reminders (30min)   via CRON_SECRET      /api/google-oauth-*  │
│  /api/weekly-digest (Mon) via ADMIN_TOKEN                           │
│  /api/agent-logs                                                    │
│  /api/stripe-webhook                                                │
└──────┬────────────────────────┬─────────────────┬───────────────────┘
       │                        │                 │
       ▼                        ▼                 ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────────────┐
│  Supabase    │  │  External APIs  │  │  api/_lib/ shared helpers │
│  (PostgreSQL)│  │                 │  │                          │
│  bookings    │  │  Resend (email) │  │  admin-auth.js           │
│  leads       │  │  Stripe (billing)│  │  audit-log.js            │
│  automation_ │  │  Google Cal/Meet│  │  cron-auth.js            │
│  maps        │  │  Anthropic/Claude│  │  email-design.js         │
│  agents      │  │  Slack Webhooks │  │  google-calendar.js      │
│  agent_runs  │  │  Supabase Store │  │  logger.js               │
│  agent_logs  │  │  (file uploads) │  │  map-token.js            │
│  agent_drafts│  └─────────────────┘  │  notify.js               │
│  support_    │                       │  phase.js                │
│  tickets     │                       │  stripe.js               │
│  support_    │                       │  validate.js             │
│  messages    │                       └──────────────────────────┘
│  portal_     │
│  events      │
│  stripe_     │
│  events      │
│  onboarding_ │
│  documents   │
│  availability│
│  _settings   │
│  admin_audit │
│  _log        │
└──────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Landing page | Marketing, pricing toggle, CTA | `index.html` |
| Booking flow | Calendar UI, slot selection, form submit | `book.html` |
| Questionnaire | Pre-call intake, multi-step form | `questionnaire.html` |
| Admin dashboard | Internal CRM, bookings, tickets, materials | `admin.html` |
| Client portal | Customer-facing phase tracker, agent status, tickets | `portal.html` |
| Book API | Slot availability, booking creation, Google Meet, confirmation emails | `api/book.js` |
| Questionnaire API | AI grading via Claude, automation map generation, owner notification | `api/questionnaire.js` |
| Admin API | Booking/lead fetch, phase computation, portal URL signing | `api/admin.js` |
| Portal data API | HMAC-authenticated customer data fetch, phase computation | `api/portal-data.js` |
| Reminders cron | 24h and 1h pre-call reminder emails (every 30 min) | `api/reminders.js` |
| Weekly digest cron | Per-customer "AI department" activity digest (Mondays 9am UTC) | `api/weekly-digest.js` |
| Stripe webhook | Billing event processing, idempotent event log | `api/stripe-webhook.js` |
| Admin auth lib | Bearer token verification, constant-time compare, CORS allowlist | `api/_lib/admin-auth.js` |
| Cron auth lib | `CRON_SECRET` bearer verification for cron endpoints | `api/_lib/cron-auth.js` |
| Validate lib | Input sanitization, email validation, in-memory rate limiting | `api/_lib/validate.js` |
| Map token lib | HMAC-signed expiring tokens for public-by-link resources | `api/_lib/map-token.js` |
| Phase lib | Single source of truth: Pre-kickoff / Kickoff / Discovery / Build / QA / Live | `api/_lib/phase.js` |
| Notify lib | Slack incoming-webhook fan-out for bookings, tickets, payments | `api/_lib/notify.js` |
| Logger lib | `agent_runs` + `agent_logs` Supabase writes | `api/_lib/logger.js` |
| Audit log lib | Forensic trail for admin mutations (hashed actor + IP) | `api/_lib/audit-log.js` |
| Stripe lib | Fetch-based Stripe REST wrapper; pricing source of truth | `api/_lib/stripe.js` |
| Email design lib | Shared HTML email component builder | `api/_lib/email-design.js` |
| Google Calendar lib | OAuth token refresh, freebusy query, Meet event creation | `api/_lib/google-calendar.js` |

## Pattern Overview

**Overall:** Static HTML + Serverless API (no framework, no build step)

**Key Characteristics:**
- No client-side router — pages are discrete HTML files served by Vercel's CDN
- No shared JavaScript modules between HTML pages — each page is self-contained
- Serverless functions are ESM (`export default async function handler(req, res)`)
- No SDK dependencies — all external services called via native `fetch()` with raw HTTP
- Supabase accessed directly through its REST API, not the Supabase JS client
- Shared logic lives exclusively in `api/_lib/` — imported only by API functions, never by HTML pages

## Layers

**Presentation Layer:**
- Purpose: User interface for all visitor and operator surfaces
- Location: `*.html` files at project root
- Contains: HTML structure, inline `<style>` blocks with `:root` CSS tokens, inline `<script>` blocks with `fetch()` calls
- Depends on: `/styles.css` (global Tailwind v4 output), Google Fonts, `/_vercel/insights/script.js`
- Used by: End users and the Ramped AI operator (admin.html)

**API Layer:**
- Purpose: Business logic, data persistence, external service orchestration
- Location: `api/*.js`
- Contains: Vercel serverless handlers (GET/POST/PUT/DELETE), CORS setup, auth checks, Supabase calls, email dispatch
- Depends on: `api/_lib/` helpers, all external services via env vars
- Used by: HTML pages (via `fetch()`), Vercel Cron scheduler, Stripe webhooks

**Shared Library Layer:**
- Purpose: Reusable utilities shared across API functions
- Location: `api/_lib/*.js`
- Contains: Authentication, validation, email templates, external service wrappers, phase logic
- Depends on: `process.env` for credentials, Node `crypto` module
- Used by: `api/*.js` handlers only

**Database Layer:**
- Purpose: Persistent state
- Location: Supabase (PostgreSQL), schema managed by `db/migrations/*.sql`
- Contains: bookings, leads, automation_maps, agents, agent_runs, agent_logs, agent_drafts, support_tickets, support_messages, portal_events, stripe_events, onboarding_documents, availability_settings, admin_audit_log
- Depends on: Supabase cloud service
- Used by: All API functions via `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`

## Data Flow

### Booking Flow (primary conversion path)

1. Visitor lands on `book.html`, JS calls `GET /api/availability` to fetch schedule settings
2. `book.html` JS calls `GET /api/book?date=YYYY-MM-DD` to get booked slots for a selected date (`api/book.js` — queries `bookings` table + Google Calendar freebusy)
3. Visitor selects slot, fills form, submits → `POST /api/book` with name/email/company/datetime/tier/timezone
4. `api/book.js` validates input, creates booking row in Supabase `bookings`, creates Google Calendar event with Meet link
5. `api/book.js` sends confirmation email to guest and owner via Resend, fires Slack notification via `api/_lib/notify.js`
6. `api/book.js` returns booking ID + signed map token; `book.html` redirects to `/questionnaire?booking=UUID`
7. Post-booking questionnaire at `questionnaire.html` calls `POST /api/questionnaire`
8. `api/questionnaire.js` calls Claude (`claude-sonnet-4-5`) to grade prospect (A/B/C/D) and generate automation roadmap
9. Roadmap stored in `automation_maps` table; owner receives email with grade + roadmap; prospect receives email with map link (HMAC-signed URL)

### Cron: Reminder Emails

1. Vercel Cron fires `GET /api/reminders` every 30 minutes
2. `api/reminders.js` verifies `CRON_SECRET` Bearer token via `api/_lib/cron-auth.js`
3. Queries `bookings` for slots within 24h window (`reminded_24h_at IS NULL`) and 1h window (`reminded_1h_at IS NULL`)
4. Sends reminder email via Resend, then sets `reminded_24h_at` / `reminded_1h_at` timestamp on booking (idempotency guard)

### Cron: Weekly Digest

1. Vercel Cron fires `GET /api/weekly-digest` every Monday at 9am UTC
2. `api/weekly-digest.js` verifies `CRON_SECRET`, queries `agent_runs` from past 7 days per active customer
3. Computes `hours_saved` estimate, sends personalized HTML email via Resend to each customer

### Admin Flow

1. `admin.html` prompts for ADMIN_TOKEN, stores in `sessionStorage`
2. All admin requests use `adminFetch()` — a wrapper that injects `Authorization: Bearer <token>` header
3. `GET /api/admin` returns bookings + leads + automation maps; each booking enriched with computed phase (via `api/_lib/phase.js`) and a signed portal URL
4. Admin mutations: `/api/admin-update`, `/api/admin-delete`, `/api/admin-create-invoice`, `/api/admin-create-subscription`, `/api/send-followup`
5. Destructive mutations call `api/_lib/audit-log.js` — writes hashed actor + IP to `admin_audit_log`

### Client Portal Flow

1. Customer receives portal link: `/portal?id=UUID&exp=<unix>&t=<hmac>`
2. `portal.html` extracts token params and calls `GET /api/portal-data?id=UUID&exp=...&t=...`
3. `api/portal-data.js` verifies HMAC token via `api/_lib/map-token.js`, fetches booking + automation map, computes phase via `api/_lib/phase.js`
4. Portal displays 5-phase timeline (Pre-kickoff → Kickoff → Discovery → Build → QA → Live), agent cards, support tickets
5. Customer activity beaconed to `POST /api/portal-track` → `portal_events` table, bumps `bookings.portal_last_seen_at`

### Stripe Billing Flow

1. Admin creates Stripe subscription via `POST /api/admin-create-subscription` or invoice via `/api/admin-create-invoice`
2. Stripe fires webhooks to `POST /api/stripe-webhook`
3. `api/stripe-webhook.js` verifies Stripe HMAC signature, checks `stripe_events` table for idempotent replay, processes event
4. Booking row updated with payment status, Slack notification fired via `api/_lib/notify.js`

**State Management:**
- All persistent state lives in Supabase PostgreSQL
- No client-side state beyond sessionStorage (admin token) and URL params (portal token)
- In-memory rate limiting map in `api/_lib/validate.js` — resets when serverless container cold-starts

## Key Abstractions

**HMAC Map Token:**
- Purpose: Expiring signed links for public customer-facing resources (automation map, portal, roadmap) without exposing bare UUIDs
- Examples: `api/_lib/map-token.js`, used by `api/book.js`, `api/questionnaire.js`, `api/portal-data.js`, `api/get-roadmap.js`, `api/reminders.js`
- Pattern: `signMapToken(id, ttlSeconds)` → `{ exp, t }` embedded in URL; `verifyMapToken(id, exp, t)` at the receiving endpoint

**Phase Computation:**
- Purpose: Single source of truth for "where is this customer in the 30-day engagement?"
- Examples: `api/_lib/phase.js`, called by `api/admin.js` and `api/portal-data.js`
- Pattern: `computePhase(kickoffISO)` → `{ phase, dayOfThirty, eyebrow, step }` — ensures admin and portal always agree

**Admin Auth Guard:**
- Purpose: Consistent bearer-token auth and CORS enforcement on all admin endpoints
- Examples: `api/_lib/admin-auth.js`, imported by every `api/admin-*.js` file
- Pattern: `setAdminCors(req, res, methods)` + `if (!isAuthorized(req)) return res.status(401)`

**Email Component System:**
- Purpose: Consistent HTML email layout without a template engine
- Examples: `api/_lib/email-design.js`, used by `api/book.js`, `api/questionnaire.js`, `api/reminders.js`, `api/weekly-digest.js`
- Pattern: `wrapEmail(emailHero(...) + emailBody(...) + emailCtaCard(...) + emailSignoff(...))`

## Entry Points

**`index.html`:**
- Location: `index.html`
- Triggers: Direct browser navigation, organic search, marketing links
- Responsibilities: Marketing landing, pricing toggle, CTA to `/book`

**`book.html`:**
- Location: `book.html`
- Triggers: CTA clicks from `index.html`, direct navigation
- Responsibilities: Calendar date/slot picker, booking form submission, post-booking questionnaire prompt

**`admin.html`:**
- Location: `admin.html`, served at `/admin` via `vercel.json` rewrite
- Triggers: Operator direct access
- Responsibilities: Internal CRM — bookings list, lead list, materials library, tickets inbox, agent management, availability config

**`portal.html`:**
- Location: `portal.html`, served at `/portal` via `vercel.json` rewrite
- Triggers: HMAC-signed link emailed to customer
- Responsibilities: Customer-facing engagement tracker — phase timeline, agent status, support tickets, billing info, onboarding docs

**Vercel Cron:**
- Location: `vercel.json` `crons` array
- Triggers: `*/30 * * * *` for reminders; `0 9 * * 1` for weekly digest
- Responsibilities: Automated email sending without human trigger

## Architectural Constraints

- **No build step:** No bundler, no transpilation, no `node_modules` at runtime. All `api/*.js` use native Node ESM. `styles.css` is a committed Tailwind v4 output — treat as a build artifact, never hand-edit.
- **No shared JS between HTML pages:** Each HTML page is a standalone document. Common patterns (mobile nav, pricing toggle) are copy-pasted, not imported.
- **Global state:** `api/_lib/validate.js` uses a module-level `buckets` Map for rate limiting — this resets on cold start. `api/_lib/google-calendar.js` caches the OAuth access token in module scope.
- **Circular imports:** None detected. `api/_lib/` has no cross-dependencies; it is consumed only by `api/*.js`.
- **CSS tokens duplicated per page:** Each HTML file declares its own `<style>:root{ ... }</style>` block. Adding/changing a token requires editing ~12+ files. No build-time CSS variables injection.
- **Pricing in five places:** `index.html` (JS toggle), `book.html` (`tierLabels`), `comparison.html` (static), `one-pager.html` (static), `pricing-onepager.html` (static). Always update all five together.
- **No Supabase JS SDK:** All database calls are raw `fetch()` against the Supabase REST API (`/rest/v1/...`) using `SUPABASE_SERVICE_KEY` (service role, bypasses RLS).

## Anti-Patterns

### Query-string auth tokens
**What happens:** Historical code passed admin tokens as `?token=` URL params.
**Why it's wrong:** Tokens in URLs leak via Vercel access logs, browser history, Referer headers, and screenshots.
**Do this instead:** Always use `Authorization: Bearer <token>` header. The query-string fallback was removed in audit H2-5. `api/_lib/admin-auth.js` now only reads the `Authorization` header.

### Public-by-UUID resources
**What happens:** `api/get-map.js` and `api/get-roadmap.js` return data for any valid UUID.
**Why it's wrong:** Anyone who discovers a UUID has full read access; no expiry, no revocation.
**Do this instead:** Use HMAC-signed expiring tokens via `api/_lib/map-token.js` — pattern already in use on all new endpoints. Tracked as audit item C1.

### Non-idempotent cron mutations
**What happens:** Without idempotency guards, `api/reminders.js` could send duplicate reminders if two cron windows overlap.
**Why it's wrong:** Customers receive the same email twice; hard to debug.
**Do this instead:** The current implementation sets `reminded_24h_at` / `reminded_1h_at` timestamps and filters with `IS NULL` — this is the correct pattern for all cron mutations.

## Error Handling

**Strategy:** Each handler returns structured JSON error responses with HTTP status codes. Failures in non-critical side effects (Slack notify, audit log, email) are best-effort — logged with `console.warn` and never thrown to the caller.

**Patterns:**
- Input validation errors → `400 { error: "..." }`
- Auth failures → `401 { error: "Unauthorized" }`
- Rate limit exceeded → `429 { error: "Too many requests." }`
- Supabase unavailable → `503 { error: "Not configured" }` (when env vars missing)
- Stripe signature mismatch → `400 { error: "Bad signature" }`
- Idempotent replay (duplicate Stripe event) → `200 { ok: true, skipped: true }`

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` / `console.warn` throughout API functions — visible in Vercel function logs. Structured agent execution logging via `api/_lib/logger.js` → `agent_runs` + `agent_logs` tables.

**Validation:** All public POST endpoints call `checkRateLimit()` from `api/_lib/validate.js`. User-supplied strings HTML-escaped with `esc()` before inclusion in emails or HTML responses.

**Authentication:**
- Admin endpoints: Bearer `ADMIN_TOKEN` via `api/_lib/admin-auth.js`
- Portal/customer endpoints: HMAC-signed expiring URL token via `api/_lib/map-token.js`
- Cron endpoints: Bearer `CRON_SECRET` via `api/_lib/cron-auth.js`
- Stripe webhooks: HMAC-SHA256 signature via `api/_lib/stripe.js:verifyStripeSignature()`
- Google Calendar: OAuth2 refresh token flow in `api/_lib/google-calendar.js` (access token cached in module scope)

---

*Architecture analysis: 2026-05-04*
