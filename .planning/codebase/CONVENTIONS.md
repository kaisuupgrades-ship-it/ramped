# Coding Conventions

**Analysis Date:** 2026-05-04

## Language & Module System

**Backend (API functions):**
- ES Modules (`"type": "commonjs"` in package.json, but API files use `import`/`export` — Vercel handles the transform)
- Files: `api/*.js` and `api/_lib/*.js`
- Each function exports a single `export default async function handler(req, res)`

**Tests:**
- CommonJS (`require`/`module.exports`) — Playwright's Node runner consumes them
- Files: `tests/**/*.spec.js` and `tests/lib/*.js`

## Naming Patterns

**Files:**
- API route files: `kebab-case.js` matching the URL path they serve (e.g., `api/book.js` → `/api/book`, `api/admin-update.js` → `/api/admin-update`)
- Shared library files: `api/_lib/kebab-case.js` (e.g., `admin-auth.js`, `email-design.js`, `google-calendar.js`)
- Test specs: `kebab-case.spec.js` (e.g., `homepage.spec.js`, `public-endpoints.spec.js`)
- Test fixture/lib files: `kebab-case.js` under `tests/lib/`
- Shell scripts: `kebab-case.sh` under `scripts/`

**Functions:**
- camelCase throughout — both exported and internal (e.g., `checkRateLimit`, `getClientIp`, `isValidEmail`, `formatForTz`, `setCors`)
- Boolean-returning helpers prefixed with `is` or `has` (e.g., `isAuthorized`, `isValidEmail`, `isConfigured`, `isFuture`)
- Event-style exports prefixed with verb + noun (e.g., `notifyBookingCreated`, `notifyTicketCreated`, `startRun`, `endRun`)

**Variables:**
- SCREAMING_SNAKE_CASE for module-level constants read from env (e.g., `SUPABASE_URL`, `RESEND_KEY`, `ADMIN_TOKEN`, `OWNER_EMAIL`)
- camelCase for local variables and function parameters
- Short aliases at top of file (e.g., `const RESEND_KEY = process.env.RESEND_API_KEY`)

**Exports:**
- Named exports for library modules (`api/_lib/`): `export function setAdminCors(...)`, `export function isAuthorized(...)`
- Default export for route handlers: `export default async function handler(req, res)`

## File Header Comments

Every file opens with a `//` comment block identifying the file path, brief purpose, and (for route files) a terse HTTP contract:

```javascript
// api/book.js — Booking API (with Google Calendar + Meet integration)
// GET  /api/book?date=YYYY-MM-DD  → returns booked slots for that date
// POST /api/book                  → creates a booking, creates Meet event, emails guest + owner
```

Library files open with a similar description and note any required env vars:
```javascript
// api/_lib/admin-auth.js — Admin endpoint helpers.
// Centralises CORS allowlist + token verification so every admin endpoint
// enforces the same rules.
```

## Import Organization

**Order (as observed in route files):**
1. Internal library imports from `./_lib/` (validate, auth, email-design, etc.)
2. No external npm SDK imports — all external APIs are called via raw `fetch()`

**No path aliases.** All imports use relative paths (`'./_lib/validate.js'`).

Example from `api/book.js`:
```javascript
import { esc, isValidEmail, isFuture, isWithinBookingWindow, isBusinessHours, truncate, checkRateLimit, getClientIp } from './_lib/validate.js';
import { isConfigured as gcalConfigured, getBusyRanges, createMeetEvent } from './_lib/google-calendar.js';
import { wrapEmail, emailHero, emailBody, emailCtaCard, emailInfoCard, emailSignoff, emailSpacer } from './_lib/email-design.js';
```

## Error Handling

**Strategy:** Inline conditional returns, not thrown errors. Each handler validates input and returns early with a status code.

**Pattern — early return on bad input:**
```javascript
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  return res.status(400).json({ error: 'date param required (YYYY-MM-DD)' });
}
```

**Pattern — rate-limit check at handler top:**
```javascript
const ip = getClientIp(req);
const rl = checkRateLimit(ip, { max: 5, windowMs: 60_000 });
if (!rl.ok) return res.status(429).json({ error: 'Too many requests.' });
```

**Pattern — best-effort side effects (never throw):**
Email send, Slack notify, and logger calls are wrapped in try/catch or guard-and-warn — failures are logged but never surface as 500s:
```javascript
if (!RESEND_KEY) { console.warn('RESEND_API_KEY not set — skipping email'); return; }
// ...
if (!r.ok) console.error('Resend error:', r.status, await r.text());
```

**Pattern — lib functions return result objects, not exceptions:**
```javascript
// validate.js returns { ok: boolean, reason?: string }
return { ok: false, reason: 'Please choose a weekday.' };
return { ok: true };
```

**HTTP status conventions:**
- `400` — bad input (missing/malformed params)
- `401` — missing or invalid auth token
- `403` — authenticated but forbidden (e.g., HMAC token mismatch)
- `405` — wrong HTTP method
- `410` — intentionally retired endpoint
- `429` — rate limit exceeded
- `500`/`502` — unexpected server failures (used sparingly; 502 for missing DB migrations)

## CORS Pattern

Every public endpoint defines its own local `ALLOWED_ORIGINS` array and a local `setCors()` function. Admin endpoints import `setAdminCors` from `api/_lib/admin-auth.js`. There is no shared CORS middleware.

Public endpoints (`api/book.js`, `api/contact.js`):
```javascript
const ALLOWED_ORIGINS = [
  'https://30dayramp.com',
  'https://www.30dayramp.com',
  'https://ramped-git-main-kaisuupgrades-ship-its-projects.vercel.app',
  'http://localhost:3000',
];
function setCors(req, res, methods) { /* ... sets headers ... */ }
```

Admin endpoints: `import { setAdminCors, isAuthorized } from './_lib/admin-auth.js'`

## Authentication Pattern

All admin endpoints must call `isAuthorized(req)` from `api/_lib/admin-auth.js`. Bearer token only — no query-string fallback (removed in audit H2-5). The token compare is constant-time (`safeEqual`) to prevent timing attacks.

```javascript
import { setAdminCors, isAuthorized } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  // ...
}
```

## Input Sanitization

All public POST endpoints must use helpers from `api/_lib/validate.js`:
- `esc(s)` — HTML-escape user strings before including in email HTML
- `truncate(s, max)` — cap input length before DB write
- `isValidEmail(email)` — RFC-style check with bad-TLD blocklist
- `checkRateLimit(ip, opts)` — in-memory bucket per IP (resets on cold start)
- `getClientIp(req)` — reads `x-forwarded-for` first (Vercel proxy)

## Logging

**Framework:** `console` for transient errors; `api/_lib/logger.js` for structured agent run logs persisted to Supabase.

**Patterns:**
- `console.warn(...)` — degraded but safe conditions (missing env var, Slack down)
- `console.error(...)` — unexpected failures (Resend error, Supabase write fail)
- `logger.startRun / logger.endRun / logger.log / logger.logError` — for agent runs only (`api/questionnaire.js`, `api/admin-agents.js`)
- Log prefix pattern: `'[logger] supabase fetch error:'`, `'[admin-agents]'` — module name in brackets

**Never log:** full request bodies that include credentials or tokens.

## Supabase Client Pattern

No SDK — raw `fetch()` calls to the Supabase REST API. Each file that needs DB access defines its own local async wrapper:

```javascript
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
```

## Frontend Conventions (HTML pages)

**No build step.** `styles.css` is a pre-compiled Tailwind v4 output — treat as artifact, never hand-edit.

**Design tokens:** CSS custom properties in a per-page inline `:root {}` block. Canonical set from `CLAUDE.md`:
```css
--ink:#0B1220; --paper:#FAFAF7; --line:#E6E4DC; --muted:#5B6272;
--accent:#1F4FFF; --accent-2:#0B2A8C; --good:#0F7A4B; --warn:#B45309;
--surface:#F5F5F3; --ink-2:#1A2233;
```

**Required page elements (every customer-facing page):**
- `<title>`, `<meta name="description">`, `<link rel="canonical">`
- Full OG and Twitter card tags
- `<link rel="icon" href="/favicon.svg">`, `<link rel="apple-touch-icon">`
- `<link rel="stylesheet" href="/styles.css">`
- `<script defer src="/_vercel/insights/script.js">` (not on `/admin`, `/dashboard`)
- `<h1>` — heading order H1 → H2 → H3, no skipping
- Skip-to-main link at top of `<body>`
- Working mobile nav with hamburger toggle, `aria-expanded`, `aria-controls`

**CTA copy standards:**
- Primary: `"Book a discovery call →"`
- Secondary (tier-bound): `"Get started →"`
- Contact email: `jon@30dayramp.com` only

## Comments

**Inline comments:** Used liberally to explain non-obvious security decisions, audit fix references, and removed features:
```javascript
// Bearer-header auth ONLY. The previous `?token=` query-string fallback was
// removed in audit H2-5 (2026-04-29). Tokens in URLs leak via Vercel access
// logs, browser history, Referer headers...
```

**Audit references in comments:** Format `// Audit H2-5`, `// Audit C2-1` — cross-references to `AUDIT.md`.

**JSDoc:** Used on exported library functions in `api/_lib/` (e.g., `logger.js`), not on route handlers.

---

*Convention analysis: 2026-05-04*
