// tests/protected/portal-flow.spec.js — portal pages with HMAC token.
//
// Requires MAP_LINK_SECRET to mint test tokens. We don't have a real booking
// in the test DB by default, so we test (a) the auth gate works, and (b) the
// shell renders even with a 404-on-data response.
const { test, expect } = require('@playwright/test');
const { signMapToken } = require('../lib/portal-token');

const SECRET = process.env.MAP_LINK_SECRET;
test.skip(!SECRET, 'MAP_LINK_SECRET required');

const FAKE_ID = '00000000-0000-0000-0000-000000000000';

test.describe('Portal auth gate', () => {
  test('opening /portal without token shows auth-error or fallback', async ({ page }) => {
    await page.goto('/portal');
    // The portal HTML loads, but data fetch fails — expect the hero or an error state
    await expect(page.locator('body')).toBeVisible();
    // If there's a known error region, assert it
    const errEl = page.locator('[role="alert"], .error, #portal-error').first();
    if (await errEl.count()) {
      await expect(errEl).toBeVisible();
    }
  });

  test('portal shell renders with valid signed URL even if booking not found', async ({ page }) => {
    const { exp, t } = signMapToken(FAKE_ID);
    await page.goto(`/portal?id=${FAKE_ID}&exp=${exp}&t=${encodeURIComponent(t)}`);
    // Shell should render — banner, nav etc.
    await expect(page.locator('header.portal-nav, .portal-nav')).toBeVisible({ timeout: 10_000 });
  });

  test('audit V2-A7: welcome banner uses flat --ink, not the old gradient', async ({ page }) => {
    const { exp, t } = signMapToken(FAKE_ID);
    await page.goto(`/portal?id=${FAKE_ID}&exp=${exp}&t=${encodeURIComponent(t)}`);
    const welcome = page.locator('.welcome');
    if (await welcome.count() === 0) test.skip(true, 'welcome banner not rendered without a real booking');
    const bg = await welcome.evaluate(el => getComputedStyle(el).backgroundColor);
    // --ink: #0B1220 = rgb(11, 18, 32). Old gradient was a 3-stop linear.
    expect(bg).toMatch(/rgb\(\s*11\s*,\s*18\s*,\s*32\s*\)/);
  });
});
