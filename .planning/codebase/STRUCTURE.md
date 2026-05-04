# Codebase Structure

**Analysis Date:** 2026-05-04

## Directory Layout

```
ramped-repo/
├── index.html              # Marketing landing page (primary entry point)
├── book.html               # Booking flow — calendar + form
├── admin.html              # Internal admin dashboard (noindex)
├── portal.html             # Client-facing engagement portal (token-gated)
├── questionnaire.html      # Pre-call intake form (linked from book.html)
├── questionnaire-preview.html  # Preview/test page for questionnaire
├── about.html              # About page
├── comparison.html         # Feature/pricing comparison
├── client-demo.html        # Demo page (served at /demo)
├── free-roadmap.html       # Free roadmap lead gen page
├── map-result.html         # Automation map result viewer (served at /map/*)
├── one-pager.html          # Sales one-pager
├── pricing-onepager.html   # Pricing-focused one-pager
├── pitch.html              # Pitch deck page
├── heroes.html             # Hero section concepts (internal)
├── logo-concepts.html      # Logo concepts (internal)
├── roadmap.html            # Product/engagement roadmap page
├── resources.html          # Resources library
├── sales.html              # Sales page
├── thanks.html             # Post-booking thank you
├── privacy.html            # Privacy policy
├── dashboard.html          # Redirect stub → /admin (301)
├── 404.html                # Custom 404 (dark theme)
├── styles.css              # Tailwind v4 compiled output — DO NOT hand-edit
├── vercel.json             # Vercel config: functions, crons, rewrites, headers
├── package.json            # Dev dependencies only (Playwright, etc.)
├── playwright.config.js    # E2E test config
├── sitemap.xml             # SEO sitemap
├── robots.txt              # Crawler rules
├── materials.json          # Internal materials manifest (source of truth for admin Materials tab)
├── favicon.svg             # Primary favicon
├── favicon.ico             # Legacy favicon
├── apple-touch-icon.png    # iOS home screen icon
├── apple-touch-icon.svg    # iOS home screen icon (SVG)
├── og-image.png            # OG social share image (1200×630)
├── og-image@2x.png         # OG social share image (2x)
├── api/                    # Vercel serverless functions
│   ├── _lib/               # Shared helpers (not exposed as endpoints)
│   │   ├── admin-auth.js   # Bearer token auth + CORS for admin endpoints
│   │   ├── audit-log.js    # Admin mutation audit trail → admin_audit_log table
│   │   ├── cron-auth.js    # CRON_SECRET bearer verification for cron endpoints
│   │   ├── email-design.js # HTML email component builder
│   │   ├── google-calendar.js  # OAuth token refresh, freebusy, Meet event creation
│   │   ├── logger.js       # agent_runs + agent_logs Supabase writes
│   │   ├── map-token.js    # HMAC-signed expiring URL tokens
│   │   ├── notify.js       # Slack incoming-webhook fan-out
│   │   ├── phase.js        # 30-day engagement phase computation
│   │   ├── stripe.js       # Stripe REST wrapper + pricing source of truth
│   │   └── validate.js     # Input sanitization, email validation, rate limiting
│   ├── admin.js            # GET /api/admin — bookings + leads (admin auth)
│   ├── admin-agents.js     # Agent CRUD (admin auth)
│   ├── admin-create-invoice.js    # Stripe invoice creation (admin auth)
│   ├── admin-create-subscription.js # Stripe subscription (admin auth)
│   ├── admin-delete.js     # Booking deletion (admin auth + audit log)
│   ├── admin-materials.js  # Materials library CRUD + Supabase Storage upload URLs
│   ├── admin-tickets.js    # Support ticket inbox (admin auth)
│   ├── admin-update.js     # Booking field update (admin auth + audit log)
│   ├── agent-logs.js       # Agent run log reader (admin auth)
│   ├── availability.js     # GET (public) / PUT (admin) availability settings
│   ├── book.js             # GET slots / POST booking + Google Meet + emails
│   ├── contact.js          # POST contact form
│   ├── free-roadmap.js     # POST free roadmap lead capture + Claude generation
│   ├── generate-map.js     # POST automation map generation trigger
│   ├── get-map.js          # GET automation map by UUID (legacy, public-by-UUID — see CONCERNS)
│   ├── get-roadmap.js      # GET roadmap by HMAC token
│   ├── google-oauth-callback.js  # OAuth2 callback handler
│   ├── google-oauth-start.js     # OAuth2 authorization redirect
│   ├── portal-approve-draft.js   # Customer approves agent draft
│   ├── portal-billing.js   # Customer billing info
│   ├── portal-data.js      # Primary portal data fetch (HMAC token auth)
│   ├── portal-onboarding.js # Customer onboarding doc submit
│   ├── portal-profile.js   # Customer profile GET/PATCH
│   ├── portal-tickets.js   # Customer support ticket create/list
│   ├── portal-toggle-agent.js # Customer agent enable/disable
│   ├── portal-track.js     # Portal activity beacon → portal_events
│   ├── portal-upload-url.js # Signed Supabase Storage upload URL
│   ├── questionnaire.js    # POST questionnaire → Claude grade + roadmap
│   ├── reminders.js        # Cron: 24h + 1h booking reminders
│   ├── resources-refresh.js # Admin: refresh resources data
│   ├── resources.js        # GET resources list
│   ├── send-followup.js    # Admin: send follow-up email to prospect
│   ├── stripe-webhook.js   # POST Stripe event handler (signature verified)
│   └── weekly-digest.js    # Cron: Monday weekly digest emails
├── db/
│   └── migrations/         # Forward-only SQL migrations for Supabase
│       ├── 001_agent_logging.sql        # agent_runs, agent_logs tables + RLS
│       ├── 002_bookings_constraints.sql  # UNIQUE(datetime), reminder timestamps
│       ├── 003_portal.sql               # portal_events, support_tickets, support_messages
│       ├── 004_stripe_onboarding_agents.sql # Stripe fields, onboarding_documents, agents, agent_drafts
│       ├── 005_profile_prefs.sql        # Customer profile + preferences
│       ├── 006_fix_agent_runs_schema.sql # Schema correction
│       ├── 007_rls_hardening.sql        # RLS policy tightening
│       ├── 008_admin_materials.sql      # admin_materials table
│       └── 010_admin_audit_log.sql      # admin_audit_log table
├── assets/
│   ├── agent-ui.png        # Agent UI screenshot (1x)
│   ├── agent-ui@2x.png     # Agent UI screenshot (2x)
│   ├── email-logo-bars.png # Logo for emails
│   ├── pain-1-fork.svg     # Pain point illustration
│   ├── pain-2-deck.svg     # Pain point illustration
│   ├── pain-3-loop.svg     # Pain point illustration
│   ├── ramped-onepager.pdf # Downloadable PDF one-pager
│   └── team/               # Team member photos
├── scripts/
│   ├── e2e-test.sh         # Smoke test against live/preview URL
│   ├── check-fonts.sh      # Verify font loading on all pages
│   ├── check-tokens.sh     # Verify CSS token consistency across pages
│   └── README.md           # Script usage docs
├── tests/
│   ├── a11y/               # Accessibility tests (Playwright)
│   ├── api/                # API endpoint tests
│   ├── lib/                # Test utilities
│   ├── lighthouse/         # Lighthouse perf tests
│   ├── mobile/             # Mobile viewport tests
│   ├── protected/          # Admin/portal auth tests
│   └── public/             # Public page tests
└── .planning/
    └── codebase/           # GSD codebase maps
```

## Directory Purposes

**Root HTML files (`*.html`):**
- Purpose: All page templates. No server-side rendering — pure static HTML with inline CSS and JS.
- Contains: `<style>` blocks with per-page `:root` CSS custom properties, `<script>` blocks with `fetch()` API calls
- Key files: `index.html` (landing), `book.html` (conversion), `admin.html` (operator CRM), `portal.html` (customer), `questionnaire.html` (pre-call intake)

**`api/` — Serverless functions:**
- Purpose: All backend logic. Each file is a Vercel serverless function exposed at `/api/<filename-without-js>`
- Contains: ESM handler functions (`export default async function handler(req, res)`)
- Key files: `api/book.js`, `api/questionnaire.js`, `api/stripe-webhook.js`, `api/reminders.js`

**`api/_lib/` — Shared API helpers:**
- Purpose: Reusable modules imported across API functions. The underscore prefix prevents Vercel from exposing these as endpoints.
- Contains: Auth, validation, email templates, external service wrappers, business logic
- Key files: `api/_lib/admin-auth.js`, `api/_lib/validate.js`, `api/_lib/phase.js`, `api/_lib/map-token.js`, `api/_lib/stripe.js`

**`db/migrations/`:**
- Purpose: Forward-only SQL migration scripts for the Supabase PostgreSQL database
- Contains: `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE POLICY` statements
- Key files: Applied in numeric order (001 → 010); never edit a committed file — add a new one

**`assets/`:**
- Purpose: Static image and document assets referenced by HTML pages and emails
- Contains: PNG/SVG illustrations, PDF one-pager, team photos
- Generated: No — all committed manually

**`scripts/`:**
- Purpose: Developer utility scripts for QA and verification
- Contains: Bash scripts for smoke testing, font checks, token consistency checks

**`tests/`:**
- Purpose: Playwright-based automated tests
- Contains: Organized by concern (a11y, api, lighthouse, mobile, protected, public)

## Key File Locations

**Entry Points:**
- `index.html`: Marketing landing page, served at `/`
- `book.html`: Booking flow, served at `/book`
- `admin.html`: Operator dashboard, served at `/admin`
- `portal.html`: Customer portal, served at `/portal`
- `questionnaire.html`: Pre-call intake, served at `/questionnaire`

**Configuration:**
- `vercel.json`: Vercel function timeouts, cron schedules, URL rewrites/redirects, security headers, cache-control
- `playwright.config.js`: E2E test configuration
- `package.json`: Dev-only dependencies (Playwright)

**Global Stylesheet:**
- `styles.css`: Compiled Tailwind v4 output. **Never edit by hand.** Rebuild with Tailwind CLI and commit the output.

**Materials Manifest:**
- `materials.json`: Source of truth for `/admin → Materials` tab. Every internal artifact (strategy doc, deck, audit report) must have an entry here.

**Pricing Source of Truth:**
- `api/_lib/stripe.js` (`TIER_PRICES` object): Backend pricing in cents
- `index.html` (JS `TIERS` object): Frontend pricing toggle
- `book.html` (`tierLabels` map): Booking form tier display
- `comparison.html` (static text): Feature comparison table
- `one-pager.html` / `pricing-onepager.html` (static text): Sales docs

**Phase Logic:**
- `api/_lib/phase.js`: The only place where engagement phase is computed. Referenced by `api/admin.js` and `api/portal-data.js`.

**Auth Logic:**
- `api/_lib/admin-auth.js`: Admin bearer token auth + CORS allowlist
- `api/_lib/cron-auth.js`: Cron endpoint auth
- `api/_lib/map-token.js`: Customer-facing HMAC token sign/verify

## Naming Conventions

**HTML files:**
- `kebab-case.html` for multi-word pages (e.g., `free-roadmap.html`, `client-demo.html`, `map-result.html`)
- Single-word pages use the plain name (e.g., `book.html`, `admin.html`, `portal.html`)

**API files:**
- `kebab-case.js` matching the URL path: `api/book.js` → `/api/book`, `api/admin-update.js` → `/api/admin-update`
- Grouped by surface with a prefix: `admin-*.js` for operator endpoints, `portal-*.js` for customer endpoints
- Shared libs prefixed with underscore directory: `api/_lib/`

**Assets:**
- Images: `kebab-case.png` / `kebab-case.svg`; `@2x` suffix for retina variants (e.g., `agent-ui@2x.png`)
- Migrations: `NNN_descriptive-name.sql` with zero-padded 3-digit prefix (e.g., `001_agent_logging.sql`)

**CSS Custom Properties (design tokens):**
- Always defined in a `<style>:root{ ... }</style>` block inline in each HTML file
- Canonical token names: `--ink`, `--ink-2`, `--paper`, `--line`, `--muted`, `--accent`, `--accent-2`, `--good`, `--warn`, `--surface`

## Where to Add New Code

**New customer-facing page:**
- Copy the full `<head>` block from `index.html` (includes all required meta tags, canonical, OG, favicon, Vercel insights, fonts, `styles.css`)
- Add inline `:root` CSS token block matching the canonical token table in `CLAUDE.md`
- Add a mobile nav section copied from `index.html`
- Add URL rewrite entry in `vercel.json` (`rewrites` array)
- Add canonical URL to `sitemap.xml`
- Add entry to `materials.json` if it's an internal document

**New public API endpoint:**
- Create `api/<endpoint-name>.js` with `export default async function handler(req, res)`
- Import `checkRateLimit` and `getClientIp` from `api/_lib/validate.js` and apply rate limiting at the top of the handler
- HTML-escape all user input before including in emails or responses using `esc()` from `api/_lib/validate.js`
- Set CORS headers explicitly (copy pattern from `api/book.js`)

**New admin API endpoint:**
- Create `api/admin-<name>.js`
- Import and call `setAdminCors(req, res, 'METHOD, OPTIONS')` and `isAuthorized(req)` from `api/_lib/admin-auth.js`
- For destructive mutations, call `logAdminAction()` from `api/_lib/audit-log.js` after the mutation

**New portal (customer) API endpoint:**
- Create `api/portal-<name>.js`
- Use `verifyMapToken(id, exp, t)` from `api/_lib/map-token.js` to authenticate the request
- Return only client-safe fields — never expose `grade`, `admin_notes`, or internal metadata

**New cron job:**
- Create `api/<name>.js`
- Import and call `isCronAuthorized(req)` from `api/_lib/cron-auth.js`
- Add entry to `vercel.json` `crons` array
- Design for idempotency: check a "last-fired" column before mutating, or use a deduplication table (see `stripe_events` pattern in `api/stripe-webhook.js`)

**New database table:**
- Create `db/migrations/NNN_descriptive-name.sql` (next sequential number)
- Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for idempotency
- Enable RLS: `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`
- Add `CREATE POLICY "service_role full access"` so API functions can write (they use service role key)
- Never edit a committed migration file — always add a new one

**New shared API helper:**
- Create `api/_lib/<name>.js`
- Export named functions only (no default export)
- Read credentials from `process.env` — never hardcode
- Design as best-effort where appropriate: catch errors and `console.warn`, never throw to callers for non-critical side effects

**New email template:**
- Use the component functions from `api/_lib/email-design.js`: `wrapEmail()`, `emailHero()`, `emailBody()`, `emailCtaCard()`, `emailInfoCard()`, `emailSignoff()`, `emailSpacer()`
- Always HTML-escape user-supplied values with `esc()` before embedding in email HTML

## Special Directories

**`api/_lib/`:**
- Purpose: Shared Node.js utilities for serverless functions
- Generated: No — manually maintained
- Exposed as endpoints: No — Vercel skips files/directories starting with `_`

**`db/migrations/`:**
- Purpose: Database schema version history
- Generated: No — written manually
- Note: Forward-only. Applied manually via Supabase SQL editor or psql. Never edit a committed file.

**`.planning/`:**
- Purpose: GSD planning documents (phases, codebase maps)
- Generated: Partially — by GSD codebase mapper and planning tools
- Committed: Yes

**`.github/`:**
- Purpose: GitHub Actions workflows
- Generated: No

**`assets/team/`:**
- Purpose: Team member headshots for About page
- Generated: No — design assets

---

*Structure analysis: 2026-05-04*
