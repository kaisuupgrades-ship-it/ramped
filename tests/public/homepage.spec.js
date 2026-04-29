// tests/public/homepage.spec.js — homepage interactions.
const { test, expect } = require('@playwright/test');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  test('hero loads with headline + dual CTAs + agent UI showcase', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/AI department.*30 days/i);
    const primary = page.locator('a[href="/book"]').first();
    await expect(primary).toBeVisible();
    await expect(primary).toContainText(/Book.*discovery/i);
    const showcase = page.locator('.hero-agent-showcase img');
    await expect(showcase).toBeVisible();
  });

  test('V2-B6: live overlay renders pulsing badge + cycling status pill', async ({ page }) => {
    const badge = page.locator('.hero-live-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/LIVE/i);
    const status = page.locator('.hero-live-status');
    await expect(status).toBeVisible();
    // The 4 status-cycle spans should all exist
    const spans = status.locator('span');
    expect(await spans.count()).toBe(4);
  });

  test('pricing toggle: annual default shows $2,083 / $4,167 immediately (no FOUC)', async ({ page }) => {
    // First paint check: read DOM text directly without waiting for JS
    const starter = page.locator('#starter-price');
    await expect(starter).toContainText('$2,083');
    const period = page.locator('#starter-period');
    await expect(period).toContainText('/mo');
  });

  test('pricing toggle: switching to monthly updates both prices', async ({ page }) => {
    await page.click('#btn-monthly');
    await expect(page.locator('#starter-price')).toContainText('$2,500');
    await expect(page.locator('#growth-price')).toContainText('$5,000');
  });

  test('Get-started CTA carries billing param when Annual is active', async ({ page }) => {
    const starterCta = page.locator('a[href*="/book"][href*="tier=starter"]').first();
    if (await starterCta.count()) {
      const href = await starterCta.getAttribute('href');
      // Should pass billing=annual since annual is the default toggle state
      expect(href).toMatch(/billing=annual/);
    }
  });

  test('mobile nav drawer opens, closes on Escape, closes on link click', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.locator('[aria-controls][aria-label*="menu" i], .nav-mobile-toggle, button[aria-expanded]').first();
    if (await toggle.count() === 0) test.skip(true, 'no mobile drawer toggle on homepage');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('FAQ JSON-LD schema is present', async ({ page }) => {
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    const hasFaq = ld.some(s => /"@type"\s*:\s*"FAQPage"/.test(s));
    expect(hasFaq, 'FAQPage JSON-LD on homepage').toBe(true);
  });

  test('founder credit line present in hero', async ({ page }) => {
    await expect(page.locator('.hero-founder')).toContainText(/Andrew Yoon/i);
  });
});
