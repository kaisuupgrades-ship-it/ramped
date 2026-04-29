const { test, expect } = require('@playwright/test');

test('Resources page renders', async ({ page }) => {
  await page.goto('/resources');
  await expect(page.locator('h1')).toBeVisible();
});

test('Resources API returns JSON array', async ({ request }) => {
  const r = await request.get('/api/resources');
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(Array.isArray(j)).toBe(true);
});
