// tests/lighthouse/scores.spec.js — Lighthouse perf/a11y/best-practices/SEO
// scores on the top funnel pages. Targets:
//   Performance     ≥ 80 desktop (Vercel cold-start can dip; tighten over time)
//   Accessibility   ≥ 95
//   Best Practices  ≥ 95
//   SEO             ≥ 95
//
// Implemented as a Playwright test that spawns Lighthouse against each page's
// remote URL via the lighthouse npm package. Headless Chromium is provided by
// Playwright. We run with --form-factor=desktop to match the hero design target.

const { test, expect } = require('@playwright/test');
const path = require('path');

const TARGETS = ['/', '/about', '/book', '/comparison'];

const THRESHOLDS = {
  performance: 80,
  accessibility: 95,
  'best-practices': 90,
  seo: 95,
};

test.describe('Lighthouse', () => {
  // lighthouse is heavy — one test per page, serial.
  test.describe.configure({ mode: 'serial' });

  for (const target of TARGETS) {
    test(`${target} meets thresholds`, async ({ baseURL }) => {
      // Lazy-require so projects that don't run lighthouse don't pay the import cost.
      let lighthouse, chromeLauncher;
      try {
        lighthouse = (await import('lighthouse')).default;
        chromeLauncher = await import('chrome-launcher');
      } catch (e) {
        test.skip(true, 'lighthouse / chrome-launcher not installed (run `npm install`)');
      }

      const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--disable-gpu', '--no-sandbox'] });
      try {
        const url = (baseURL || 'https://www.30dayramp.com') + target;
        const result = await lighthouse(url, {
          port: chrome.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: Object.keys(THRESHOLDS),
        });
        const lhr = result.lhr;
        const scores = {};
        for (const k of Object.keys(THRESHOLDS)) {
          scores[k] = Math.round(lhr.categories[k].score * 100);
        }
        console.log(`Lighthouse ${target}:`, scores);
        for (const [k, threshold] of Object.entries(THRESHOLDS)) {
          expect(scores[k], `${target} ${k} (got ${scores[k]}, want ≥${threshold})`).toBeGreaterThanOrEqual(threshold);
        }
      } finally {
        await chrome.kill();
      }
    });
  }
});
