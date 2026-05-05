# Ramped AI — Engineer Onboarding Guide

**Project:** 30dayramp.com — "Your AI department, live in 30 days."
**Repo:** `github.com/kaisuupgrades-ship-it/ramped`
**Production:** `https://www.30dayramp.com`
**Stack:** Vanilla HTML + Vercel Serverless Functions + Supabase PostgreSQL

---

> **⚠️ Two Vercel projects are currently live.** See [Section 2: Two Active Projects](#two-active-projects) before making any changes.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Getting Access](#2-getting-access)
3. [Local Setup](#3-local-setup)
4. [Repository Structure](#4-repository-structure)
5. [Architecture Overview](#5-architecture-overview)
6. [The Tech Stack (and why it's unconventional)](#6-the-tech-stack)
7. [Database](#7-database)
8. [External Services & API Keys](#8-external-services--api-keys)
9. [Authentication System](#9-authentication-system)
10. [How to Add a Feature](#10-how-to-add-a-feature)
11. [Frontend Rules](#11-frontend-rules)
12. [Backend Rules](#12-backend-rules)
13. [The Git Workflow](#13-the-git-workflow)
14. [Deploying](#14-deploying)
15. [Testing & QA](#15-testing--qa)
16. [Known Issues & Audit Findings](#16-known-issues--audit-findings)
17. [Files That Will Bite You](#17-files-that-will-bite-you)
18. [Useful Commands](#18-useful-commands)

---

## 1. What This Is

Ramped AI sells "done-for-you AI departments" to SMBs — HVAC companies, dealerships, property managers, senior living operators. Clients pay $2,500–$5,000/mo and get AI agents handling their lead follow-up, CRM, scheduling, and reporting.

The website does several things:

- **Marketing site** (`index.html`, `about.html`, `comparison.html`) — converts visitors to discovery call bookings
- **Booking flow** (`book.html` + `/api/book`) — calendar picker, Stripe tier selection, Google Meet creation
- **Pre-call intake** (`questionnaire.html` + `/api/questionnaire`) — Claude AI grades the prospect A–D and generates a custom automation roadmap
- **Admin dashboard** (`admin.html`) — internal CRM for Jon to manage bookings, clients, tickets, agents, and materials
- **Client portal** (`portal.html`) — token-gated customer view of their 30-day engagement phase, agent status, and support tickets
- **Cron jobs** — 30-minute reminder emails, Monday weekly digest emails

---

## 2. Two Active Projects

### Overview

There are currently **two separate Vercel deployments** running simultaneously while v2 is being validated. Do not confuse them.

| | **v1 (current production)** | **v2 (in progress)** |
|---|---|---|
| **Branch** | `main` | `v2` |
| **Stack** | Vanilla HTML + Vercel Serverless | Next.js 15 (app in `web/` subfolder) |
| **Domain** | `30dayramp.com` ← live traffic | Vercel preview URL only |
| **Status** | 🟢 Production — do not break | 🔧 In development |
| **Root dir** | `/` (repo root) | `/web` |
| **Build** | None — static HTML deployed as-is | `npm run build` (Next.js) |
| **Env vars** | Shared via Vercel (v1 project) | **Separate** env vars in v2 Vercel project |

### The plan

Jon is keeping both live until v2 is confirmed stable, then pointing `30dayramp.com` to v2. **The domain switch has not happened yet.**

### Rules during transition

- **Bug fixes and content changes for the live site** → work on `main` branch, deploy via v1 project
- **New feature development** → work on `v2` branch, test on v2 Vercel preview URL
- **Never push v2 code changes to `main`** and vice versa — they're different codebases
- **Always confirm which project you're deploying to** before running `vercel --prod`
- **Env vars are not shared** between projects — if you add a new secret for v2, you must add it to the v2 Vercel project specifically

### Working on v2 locally

```bash
git checkout v2
cd web
npm install
npm run dev    # Next.js dev server at http://localhost:3000
```

v2 is a standard Next.js 15 app with a build step (`npm run build`). All the "no build step" rules in this doc apply only to v1/main.

---

## Getting Access

You'll need access to the following. Ask Jon for credentials or invitations:

| Resource | Where |
|---|---|
| **GitHub repo** | `github.com/kaisuupgrades-ship-it/ramped` |
| **Vercel project** | vercel.com — "Ramped AI" project |
| **Supabase project** | supabase.com — contains the PostgreSQL database |
| **Resend** | resend.com — transactional email |
| **Stripe** | stripe.com — payments dashboard |
| **Slack workspace** | For admin notifications (Slack Incoming Webhook) |

**Environment variables** are stored in the Vercel project dashboard. You do NOT need a `.env` file locally — Vercel injects them at deploy/runtime. For local API testing via `vercel dev`, you'll pull them with the Vercel CLI (see Local Setup).

---

## 3. Local Setup

### Prerequisites

- Node.js >= 20.0.0 (`node -v` to check)
- npm (bundled with Node)
- Vercel CLI: `npm i -g vercel`
- Git

### Clone and install

```bash
git clone https://github.com/kaisuupgrades-ship-it/ramped.git
cd ramped
npm install    # installs dev deps (Playwright, axe-core, Lighthouse — no runtime deps)
```

### Pull environment variables

```bash
vercel link    # link to the Vercel project (one-time)
vercel env pull .env.local    # pulls all env vars to a local file for dev
```

> **Note:** `.env.local` is gitignored. Never commit it.

### Run locally

```bash
vercel dev    # serves static files + API functions at http://localhost:3000
```

This gives you a near-production environment — static HTML is served, and `api/*.js` serverless functions are executed locally with your env vars injected.

The site is pure static HTML — you can also open any `.html` file directly in your browser for UI work, though API calls won't work without `vercel dev`.

---

## 4. Repository Structure

```
ramped/
├── *.html              # All pages (18 static HTML files at the root)
├── styles.css          # Tailwind v4 compiled output — NEVER edit by hand
├── vercel.json         # Vercel config: routing, crons, security headers, function timeouts
├── package.json        # Dev dependencies only (Playwright, axe-core, Lighthouse)
├── materials.json      # Source of truth for admin Materials tab
├── sitemap.xml         # SEO sitemap
│
├── api/                # Vercel serverless functions (one file = one endpoint)
│   ├── _lib/           # Shared helpers — NOT exposed as HTTP endpoints
│   │   ├── admin-auth.js      # Admin bearer token auth + CORS
│   │   ├── audit-log.js       # Forensic trail for admin mutations
│   │   ├── cron-auth.js       # Cron job authentication
│   │   ├── email-design.js    # HTML email component builder
│   │   ├── google-calendar.js # OAuth token refresh, freebusy, Meet creation
│   │   ├── logger.js          # Structured agent run logs → Supabase
│   │   ├── map-token.js       # HMAC-signed expiring URL tokens
│   │   ├── notify.js          # Slack webhook notifications
│   │   ├── phase.js           # 30-day engagement phase computation
│   │   ├── stripe.js          # Stripe REST wrapper + pricing source of truth
│   │   └── validate.js        # Input sanitization, rate limiting
│   │
│   ├── book.js                # GET slots / POST booking + Meet + emails
│   ├── questionnaire.js       # POST intake → Claude grade + roadmap
│   ├── admin.js               # GET bookings + leads (admin auth)
│   ├── admin-*.js             # Admin mutations (update, delete, agents, tickets…)
│   ├── portal-*.js            # Customer portal endpoints (HMAC token auth)
│   ├── stripe-webhook.js      # Stripe event handler
│   ├── reminders.js           # Cron: 24h + 1h reminder emails
│   └── weekly-digest.js       # Cron: Monday activity digest
│
├── db/
│   └── migrations/            # Forward-only SQL for Supabase (001 → 010)
│
├── assets/                    # Static images, PDFs, SVGs
├── scripts/                   # Bash utility scripts (smoke test, lint)
├── tests/                     # Playwright E2E tests
└── .planning/                 # GSD planning docs (codebase maps, roadmap, requirements)
```

---

## 5. Architecture Overview

```
Browser
  └── Static HTML pages (served by Vercel CDN)
        └── fetch() calls → Vercel Serverless Functions (api/*.js)
              └── External services via raw fetch():
                    ├── Supabase REST API (PostgreSQL database)
                    ├── Resend (transactional email)
                    ├── Stripe REST API (billing)
                    ├── Anthropic API (Claude AI — prospect grading)
                    ├── Google Calendar API + Meet (booking slots)
                    └── Slack Incoming Webhook (admin notifications)
```

**There is no framework, no build step, no bundler, no React, no Next.js.**

- Pages are plain `.html` files. They use inline `<style>` blocks and inline `<script>` blocks.
- API functions are single-file ESM handlers: `export default async function handler(req, res)`
- Vercel serves the HTML as static files and executes the `api/*.js` files as serverless functions.
- All external APIs are called with the native `fetch()` function — zero npm packages at runtime.

### Request Lifecycle (example: booking)

1. User opens `book.html` → browser loads the page from Vercel CDN
2. JS in `book.html` calls `GET /api/availability` → returns schedule settings from Supabase
3. User picks a date → JS calls `GET /api/book?date=YYYY-MM-DD` → returns booked slots (checks Supabase + Google Calendar)
4. User submits form → JS calls `POST /api/book` → `api/book.js`:
   - Validates input, rate-limits by IP
   - Writes booking to Supabase `bookings` table
   - Creates Google Meet event via Google Calendar API
   - Sends confirmation emails via Resend
   - Fires Slack notification
   - Returns booking ID + signed token; browser redirects to questionnaire
5. Questionnaire submits → `POST /api/questionnaire` → calls Claude API → stores roadmap → emails owner + client

---

## 6. The Tech Stack

### Why no framework?

This was built fast. No build toolchain = no CI setup, no TypeScript config, no bundler — just push to main and Vercel deploys in seconds. The trade-off is the frontend is harder to maintain at scale (CSS tokens duplicated across 18 files, no component sharing between pages). A migration to a framework is planned but not started.

### Key files to understand first

| File | Why it matters |
|---|---|
| `api/_lib/admin-auth.js` | Every admin endpoint imports this. Understand it before touching any admin route. |
| `api/_lib/validate.js` | Rate limiting + input sanitization. Every public POST uses this. |
| `api/_lib/map-token.js` | How customer-facing links are secured (HMAC-signed tokens). |
| `api/_lib/phase.js` | How the 30-day engagement phase is computed. Source of truth for both admin + portal. |
| `api/_lib/stripe.js` | Pricing source of truth (`TIER_PRICES`). Stripe REST wrapper. |
| `api/_lib/email-design.js` | All email HTML is built with these component functions. |
| `vercel.json` | Routing rewrites, cron schedules, security headers, function timeouts. One typo breaks everything. |

---

## 7. Database

**Supabase PostgreSQL.** No Supabase JS SDK — all DB access is raw `fetch()` against the Supabase REST API.

### Key tables

| Table | Purpose |
|---|---|
| `bookings` | Discovery call bookings. Has `UNIQUE(datetime)` constraint — do NOT drop it. |
| `automation_maps` | Claude-generated automation roadmaps per booking |
| `agents` | AI agent definitions per client |
| `agent_runs` | Agent execution history |
| `agent_logs` | Per-run log entries |
| `agent_drafts` | Draft outputs awaiting client approval |
| `support_tickets` / `support_messages` | Client support inbox |
| `portal_events` | Client portal activity beacons |
| `stripe_events` | Idempotent Stripe event log |
| `onboarding_documents` | Client file uploads |
| `admin_audit_log` | Forensic trail for admin mutations (actor + IP stored as SHA-256 hashes) |
| `availability_settings` | Jon's booking availability config |

### How to query (the pattern used everywhere)

```javascript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

// Usage:
const { ok, data } = await supabase('GET', '/bookings?select=*&status=eq.confirmed&order=datetime.asc');
const { ok, data } = await supabase('POST', '/bookings', { email: 'x@y.com', datetime: '...' });
const { ok } = await supabase('PATCH', '/bookings?id=eq.UUID', { reminded_24h_at: new Date().toISOString() });
```

### Migrations

- Located in `db/migrations/` — numbered sequentially (`001_`, `002_`, …)
- **Forward-only.** Never edit a committed migration file. Add a new one.
- Apply manually via Supabase SQL editor or psql.
- Always use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency.
- Every new table must: `ENABLE ROW LEVEL SECURITY` and have a service_role full-access policy.

```sql
-- Example migration skeleton
CREATE TABLE IF NOT EXISTS my_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access" ON my_new_table
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 8. External Services & API Keys

All secrets are stored in **Vercel environment variables** — never in code.

### Required for the app to function

| Env Var | Service | Purpose |
|---|---|---|
| `SUPABASE_URL` | Supabase | DB base URL |
| `SUPABASE_SERVICE_KEY` | Supabase | Service role key (bypasses RLS) |
| `RESEND_API_KEY` | Resend | Transactional email |
| `ADMIN_TOKEN` | Custom | Admin dashboard auth |
| `CRON_SECRET` | Custom | Cron job auth (Vercel injects this automatically) |
| `MAP_LINK_SECRET` | Custom | HMAC key for signed customer links (32+ hex chars) |

### Required for full features

| Env Var | Service | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | Claude AI prospect grading |
| `STRIPE_SECRET_KEY` | Stripe | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Webhook signature verification |
| `GOOGLE_CLIENT_ID` | Google | Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Google | Calendar OAuth |
| `GOOGLE_REFRESH_TOKEN` | Google | Calendar API access |
| `GOOGLE_CALENDAR_ID` | Google | Which calendar to use (defaults to `primary`) |
| `SLACK_WEBHOOK_URL` | Slack | Admin notifications (optional, silently skipped if absent) |

### Optional / defaulted

| Env Var | Default |
|---|---|
| `OWNER_EMAIL` | `jon@30dayramp.com` |
| `SITE_URL` | `https://www.30dayramp.com` |
| `IP_HASH_SALT` | `ramped-default-salt-rotate-me` (**MUST change in prod**) |
| `MATERIALS_BUCKET` | `materials` |
| `SUPABASE_ONBOARDING_BUCKET` | `onboarding` |

---

## 9. Authentication System

There are three separate auth mechanisms — none use JWTs or a third-party identity provider.

### Admin auth (for `admin.html` and all `api/admin-*.js` endpoints)

- `admin.html` prompts for `ADMIN_TOKEN` and stores it in `sessionStorage`
- All admin API calls use `Authorization: Bearer <token>` header
- Every admin endpoint imports and calls `isAuthorized(req)` from `api/_lib/admin-auth.js`
- Comparison is constant-time to prevent timing attacks

```javascript
import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  // your logic here
}
```

### Customer portal auth (HMAC-signed expiring tokens)

Customer-facing links (portal, automation map, roadmap) use HMAC-signed tokens to avoid exposing bare UUIDs. Token shape: `/portal?id=UUID&exp=<unixSeconds>&t=<hmac>`

```javascript
import { signMapToken, verifyMapToken } from './_lib/map-token.js';

// Create a 30-day link:
const { exp, t } = signMapToken(bookingId, 30 * 24 * 60 * 60);
const portalUrl = `https://www.30dayramp.com/portal?id=${bookingId}&exp=${exp}&t=${t}`;

// Verify at the receiving endpoint:
const { ok, reason } = verifyMapToken(id, exp, t);
if (!ok) return res.status(403).json({ error: reason });
```

### Cron auth

Vercel automatically injects `Authorization: Bearer ${CRON_SECRET}` on scheduled calls. All cron endpoints verify this:

```javascript
import { isCronAuthorized } from './_lib/cron-auth.js';

if (!isCronAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
```

---

## 10. How to Add a Feature

### New HTML page

1. Copy the full `<head>` block from `index.html` (includes meta, OG, favicon, fonts, `styles.css`, Vercel Insights)
2. Add inline `:root` CSS token block — see Brand v3 tokens in Section 11
3. Copy the mobile nav section from `index.html`
4. Add a URL rewrite to `vercel.json` (`rewrites` array)
5. Add the canonical URL to `sitemap.xml`

### New public API endpoint

Create `api/<endpoint-name>.js`:

```javascript
// api/my-endpoint.js — Brief description
// POST /api/my-endpoint → does X

import { checkRateLimit, getClientIp, esc, isValidEmail } from './_lib/validate.js';

const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];

function setCors(req, res, methods) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: 'Too many requests.' });

  const { email, name } = req.body;
  if (!email || !isValidEmail(email)) return res.status(400).json({ error: 'Valid email required.' });

  // your logic here

  return res.status(200).json({ ok: true });
}
```

### New admin endpoint

```javascript
// api/admin-my-thing.js
import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';
import { logAdminAction } from './_lib/audit-log.js'; // for destructive mutations

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  // your logic here
  // for deletes/mutations: await logAdminAction(req, 'deleted_booking', { id });
}
```

### New customer portal endpoint

```javascript
// api/portal-my-thing.js
import { verifyMapToken } from './_lib/map-token.js';

export default async function handler(req, res) {
  const { id, exp, t } = req.query;
  const { ok, reason } = verifyMapToken(id, exp, t);
  if (!ok) return res.status(403).json({ error: reason });

  // fetch only client-safe fields — NEVER expose grade, admin_notes, or internal metadata
}
```

### New database table

1. Create `db/migrations/NNN_descriptive-name.sql` (next number in sequence)
2. Apply it via Supabase SQL editor
3. Never edit an existing migration file

### New email template

Use the component system from `api/_lib/email-design.js`:

```javascript
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailSignoff } from './_lib/email-design.js';

const html = wrapEmail(
  emailHero('Your AI department is live'),
  emailBody(`Hi ${esc(name)}, here's what happened this week...`),
  emailCtaCard('View your portal', portalUrl),
  emailSignoff()
);
```

Always escape user-supplied values with `esc()` before embedding in HTML.

---

## 11. Frontend Rules

These are non-negotiable. Every violation creates debt that takes hours to clean up.

### Brand v3 CSS tokens (dark mode — current standard)

Every HTML page must declare these in an inline `<style>:root{ ... }</style>` block:

```css
:root {
  --bg-0: #07090d; --bg-1: #0b0f17; --bg-2: #11161f;
  --bg-3: #161c27; --bg-4: #1c2331;
  --line: #1f2735; --line-2: #2a3344;
  --text-0: #f4f6fa; --text-1: #c5cdd9; --text-2: #8b94a3; --text-3: #5a6373;
  --blue: #3b82f6; --blue-2: #60a5fa; --blue-glow: rgba(59,130,246,0.35);
  --orange: #fb923c; --orange-2: #fdba74; --orange-glow: rgba(251,146,60,0.3);
  --green: #34d399; --red: #f87171; --purple: #a78bfa;
  --radius-sm: 8px; --radius: 12px; --radius-lg: 16px; --radius-xl: 24px;
}
```

- Primary CTA color: `--orange`
- Links, emphasis, gradient text: `--blue`
- Hero H1 gradient: `linear-gradient(120deg, var(--blue-2) 0%, var(--orange) 90%)`

### Required `<head>` elements (every customer-facing page)

```html
<title>Page Title | Ramped AI</title>
<meta name="description" content="...">
<link rel="canonical" href="https://www.30dayramp.com/page">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://www.30dayramp.com/og-image.png">
<meta property="og:url" content="https://www.30dayramp.com/page">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css">
<script defer src="/_vercel/insights/script.js"></script>
<!-- Do NOT add Vercel Insights to /admin or /dashboard -->
```

### Other rules

- **Never edit `styles.css` by hand** — it's a compiled Tailwind output
- **No Tailwind Play CDN** (`cdn.tailwindcss.com`) — banned
- Every page needs `<h1>` with proper heading order (H1 → H2 → H3, no skipping)
- Every page needs a skip-to-main link at the top of `<body>`
- Every page needs a working mobile nav (hamburger, `aria-expanded`, `aria-controls`) — copy from `index.html`
- `prefers-reduced-motion: reduce` must disable animations (ticker, count-up, hover-lift)
- Fonts: Inter `400;500;600;700;800` + JetBrains Mono `400;500;600` — no other variants without reason
- Primary CTA copy: `"Book a discovery call →"` — do not invent variants
- Contact email: `jon@30dayramp.com` only

### Pricing — update ALL FIVE locations or none

Pricing lives in five places. Change all of them at the same time:
1. `index.html` — JS `TIERS` object
2. `book.html` — `tierLabels` map
3. `comparison.html` — static text
4. `one-pager.html` — static text
5. `pricing-onepager.html` — static text

Verify with: `grep -n "2,083\|2,500\|4,167\|5,000" *.html`

---

## 12. Backend Rules

- **No new public-by-UUID endpoints.** Customers must get HMAC-signed tokens, not bare UUIDs.
- **Every public POST must rate-limit** via `checkRateLimit()` from `api/_lib/validate.js`
- **Every public POST must HTML-escape user input** with `esc()` before putting it in emails or HTML responses
- **Cron jobs must be idempotent.** Check a "last-fired" column or use a deduplication table before mutating.
- **No secrets in committed code.** All keys via `process.env`.
- **No logging of full request bodies** that include credentials.
- **No Supabase JS SDK** — use raw `fetch()` against the REST API (see the pattern in Section 7)
- The `bookings` table has a `UNIQUE(datetime)` constraint — do NOT drop it.
- `api/send-followup.js` still uses `ADMIN_PASSWORD` env var instead of `ADMIN_TOKEN` — fix when you touch that file.

---

## 13. The Git Workflow

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes, commit
git add api/new-endpoint.js book.html
git commit -m "feat: add X endpoint for Y"

# Push and open PR
git push origin feature/your-feature-name
# Open PR on GitHub → review → merge to main
```

### Commit message conventions

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code change without behavior change
- `chore:` — maintenance, dependencies
- `ci:` — CI/build related

### Rules

- **Never push directly to `main`** — always use a PR
- **Verify the Vercel preview deployment** before merging — Vercel auto-generates a preview URL for every branch
- **Do not push customer-visible changes after 5pm Friday** — cron and email side-effects can spill into the weekend
- After merging, verify production at `https://www.30dayramp.com`

---

## 14. Deploying

**Deployment is automatic.** Push to `main` → Vercel detects the push → deploys within ~30 seconds.

- **Production:** `https://www.30dayramp.com` — auto-deploys from `main`
- **Preview:** auto-generated per branch at `https://ramped-git-<branch-name>-kaisuupgrades-ship-its-projects.vercel.app`

### There is no build step

No `npm run build`. No compilation. Static HTML is served as-is. `api/*.js` are bundled by Vercel at deploy time. `styles.css` is already a committed build artifact.

### Environment variables

Managed in the **Vercel dashboard** (Settings → Environment Variables). You can also use the CLI:

```bash
vercel env add MY_VAR production
vercel env ls
```

Variables are scoped to Production, Preview, or Development environments.

### Manual deploy (emergency)

```bash
vercel --prod    # deploy current working directory to production immediately
```

Use sparingly — always prefer the git-based flow.

### After deploying

Always run the smoke test against the preview URL before merging to main:

```bash
bash scripts/e2e-test.sh https://ramped-git-<branch>.vercel.app
```

---

## 15. Testing & QA

### Smoke test (most important)

```bash
bash scripts/e2e-test.sh              # runs against production
bash scripts/e2e-test.sh <preview-url> # runs against a specific URL
```

Always run against the preview URL before merging.

### Playwright E2E tests

```bash
npm run test:install    # install Playwright browsers (one-time)
npx playwright test     # run all tests
npx playwright test tests/public/homepage.spec.js   # run one test file
npx playwright test --headed    # watch mode
```

Tests are organized in `tests/`:
- `tests/public/` — public pages (homepage, book, etc.)
- `tests/protected/` — admin + portal auth
- `tests/api/` — API endpoint tests
- `tests/a11y/` — accessibility (axe-core)
- `tests/lighthouse/` — performance
- `tests/mobile/` — mobile viewport

### Linting

```bash
npm run lint:fonts    # check font loading on all pages
npm run lint:tokens   # check CSS token consistency across pages
```

### Manual checks for every frontend PR

- Open in Chrome + Safari + mobile viewport
- Check mobile nav hamburger works
- Verify no console errors
- Run `npm run lint:tokens`

---

## 16. Known Issues & Audit Findings

These are tracked in `AUDIT.md`. Don't fix them in passing — open a dedicated PR.

### Critical (fix before working nearby)

- **SEC-01:** `ADMIN_TOKEN` stored in `localStorage` → should be `sessionStorage` (or cookie). `admin.html` uses localStorage today.
- **SEC-02:** Google OAuth HMAC state parameter missing — open to CSRF on the OAuth callback.
- **SEC-04:** `api/questionnaire.js` doesn't validate `booking_id` exists before writing the automation map.

### High priority

- **C1:** `api/get-map.js` and `api/get-roadmap.js` are public-by-UUID — anyone with a UUID gets full read. Need HMAC tokens.
- **H3:** `api/reminders.js` is not idempotent — same booking can receive duplicate reminder emails if cron windows overlap.
- **H2-5:** Query-string admin token fallback removed, but `api/send-followup.js` still uses `ADMIN_PASSWORD` env var — standardize to `ADMIN_TOKEN`.

### Ongoing architectural debt

- **CSS tokens duplicated across 18 HTML files** — adding a new token requires editing every file.
- **Pricing in 5 places** — always update all five together or it goes out of sync.
- **No shared JS between HTML pages** — common patterns copy-pasted, not imported.
- **No CI pipeline** — no automated test runs on PR. Manual smoke test required.

See `AUDIT.md` for the full list with status and fix references.

---

## 17. Files That Will Bite You

| File | Why |
|---|---|
| `vercel.json` | One syntax error breaks routing, CSP headers, or cron schedules for the entire site. Always validate the preview URL after touching it. |
| `api/_lib/admin-auth.js` | Authentication logic. The constant-time compare (`safeEqual`) must not be replaced with `===`. |
| `api/book.js` | Booking creation + Google Meet + confirmation emails. The most complex endpoint. Has a lot of moving parts — run E2E after any change. |
| `api/questionnaire.js` | Calls Anthropic, writes roadmap to Supabase, sends two emails, updates booking. Long file, easy to break the Claude prompt or mutate incorrectly. |
| `db/migrations/*.sql` | Forward-only. Never edit a committed migration. |
| `styles.css` | Tailwind v4 compiled output. Hand-editing will be overwritten next time someone runs Tailwind. Never edit. |
| `index.html` | Main landing page. Seen by every visitor. Every change needs visual QA. |
| `materials.json` | Source of truth for admin Materials tab. If you ship a new doc and forget to add it here, it won't appear in the admin. |

---

## 18. Useful Commands

```bash
# Start local dev server
vercel dev

# Pull latest env vars
vercel env pull .env.local

# Smoke test against production
bash scripts/e2e-test.sh

# Smoke test against preview
bash scripts/e2e-test.sh https://ramped-git-<branch>.vercel.app

# Check fonts on all pages
npm run lint:fonts

# Check CSS token consistency
npm run lint:tokens

# Run all Playwright tests
npx playwright test

# Run one test file
npx playwright test tests/public/homepage.spec.js

# Verify all canonical URLs resolve (200)
for u in / /about /book /comparison /demo /resources /questionnaire /privacy /thanks; do
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://www.30dayramp.com$u"
done

# Find pages missing /styles.css
for f in *.html; do grep -q 'href="/styles.css"' "$f" || echo "MISSING: $f"; done

# Find pages missing canonical link
for f in *.html; do grep -q 'rel="canonical"' "$f" || echo "MISSING: $f"; done

# Find pages missing Vercel Insights
for f in *.html; do grep -q '/_vercel/insights/script.js' "$f" || echo "MISSING insights: $f"; done

# Check pricing is consistent across all 5 locations
grep -n "2,083\|2,500\|4,167\|5,000" *.html

# Verify nav is consistent across pages
for f in *.html; do echo "=== $f ===" && awk '/<nav[^>]*aria-label="Primary"/,/<\/nav>/' "$f"; done

# Deploy to production manually (use git flow instead when possible)
vercel --prod
```

---

## Questions?

Reach Jon at `jon@30dayramp.com` or in the Telegram group.

The `.planning/` directory has deep codebase analysis documents if you want to go deeper on any area:
- `.planning/codebase/ARCHITECTURE.md` — full system diagram and data flows
- `.planning/codebase/STACK.md` — technology decisions
- `.planning/codebase/CONVENTIONS.md` — coding patterns with examples
- `.planning/codebase/INTEGRATIONS.md` — every external service and env var
- `.planning/codebase/CONCERNS.md` — 31 open audit findings, severity-classified
- `.planning/ROADMAP.md` — upcoming phases and priorities
- `AUDIT.md` — running list of issues with fix history
