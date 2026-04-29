// playwright.config.js — Ramped AI test suite configuration.
//
// Drives 6 test groups under tests/: public, protected, api, a11y, mobile, lighthouse.
// Default BASE_URL targets the production deployment; switch via env var to a
// preview deploy or `vercel dev` localhost.
//
// Run:     npm test                       — full suite
// Run:     npm run test:public            — public pages only
// Run:     npm run test:api               — API smoke only (no browser)
// Run:     npm run test:a11y              — axe-core scans
// Run:     npm run test:mobile            — mobile viewports
// Run:     npm run test:lighthouse        — Lighthouse perf + a11y + SEO scores
// Headed:  npm test -- --headed
// Report:  npx playwright show-report
//
// Required env vars for protected tests:
//   ADMIN_TOKEN       — for /api/admin and /admin browser tests
//   MAP_LINK_SECRET   — for portal HMAC token generation in tests/lib/portal-token.js
// Optional:
//   BASE_URL          — default https://www.30dayramp.com

const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'https://www.30dayramp.com';

module.exports = defineConfig({
  testDir: './tests',
  // Per-test timeout. Lighthouse needs longer.
  timeout: 60_000,
  // Run tests in parallel within a file but not across files (Vercel rate-limit
  // on public POST endpoints is 5 req/min/IP).
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Identify ourselves so Vercel access logs show test traffic distinctly.
    userAgent: 'RampedAI-PlaywrightSuite/1.0 (+e2e)',
    extraHTTPHeaders: {
      'X-Ramped-Test': '1',
    },
  },
  projects: [
    {
      name: 'public-desktop',
      testDir: 'tests/public',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'protected-desktop',
      testDir: 'tests/protected',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'api',
      testDir: 'tests/api',
      // No browser — Playwright's request fixture only.
      use: { baseURL: BASE_URL },
    },
    {
      name: 'a11y',
      testDir: 'tests/a11y',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-iphone',
      testDir: 'tests/mobile',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'mobile-pixel',
      testDir: 'tests/mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-ipad',
      testDir: 'tests/mobile',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'lighthouse',
      testDir: 'tests/lighthouse',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      timeout: 180_000,
    },
  ],
});
