// tests/public/comparison.spec.js — comparison page checks.
const { test, expect } = require('@playwright/test');

test.describe('Comparison page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/comparison'); });

  test('renders headline + table', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();
  });

  test('mobile table has horizontal-scroll wrapper or reflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/comparison');
    const wrapper = page.locator('.table-scroll, [class*="scroll"]').first();
    // After mobile-audit fix, .table-scroll wrapper exists
    const wrapperCount = await wrapper.count();
    expect(wrapperCount, '.table-scroll wrapper present on mobile').toBeGreaterThan(0);
  });
});
