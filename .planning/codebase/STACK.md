# Technology Stack

**Analysis Date:** 2026-05-04

## Languages

**Primary:**
- JavaScript (ES Modules) — all serverless API functions under `api/*.js` and `api/_lib/*.js`
- HTML5 — 18 static pages at the project root (e.g., `index.html`, `book.html`, `admin.html`)
- CSS — single pre-compiled Tailwind v4 output at `styles.css` (treated as build artifact, not hand-edited)

**Secondary:**
- SQL — forward-only migrations under `db/migrations/*.sql` (9 migration files)
- Bash — utility scripts under `scripts/` (e.g., `scripts/e2e-test.sh`, `scripts/check-fonts.sh`, `scripts/check-tokens.sh`)

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced in `package.json` `engines` field)
- Vercel serverless runtime — each `api/*.js` file is an independent function handler

**Module System:**
- ES Modules (`"type": "commonjs"` in `package.json`, but API files use `import`/`export` syntax — Vercel handles the transform)
- No bundler or transpiler — Vercel processes ESM imports natively at deploy time

## Package Manager

**Manager:** npm
- Lockfile: `package-lock.json` (assumed — repo uses npm scripts)
- No runtime `node_modules` — zero production npm dependencies
- All external services (Supabase, Resend, Stripe, Anthropic, Google) called via native `fetch()` — no SDKs

## Frameworks

**Core:**
- None — vanilla HTML + CSS + JavaScript. No React, Next.js, Vue, or similar.
- Vercel serverless functions replace a traditional backend framework.

**Testing:**
- Playwright `^1.47.0` — E2E test runner (`package.json` devDependencies)
- `@axe-core/playwright ^4.10.0` + `axe-core ^4.10.0` — accessibility testing
- Lighthouse `^12.2.0` — performance auditing
- Config: `playwright.config.*` (not read, but referenced by npm scripts)

**Build/Dev:**
- No build step for production — static HTML served directly
- Tailwind CSS v4 — used locally to generate `styles.css`; output committed as artifact
- Vercel CLI — deployment target; `vercel.json` controls routing, crons, headers, redirects

## Key Dependencies

**Critical (zero npm runtime deps — all via fetch):**
- Supabase REST API — database (PostgreSQL) via `https://*.supabase.co/rest/v1/...`
- Resend REST API — transactional email via `https://api.resend.com/emails`
- Stripe REST API — payments via `https://api.stripe.com/v1/...` (no Stripe Node SDK)
- Anthropic Messages API — AI grading/roadmap via `https://api.anthropic.com/v1/messages`
- Google OAuth2 + Calendar API — booking calendar via `https://oauth2.googleapis.com/token` and `https://www.googleapis.com/calendar/v3/`
- Slack Incoming Webhooks — admin notifications via `https://hooks.slack.com/`

**Node Built-ins Used:**
- `crypto` — HMAC signing (`map-token.js`, `admin-auth.js`, `audit-log.js`, `stripe.js`), timing-safe comparison
- `fs`, `path` — file operations in `admin-materials.js`

**Dev Dependencies:**
- `@playwright/test ^1.47.0`
- `@axe-core/playwright ^4.10.0`
- `axe-core ^4.10.0`
- `lighthouse ^12.2.0`

## Configuration

**Environment:**
- All secrets injected via Vercel environment variables — no `.env` file committed
- See `INTEGRATIONS.md` for full env var inventory

**Build:**
- `vercel.json` — routing rewrites, redirects, security headers, cron schedules, function timeouts
- No `tsconfig.json`, no `webpack.config`, no `vite.config`

**Lint/Format:**
- No ESLint or Prettier config detected — code style enforced by convention (CLAUDE.md rules)
- Custom lint scripts: `npm run lint:fonts` (bash) and `npm run lint:tokens` (bash)

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- Vercel CLI for local function testing
- Playwright + Chromium for test runs (`npm run test:install` installs deps)

**Production:**
- Vercel (static hosting + serverless functions)
- Domain: `30dayramp.com` / `www.30dayramp.com`
- Vercel preview deployments at `ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app`
- Supabase project for PostgreSQL + Storage
- No containers, no Docker, no self-hosted infrastructure

## Cron Jobs

Defined in `vercel.json`:
- `GET /api/reminders` — every 30 minutes (`*/30 * * * *`), max 120s timeout implied
- `GET /api/weekly-digest` — Mondays at 9am UTC (`0 9 * * 1`), max 60s timeout
- `api/questionnaire.js` — max 120s timeout (longest-running, calls Anthropic)
- `api/stripe-webhook.js` — max 30s timeout

---

*Stack analysis: 2026-05-04*
