# Ramped AI — `30dayramp.com`

> **Your AI department, live in 30 days.** Done-for-you AI implementation for operating businesses on a flat monthly retainer.

Static HTML + Vercel serverless API + Supabase + Resend + Google Calendar + Anthropic. No framework. No build step (yet — see [Roadmap](#roadmap)).

## Stack

| Concern | Tech |
|---|---|
| Frontend | 22 hand-rolled HTML pages + a single pre-compiled Tailwind v4 `styles.css` |
| API | Vercel serverless functions (`api/*.js`, ESM, Node 20) |
| Database | Supabase Postgres (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`) |
| Email | Resend (`RESEND_API_KEY`) |
| Calendar | Google OAuth → Calendar API (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`) |
| LLM | Anthropic Claude (`ANTHROPIC_API_KEY`, `claude-sonnet-4-5`) |
| Billing | Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) |
| Cron | Vercel Cron — `/api/reminders` every 30 min, `/api/weekly-digest` Mon 9am UTC |
| Hosting | Vercel |

## Repo layout

```
.
├─ index.html, about.html, book.html, …    22 customer-facing pages + 3 internal/protected
├─ api/
│  ├─ _lib/
│  │  ├─ admin-auth.js     bearer-token gate (constant-time compare)
│  │  ├─ cron-auth.js      Vercel-Cron Authorization gate (Audit C2-1, H2-2)
│  │  ├─ map-token.js      HMAC-signed expiring URLs for /portal /roadmap /map
│  │  ├─ stripe.js         Stripe REST wrapper (no SDK dep)
│  │  ├─ google-calendar.js  freebusy + Meet event creation
│  │  ├─ email-design.js   bulletproof email templates
│  │  ├─ notify.js         Slack incoming webhooks
│  │  ├─ validate.js       email/timezone/rate-limit
│  │  ├─ phase.js          single source of truth: kickoff → live phase string
│  │  └─ logger.js         agent_runs / agent_logs writer (legacy; see audit L2-2)
│  ├─ admin*.js            admin endpoints (bearer auth)
│  ├─ portal*.js           customer portal (HMAC token auth)
│  ├─ book.js, contact.js, questionnaire.js, …
│  ├─ stripe-webhook.js    Stripe events (signature verified)
│  ├─ reminders.js, weekly-digest.js   cron handlers
│  └─ resources*.js, generate-map.js   etc.
├─ db/migrations/           forward-only SQL (run in Supabase SQL editor)
│  ├─ 001_agent_logging.sql
│  ├─ 002_bookings_constraints.sql
│  ├─ 003_portal.sql
│  ├─ 004_stripe_onboarding_agents.sql
│  ├─ 005_profile_prefs.sql
│  ├─ 006_fix_agent_runs_schema.sql   ← Audit H2-3 reconciliation
│  └─ 007_rls_hardening.sql            ← Audit H2-7 RLS for portal/agent/Stripe tables
├─ scripts/
│  ├─ e2e-test.sh          legacy curl-based smoke (still valid, post-Bearer auth update)
│  ├─ check-fonts.sh       font loadout drift guard (Audit V2-A2/A3)
│  └─ check-tokens.sh      design-token drift guard (Audit V2-A1)
├─ tests/                  Playwright suite — see tests/README.md
├─ AUDIT.md                security + visual + code audit (v1 + v2)
├─ VISUAL-AUDIT.md         design audit
├─ MOBILE-AUDIT.md         mobile-specific audit
├─ CLIENT-PORTAL-PLAN.md   portal architecture
├─ CLAUDE.md               persistent rules for AI coworkers on this repo
├─ CLAUDE-DESIGN-PROMPTS.md  paste-ready prompts for Claude Design assets
├─ ROADMAP.md              prioritized 1/2/4-week backlog (added Phase 5)
├─ vercel.json             headers, redirects, rewrites, cron schedule, function maxDuration
├─ package.json            test scripts only (no production build)
├─ playwright.config.js
└─ styles.css              pre-compiled Tailwind v4 output (treat as build artifact)
```

## Required environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production + Preview + Development).

| Var | Required | Notes |
|-----|----------|-------|
| `SUPABASE_URL` | yes | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | yes | Service-role key — bypasses RLS. **Never expose client-side.** |
| `RESEND_API_KEY` | yes | Transactional email |
| `ANTHROPIC_API_KEY` | yes | Roadmap + grading |
| `ADMIN_TOKEN` | yes | Admin bearer token — generate with `openssl rand -hex 32`. Sole admin auth surface. |
| `MAP_LINK_SECRET` | yes | HMAC secret for portal/roadmap/map URLs — `openssl rand -hex 32`. Endpoints fail closed (503) if missing. |
| `CRON_SECRET` | yes | Vercel Cron Bearer auth — `openssl rand -hex 32`. Without it, cron rejects all calls (incl. Vercel itself). |
| `STRIPE_SECRET_KEY` | yes for billing | `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | yes for billing | `whsec_…` from `/api/stripe-webhook` setup in Stripe |
| `GOOGLE_CLIENT_ID` | yes for Meet | OAuth client |
| `GOOGLE_CLIENT_SECRET` | yes for Meet | OAuth client |
| `GOOGLE_REFRESH_TOKEN` | yes for Meet | One-time setup via `/api/google-oauth-start?token=$ADMIN_TOKEN` |
| `GOOGLE_CALENDAR_ID` | optional | Defaults to `primary` |
| `OWNER_EMAIL` | optional | Defaults to `jon@30dayramp.com` |
| `SITE_URL` | optional | Defaults to `https://www.30dayramp.com` |
| `OAUTH_REDIRECT_HOST` | optional | Override OAuth callback host |
| `SLACK_WEBHOOK_URL` | optional | Booking + ticket + payment notifications |
| `IP_HASH_SALT` | optional | Salt for portal-event IP hashing — defaults to public string (Audit M2-2 — set this) |
| `SUPABASE_ONBOARDING_BUCKET` | optional | Defaults to `onboarding` |

## Local dev

```bash
# 1. Vercel CLI
npm install -g vercel
vercel link
vercel env pull .env.local            # pulls all env vars from your Vercel project

# 2. Run dev server
vercel dev                            # serves the static HTML + API on http://localhost:3000

# 3. Run tests against local
BASE_URL=http://localhost:3000 npm test
```

## Run the test suite

See [tests/README.md](./tests/README.md) for full details.

```bash
npm install
npm run test:install         # one-time: download Chromium for Playwright
npm run verify               # fastest pre-commit gate (~30s): lint + api + public
npm test                     # full suite incl. a11y + mobile + lighthouse
npm run test:smoke           # legacy bash smoke against the live deploy
```

## Audits

This repo has a strong audit culture — every change goes through a documented audit pass:

- **[AUDIT.md](./AUDIT.md)** — security + code review (v2 = 2026-04-29; v1 preserved). 31 open issues categorized C/H/M/L with file:line and ready-to-apply fix snippets.
- **[VISUAL-AUDIT.md](./VISUAL-AUDIT.md)** — design + UX (v2 = 2026-04-29; v1 preserved). 19 open items in Tier A/B/C.
- **[MOBILE-AUDIT.md](./MOBILE-AUDIT.md)** — viewport-specific findings.

The two `scripts/check-*.sh` files lint against the canonical palette and font loadout from `CLAUDE.md`. They run silent on a clean repo.

## Deploy

Pushes to `main` auto-deploy via Vercel. PRs get a preview URL.

Before merging a PR that touches `api/` or `db/migrations/`:

1. `npm run verify` passes locally
2. `bash scripts/e2e-test.sh` passes against the preview URL (set `BASE` and `ADMIN_TOKEN`)
3. Any new SQL migration was run in Supabase SQL editor
4. `vercel.json` redirects/rewrites validated by visiting them on the preview

See `DEPLOY.md` and `DEPLOY-FULL-STACK.md` for per-feature step-by-steps.

## Roadmap

The 1/2/4-week prioritized backlog lives in [ROADMAP.md](./ROADMAP.md). Phase 5 of the 2026-04-29 audit pass writes that file; until then, the audit `Open issues` table is the source of truth.

## Conventions

- All persistent rules for AI coworkers (incl. Claude) live in [CLAUDE.md](./CLAUDE.md). Read it before editing.
- Forward-only migrations. Never edit a committed `.sql` file; add a new one.
- `styles.css` is a pre-compiled Tailwind output — never hand-edit. Edit per-page inline `<style>` instead, or rebuild Tailwind locally and commit the new output.
- One canonical email: `jon@30dayramp.com`.
- One CTA copy: "Book a discovery call →" (primary) / "Get started →" (tier-bound).

