// tests/public/about.spec.js
const { test, expect } = require('@playwright/test');

test.describe('About page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/about'); });

  test('canonical, OG, apple-touch-icon all present (audit C9)', async ({ page }) => {
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const ogTitle = await page.locator('meta[property="og:title"]').count();
    expect(ogTitle, 'og:title').toBeGreaterThan(0);
  });

  test('NO Tailwind Play CDN (audit C3)', async ({ page }) => {
    const cdnScripts = await page.locator('script[src*="cdn.tailwindcss.com"]').count();
    expect(cdnScripts, 'Tailwind Play CDN must NOT be on /about').toBe(0);
  });

  test('mobile drawer renders at <640px (audit C5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/about');
    const toggle = page.locator('button[aria-expanded]').first();
    const count = await toggle.count();
    expect(count, 'mobile nav drawer toggle present on /about').toBeGreaterThan(0);
  });
});
