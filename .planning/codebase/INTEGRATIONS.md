# External Integrations

**Analysis Date:** 2026-05-04

## APIs & External Services

**AI / LLM:**
- Anthropic Claude — prospect grading and automation roadmap generation
  - SDK/Client: native `fetch()` to `https://api.anthropic.com/v1/messages`
  - Model: `claude-sonnet-4-5` (hardcoded in `api/questionnaire.js`)
  - Auth env var: `ANTHROPIC_API_KEY`
  - Used by: `api/questionnaire.js` only

**Payments:**
- Stripe — invoicing, subscriptions, webhook processing
  - SDK/Client: custom REST wrapper (no official Node SDK); `api/_lib/stripe.js`
  - Auth env var: `STRIPE_SECRET_KEY` (format: `sk_test_...` or `sk_live_...`)
  - Webhook secret env var: `STRIPE_WEBHOOK_SECRET` (format: `whsec_...`)
  - Webhook endpoint: `POST /api/stripe-webhook` — verifies HMAC-SHA256 signature without SDK
  - Used by: `api/stripe-webhook.js`, `api/admin-create-invoice.js`, `api/admin-create-subscription.js`, `api/_lib/stripe.js`
  - Tier pricing source of truth: `api/_lib/stripe.js` `TIER_PRICES` object

**Email:**
- Resend — all transactional email (booking confirmations, follow-ups, weekly digest, notifications)
  - SDK/Client: native `fetch()` to `https://api.resend.com/emails`
  - Auth env var: `RESEND_API_KEY`
  - From address: `bookings@30dayramp.com`
  - Owner email default: `jon@30dayramp.com` (overridable via `OWNER_EMAIL`)
  - HTML templates: `api/_lib/email-design.js` (shared wrapper components)
  - Used by: `api/book.js`, `api/questionnaire.js`, `api/send-followup.js`, `api/reminders.js`, `api/weekly-digest.js`, `api/contact.js`, `api/free-roadmap.js`

**Calendar:**
- Google Calendar API + Google Meet — booking slot management, meeting creation
  - SDK/Client: native `fetch()` to `https://www.googleapis.com/calendar/v3/` and `https://oauth2.googleapis.com/token`
  - Auth env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
  - Calendar target env var: `GOOGLE_CALENDAR_ID` (default: `primary`)
  - OAuth setup flow: `api/google-oauth-start.js` → `api/google-oauth-callback.js` (prints refresh token for operator to set as env var)
  - OAuth redirect env var: `OAUTH_REDIRECT_HOST`
  - Access token cached in-memory per serverless container lifetime (`api/_lib/google-calendar.js`)
  - Used by: `api/book.js` (freebusy check + Meet event creation), `api/availability.js`

**Notifications (Internal):**
- Slack Incoming Webhooks — admin event alerts (new bookings, ticket creation, payment events, onboarding completions)
  - SDK/Client: native `fetch()` — `api/_lib/notify.js`
  - Auth env var: `SLACK_WEBHOOK_URL` (format: `https://hooks.slack.com/...`)
  - Best-effort: never throws; logs failures. Silently skips if env var absent.
  - Events sent: booking created, ticket created, payment events, onboarding complete

**Analytics:**
- Vercel Web Analytics — page-level analytics
  - Script: `/_vercel/insights/script.js` (Vercel-hosted, deferred)
  - Injected on every customer-facing HTML page; excluded from `/admin` and `/portal`

## Data Storage

**Databases:**
- Supabase PostgreSQL — primary data store for all application data
  - Connection env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
  - Client: raw `fetch()` against Supabase REST API (`/rest/v1/...`) — no Supabase JS SDK
  - Auth: `apikey` + `Authorization: Bearer` headers using service role key
  - Schema managed via `db/migrations/*.sql` (9 migrations, forward-only)

**Key Tables (from migrations):**
- `bookings` — discovery call bookings with `UNIQUE(datetime)` constraint; stores Stripe customer/subscription IDs
- `agent_runs` — AI agent execution tracking (UUID, client_id, agent_type, status, duration)
- `agent_logs` — per-run log entries (level: info/warn/error, metadata JSONB)
- `admin_audit_log` — forensic trail for admin mutations (actor/IP stored hashed, never raw)
- `onboarding_documents` — file upload metadata (storage_path, category, status)
- `material_uploads` — admin materials file metadata

**File Storage:**
- Supabase Storage — file uploads (two buckets)
  - Bucket 1: `onboarding` (default) — customer onboarding documents, env var: `SUPABASE_ONBOARDING_BUCKET`
  - Bucket 2: `materials` (default) — admin-uploaded materials/decks, env var: `MATERIALS_BUCKET`
  - Upload flow: server generates signed upload URL, client PUTs directly to Supabase Storage
  - Used by: `api/portal-upload-url.js`, `api/admin-materials.js`

**Caching:**
- None — no Redis, Memcached, or external cache
- In-memory rate limiting via `Map` in `api/_lib/validate.js` (resets per serverless container cold start)
- Google OAuth access token cached in-memory per container (`api/_lib/google-calendar.js`)

## Authentication & Identity

**Admin Auth:**
- Bearer token — constant-time HMAC comparison
  - Implementation: `api/_lib/admin-auth.js` (`isAuthorized()`, `extractToken()`, `setAdminCors()`)
  - Env var: `ADMIN_TOKEN`
  - All admin endpoints must import and call `isAuthorized()` — no custom bearer parsing
  - Token presented via `Authorization: Bearer <token>` header only (URL query param removed in audit H2-5)

**Cron Auth:**
- Bearer token — Vercel auto-injects `Authorization: Bearer ${CRON_SECRET}` on scheduled calls
  - Implementation: `api/_lib/cron-auth.js` (`isCronAuthorized()`)
  - Env var: `CRON_SECRET` (min 16 chars; generate with `openssl rand -hex 32`)

**Customer Portal Auth:**
- HMAC-signed expiring tokens — time-limited links in emails
  - Implementation: `api/_lib/map-token.js` (`signMapToken()`, `verifyMapToken()`)
  - Env var: `MAP_LINK_SECRET` (min 32 chars hex)
  - URL shape: `/map/{uuid}?exp=<unixSeconds>&t=<base64urlHmac>`
  - Token TTL: 30 days default
  - Used for: roadmap links (`/api/get-map`), portal access links (`/api/get-roadmap`, `/api/portal-*`)

**No Third-Party Identity Provider** — no Auth0, Clerk, Supabase Auth, or similar. Auth is entirely custom bearer tokens.

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, Bugsnag, etc.)
- Errors logged to Vercel function logs via `console.error()`/`console.warn()`

**Logs:**
- `console.log/warn/error` → Vercel function log stream
- Structured agent activity logs stored in Supabase (`agent_runs`, `agent_logs` tables) via `api/_lib/logger.js`
- Admin audit trail in Supabase `admin_audit_log` table (actor and IP stored as SHA-256 hashes with `IP_HASH_SALT`)

## CI/CD & Deployment

**Hosting:**
- Vercel — static site + serverless functions
- Production domain: `https://www.30dayramp.com`
- Preview deployments auto-generated per git branch

**CI Pipeline:**
- None configured (no GitHub Actions, CircleCI, etc.)
- Manual verification: `bash scripts/e2e-test.sh` against preview URL before merging

**Deploy Process:**
- Push to `main` → Vercel auto-deploys
- No build step required for production (static HTML + pre-compiled CSS committed)

## Webhooks & Callbacks

**Incoming Webhooks:**
- `POST /api/stripe-webhook` — receives Stripe payment events; verifies HMAC-SHA256 signature via `api/_lib/stripe.js` `verifyStripeSignature()`; raw body must be read before parsing (Vercel bodyParser disabled via `config` export)

**Outgoing Webhooks:**
- Slack Incoming Webhook — admin event notifications via `SLACK_WEBHOOK_URL`

**OAuth Callbacks:**
- `GET /api/google-oauth-callback` — receives Google OAuth code, exchanges for refresh token, displays result to operator (one-time setup flow)

## Environment Configuration

**Required env vars (production will fail without these):**
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key
- `RESEND_API_KEY` — Resend email sending
- `ADMIN_TOKEN` — admin dashboard auth
- `CRON_SECRET` — cron job auth
- `MAP_LINK_SECRET` — signed portal/roadmap link tokens (32+ hex chars)

**Required for full feature set:**
- `ANTHROPIC_API_KEY` — Claude grading + roadmap (questionnaire degrades gracefully if absent)
- `STRIPE_SECRET_KEY` — payment processing (`sk_test_...` or `sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signature verification (`whsec_...`)
- `GOOGLE_CLIENT_ID` — Google Calendar OAuth
- `GOOGLE_CLIENT_SECRET` — Google Calendar OAuth
- `GOOGLE_REFRESH_TOKEN` — Google Calendar API access
- `GOOGLE_CALENDAR_ID` — calendar to check/write (defaults to `primary`)
- `SLACK_WEBHOOK_URL` — admin Slack notifications (optional, silently skipped if absent)

**Optional / defaulted:**
- `OWNER_EMAIL` — defaults to `jon@30dayramp.com`
- `SITE_URL` — defaults to `https://www.30dayramp.com`
- `OAUTH_REDIRECT_HOST` — used by Google OAuth setup flow
- `MATERIALS_BUCKET` — defaults to `materials`
- `SUPABASE_ONBOARDING_BUCKET` — defaults to `onboarding`
- `IP_HASH_SALT` — defaults to `ramped-default-salt-rotate-me` (MUST be changed in production)

**Secrets location:**
- All secrets stored in Vercel project environment variables (dashboard or Vercel CLI)
- No `.env` file committed — no `.env.example` detected in repo

## CORS Allowlist

All API endpoints restrict cross-origin requests to an explicit allowlist (no wildcard):
- `https://30dayramp.com`
- `https://www.30dayramp.com`
- `https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app`
- `http://localhost:3000`

Defined in: `api/_lib/admin-auth.js` (admin routes) and inline in `api/book.js` (public booking route).

---

*Integration audit: 2026-05-04*
