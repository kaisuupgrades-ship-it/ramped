# tests/ — Ramped AI Playwright suite

Production-ready end-to-end coverage for `30dayramp.com`. Targets the live deploy by default; flip `BASE_URL` for previews or `vercel dev`.

## One-time setup

```bash
npm install
npm run test:install         # downloads Chromium for Playwright
```

## Run

```bash
npm test                     # full suite (browsers + API + a11y + mobile + lighthouse)
npm run test:public          # public pages only (no auth required)
npm run test:api             # API smoke tests (no browser, fastest)
npm run test:protected       # admin + portal flows (needs ADMIN_TOKEN, MAP_LINK_SECRET)
npm run test:a11y            # axe-core scans on every public page
npm run test:mobile          # iPhone 12 + Pixel 5 + iPad Mini viewports
npm run test:lighthouse      # Lighthouse perf/a11y/best-practices/SEO scores
npm run test:smoke           # legacy bash smoke (scripts/e2e-test.sh)
npm run verify               # tokens + fonts + api + public — fastest pre-commit gate
npm run test:report          # open the HTML report from the most recent run
```

## Required env vars

| Var | Used by | Required for | Generate |
|-----|---------|--------------|----------|
| `BASE_URL` | every test | optional — defaults to `https://www.30dayramp.com` | — |
| `ADMIN_TOKEN` | tests/protected/admin-flow + tests/api/admin-endpoints | admin-page tests; otherwise the suite skips them | the same token used for `/admin` |
| `MAP_LINK_SECRET` | tests/protected/portal-flow + tests/api/portal-endpoints | portal-token tests; otherwise the suite skips them | the production secret (not committed) |
| `CI` | playwright.config.js | retries + 1-worker mode in CI | set automatically by GitHub Actions / Vercel Build |

If you skip the protected suite entirely (no admin/portal env), `npm run test:public && npm run test:api` covers ~80% of regressions and runs in <60s.

## Layout

```
tests/
├─ lib/
│  ├─ pages.js          single source of truth for canonical URLs + invariants
│  └─ portal-token.js   HMAC token generator (mirrors api/_lib/map-token.js)
├─ public/              homepage / book / about / comparison / resources
├─ protected/           /admin auth + /portal HMAC flow
├─ api/                 every API endpoint smoke + auth gating
├─ a11y/                axe-core scans (WCAG 2.1 AA, color-contrast deferred)
├─ mobile/              iPhone 12 / Pixel 5 / iPad Mini overflow + nav drawer
└─ lighthouse/          perf ≥80, a11y ≥95, BP ≥90, SEO ≥95 on top funnel pages
```

## What each suite catches

- **public/** — hero renders, pricing toggle FOUC fixed, mobile drawers work, OG/canonical/Insights present, no console errors.
- **protected/** — admin auth gate works, bad token rejected, dialog accessibility (Audit V2-A5), portal HMAC gate enforced.
- **api/** — every endpoint returns expected status, IDOR is patched (403/503 on unsigned), cron endpoints reject unauth (Audit C2-1, H2-2), Stripe webhook rejects bad signatures, rate limiter responds.
- **a11y/** — fails on any `serious`/`critical` violation. `moderate`/`minor` reported but not blocking.
- **mobile/** — fails on horizontal overflow > 4px or missing hero/h1.
- **lighthouse/** — fails if Performance < 80, A11y < 95, BP < 90, SEO < 95 on `/`, `/about`, `/book`, `/comparison`.

## Adding a new page

1. Add it to `tests/lib/pages.js` (`PUBLIC_PAGES` + `CANONICAL_PATHS`).
2. Public/a11y/mobile suites pick it up automatically.
3. If it has unique interactions, add a `tests/public/<page>.spec.js`.

## CI integration (when ready)

- GitHub Actions: a workflow that runs `npm run verify` on every PR and `npm test` on push to `main`.
- Vercel: post-deploy hook that runs `BASE_URL=$VERCEL_URL npm run test:smoke` on each preview deploy.

## Test-data hygiene

- Public booking tests create real bookings with email `qa-{timestamp}@ramped-qa.invalid` — the `.invalid` TLD is reserved by RFC 6761 so no real address is ever bombed.
- Tests auto-clean via `/api/admin-delete` when `ADMIN_TOKEN` is set; otherwise they log a warning and leave the booking for manual cleanup (filter admin by email).

## Audit traceability

Each test that exists specifically to verify an audit fix tags the audit ID in its name or comment:

- `Audit C2-1` → cron auth (tests/api/public-endpoints.spec.js)
- `Audit H2-2` → User-Agent spoof (tests/api/public-endpoints.spec.js)
- `Audit H2-5` → query-string fallback removed (tests/api/admin-endpoints.spec.js)
- `Audit V2-A5` → confirmDialog accessibility (tests/protected/admin-flow.spec.js)
- `Audit V2-A7` → portal welcome banner is flat ink (tests/protected/portal-flow.spec.js)
- `Audit V2-A8` → admin auth label (tests/protected/admin-flow.spec.js)
- `Audit V2-B6` → live overlay on hero (tests/public/homepage.spec.js)

