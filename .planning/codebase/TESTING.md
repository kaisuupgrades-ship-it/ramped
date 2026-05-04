# Testing Patterns

**Analysis Date:** 2026-05-04

## Test Framework

**Runner:**
- Playwright `^1.47.0`
- Config: `playwright.config.js` at repo root

**Assertion Library:**
- Playwright's built-in `expect` (from `@playwright/test`)

**Accessibility:**
- `@axe-core/playwright` `^4.10.0` + `axe-core` `^4.10.0`

**Performance:**
- `lighthouse` `^12.2.0`

**Run Commands:**
```bash
npm test                  # Full suite (all projects)
npm run test:public       # Public pages (desktop Chrome)
npm run test:protected    # Protected pages (admin + portal, needs ADMIN_TOKEN)
npm run test:api          # API smoke tests (no browser)
npm run test:a11y         # axe-core accessibility scans
npm run test:mobile       # Mobile viewports (iPhone 12, Pixel 5, iPad Mini)
npm run test:lighthouse   # Lighthouse perf + a11y + SEO scores
npm run test:smoke        # curl/jq e2e bash script (needs ADMIN_TOKEN)
npm run test:report       # Open HTML report
npm run test:install      # Install Playwright + Chromium
npm run verify            # CI gate: lint:fonts + lint:tokens + test:api + test:public
```

## Test File Organization

**Location:** All tests under `tests/` directory, grouped by concern:

```
tests/
├── lib/
│   └── pages.js           # Shared page inventory + per-page invariants (single source of truth)
├── api/
│   ├── public-endpoints.spec.js   # All public API endpoints — smoke
│   ├── admin-endpoints.spec.js    # Admin auth gating + happy paths
│   └── portal-endpoints.spec.js   # Portal auth gating
├── public/
│   ├── canonical.spec.js  # All canonical URLs 200; redirects; 404s; page invariants
│   ├── homepage.spec.js   # Homepage interactions + pricing toggle
│   ├── about.spec.js
│   ├── booking.spec.js
│   ├── comparison.spec.js
│   └── resources.spec.js
├── protected/
│   ├── admin-flow.spec.js   # Admin auth screen + dashboard interactions
│   └── portal-flow.spec.js  # Portal auth + features
├── a11y/
│   └── scan.spec.js         # axe-core scan across public pages
├── mobile/
│   └── viewports.spec.js    # Mobile-specific layout checks
└── lighthouse/
    └── scores.spec.js       # Lighthouse threshold assertions
```

**Naming:** `<scope>.spec.js` — no `.test.js` convention used.

**Separation:** Tests are NOT co-located with source files. All tests live in `tests/`, all source in `api/` and HTML root files.

## Test Structure

**Suite Organization:**
```javascript
// tests are CommonJS (require/module.exports)
const { test, expect } = require('@playwright/test');

test.describe('Public APIs (no auth required)', () => {
  test('GET /api/book?date=YYYY-MM-DD returns {booked:[]}', async ({ request }) => {
    const r = await request.get(`/api/book?date=${TODAY}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.booked)).toBe(true);
  });
});
```

**Setup Pattern:**
```javascript
// beforeEach used for page navigation + auth setup
test.beforeEach(async ({ page }) => {
  await page.goto('/admin');
  await page.fill('#password-input', TOKEN);
  await page.click('#auth-btn');
  await page.waitForSelector('#dashboard', { timeout: 12_000 });
});
```

**Skip Pattern (conditional on env vars):**
```javascript
const TOKEN = process.env.ADMIN_TOKEN;
const SKIP_REASON = 'ADMIN_TOKEN env var not set';

// Suite-level skip
test.describe('Admin happy path', () => {
  test.skip(!TOKEN, SKIP_REASON);
  // ...
});

// Individual test skip
test('...', async ({ request }) => {
  if (!TOKEN) test.skip(true, SKIP_REASON);
  // ...
});
```

**Parameterized Tests (loop over page list):**
```javascript
const { PUBLIC_PAGES, CANONICAL_PATHS } = require('../lib/pages');

test.describe('Canonical URLs', () => {
  for (const p of CANONICAL_PATHS) {
    test(`GET ${p} returns 200`, async ({ request }) => {
      const r = await request.get(p);
      expect(r.status(), `${p} status`).toBe(200);
    });
  }
});
```

**Custom failure messages:** Second argument to `expect()` is used throughout:
```javascript
expect(r.status(), `${p.path} status`).toBe(200);
expect(insights, `${p.path} loads Vercel Insights`).toBeGreaterThan(0);
```

## Mocking

**Framework:** None. Tests run against live deployments.

**No mocks or stubs are used.** The test suite is entirely integration/E2E — it hits the real production (or preview) URL. There is no unit test layer and no mocking framework.

**Rate-limit awareness:** Tests that hit POST endpoints acknowledge the 5 req/min limit:
```javascript
// 200 OK on first hit; 429 if a previous test exhausted the bucket
expect([200, 429]).toContain(r.status());
```

**Flaky endpoint handling:** Some assertions accept multiple valid statuses:
```javascript
expect([200, 502]).toContain(r.status()); // 502 if migration 006 not yet applied
expect([400, 403, 503]).toContain(r.status()); // depends on MAP_LINK_SECRET config
```

## Test Data

**QA email convention:** `qa-<slug>-${Date.now()}@ramped-qa.invalid` — `.invalid` TLD is blocked by the email validator so these never accidentally send real emails.

**E2E script test data (scripts/e2e-test.sh):**
```bash
STAMP="$(date +%Y%m%d-%H%M%S)"
EMAIL="e2e-${STAMP}@ramped-qa.invalid"
NAME="E2E Test ${STAMP}"
```
The bash e2e script creates a real booking then deletes it in step 7 — fully self-cleaning.

**Shared page inventory:** `tests/lib/pages.js` is the single source of truth for page paths, expected titles, H1 patterns, OG requirements, and Vercel Insights flags. Imported by `tests/public/`, `tests/a11y/`, `tests/mobile/`, and `tests/lighthouse/`.

## Playwright Projects (6 defined in `playwright.config.js`)

| Project | Test Dir | Browser/Device | Timeout |
|---------|----------|---------------|---------|
| `public-desktop` | `tests/public` | Desktop Chrome 1440×900 | 60s |
| `protected-desktop` | `tests/protected` | Desktop Chrome 1440×900 | 60s |
| `api` | `tests/api` | None (request fixture only) | 60s |
| `a11y` | `tests/a11y` | Desktop Chrome 1440×900 | 60s |
| `mobile-iphone` | `tests/mobile` | iPhone 12 | 60s |
| `mobile-pixel` | `tests/mobile` | Pixel 5 | 60s |
| `mobile-ipad` | `tests/mobile` | iPad Mini | 60s |
| `lighthouse` | `tests/lighthouse` | Desktop Chrome 1440×900 | 180s |

**Parallelism:** `fullyParallel: false`, `workers: 1` in CI (to avoid Vercel rate limits), `workers: 2` locally.

**Retries:** `retries: 2` in CI, `retries: 0` locally.

## Test Artifacts (on failure)

- Playwright HTML report: `playwright-report/` (uploaded to GitHub Actions on failure, 7-day retention)
- JSON results: `test-results/results.json`
- Trace: `retain-on-failure`
- Screenshot: `only-on-failure`
- Video: `retain-on-failure`

## CI/CD Integration

**Workflow:** `.github/workflows/verify.yml` — runs on every PR and push to `main`.

**CI jobs (sequential dependency: lint → smoke tests):**

```
lint (fonts + tokens) [~10s]
  ↓
api-smoke (test:api vs production) [~30s]
  ↓ (runs in parallel with api-smoke)
public-playwright (test:public vs production) [~2-3 min]
```

**What CI runs:**
- `bash scripts/check-fonts.sh` — verifies font variant declarations on all HTML pages
- `bash scripts/check-tokens.sh` — checks `admin.html` and `portal.html` inline `:root` tokens against canonical palette
- `npm run test:api` — API project (public + admin auth gating, no secrets needed)
- `npm run test:public` — public-desktop Playwright project

**What CI does NOT run (explicitly documented in workflow):**
- Protected page tests (require `ADMIN_TOKEN` secret)
- Lighthouse (slow + flaky in CI)
- Mobile viewports

**BASE_URL in CI:** Hard-coded to `https://www.30dayramp.com` (production). CI tests against the live site, not a preview deployment.

## Lint Scripts (part of verify gate)

`scripts/check-fonts.sh` — scans all HTML files for correct Inter/JetBrains Mono font variant declarations.

`scripts/check-tokens.sh` — diffs `admin.html` and `portal.html` inline `:root` blocks against the canonical 13-token palette. Currently exits 0 (warn-only); drift is reported but does not block CI.

## E2E Bash Smoke Test

`scripts/e2e-test.sh` — a `curl`/`jq` script that runs a 7-step end-to-end flow:
1. GET booked slots
2. POST a test booking
3. POST questionnaire (attaches to booking)
4. GET admin view (verify booking + questionnaire visible)
5. POST admin-update (flip status)
6. GET availability
7. POST admin-delete (cleanup test booking)

Requires `ADMIN_TOKEN` env var. Documented to run against preview URLs before merging backend changes.

## What Is NOT Tested

**No unit tests exist.** There is no Jest, Vitest, or similar unit test runner. All validation logic in `api/_lib/validate.js`, auth logic in `api/_lib/admin-auth.js`, and email templating in `api/_lib/email-design.js` have zero dedicated unit tests.

**No integration tests with mocked Supabase/Resend.** All tests require live external services.

**Not covered in automated CI:**
- Admin dashboard UI interactions (requires `ADMIN_TOKEN` secret in CI)
- Portal flows
- Booking form POST happy path (rate limits prevent reliable automation)
- Email delivery verification
- Google Calendar invite creation
- Cron job behavior (`/api/reminders`, `/api/weekly-digest`)
- Stripe webhook handling (`api/stripe-webhook.js`)
- Weekly digest logic (`api/weekly-digest.js`)
- LLM questionnaire processing (`api/questionnaire.js`)

**Known test gap documented in codebase:** `tests/protected/admin-flow.spec.js` line 47-50 documents a known regression target (token written to `localStorage` before validation) — the test currently passes a warning, not a failure, until the fix lands.

---

*Testing analysis: 2026-05-04*
