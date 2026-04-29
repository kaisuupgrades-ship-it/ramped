// tests/mobile/viewports.spec.js — runs on iPhone 12 / Pixel 5 / iPad Mini per the
// project mapping in playwright.config.js. Each one re-runs the same critical
// checks: page renders, hero visible, no horizontal overflow.
const { test, expect } = require('@playwright/test');
const { PUBLIC_PAGES } = require('../lib/pages');

const CRITICAL = ['/', '/about', '/book', '/comparison', '/demo'];

for (const path of CRITICAL) {
  test(`${path} renders without horizontal overflow on mobile`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle').catch(() => {});

    // No element should be wider than the viewport (signal of mobile-table or fixed-width regression).
    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 4 || r.left < -4) {
          // skip transformed/animated elements deliberately off-screen
          if (getComputedStyle(el).position === 'fixed') continue;
          if (offenders.length < 5) offenders.push({ tag: el.tagName, cls: el.className, w: r.width });
        }
      }
      return { vw, offenders };
    });
    if (overflow.offenders.length) {
      console.log(`Mobile overflow on ${path}:`, overflow);
    }
    // Allow the comparison table's intentional .table-scroll wrapper which has overflow-x:auto.
    const realOverflow = overflow.offenders.filter(o => !/table-scroll|cmp-table/.test(o.cls || ''));
    expect(realOverflow, `${path} no off-viewport elements`).toEqual([]);

    // Hero/h1 should be visible
    await expect(page.locator('h1, .hero-h1').first()).toBeVisible();
  });
}

test('comparison page mobile: .table-scroll wrapper exists', async ({ page }) => {
  await page.goto('/comparison');
  expect(await page.locator('.table-scroll, [class*="scroll"]').first().count()).toBeGreaterThan(0);
});

test('about page mobile: hamburger nav drawer toggle exists', async ({ page }) => {
  await page.goto('/about');
  const toggle = page.locator('button[aria-expanded]').first();
  expect(await toggle.count()).toBeGreaterThan(0);
});
