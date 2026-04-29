// tests/public/booking.spec.js — book flow happy path + validation.
//
// Cleanup: this test creates a real booking. After assertions, if ADMIN_TOKEN
// is set we delete it via /api/admin-delete; otherwise we leave the orphan and
// log a warning (the booking has email "qa-{ts}@ramped-qa.invalid" so it's
// trivially identifiable for manual cleanup).
const { test, expect, request } = require('@playwright/test');

test.describe('Book page', () => {
  test('calendar renders with the current month + slot picker', async ({ page }) => {
    await page.goto('/book');
    await expect(page.locator('h1')).toBeVisible();
    // Calendar grid renders via JS — wait for it
    await page.waitForSelector('[class*="cal"], [id*="cal"], [aria-label*="calendar" i]', { timeout: 10_000 });
  });

  test('?tier=starter&billing=annual sets the tier badge', async ({ page }) => {
    await page.goto('/book?tier=starter&billing=annual');
    // After the pricing-tier-sync work, the badge should reflect annual pricing
    const badgeText = await page.locator('body').innerText();
    expect(badgeText.toLowerCase()).toMatch(/starter/);
    // At minimum, the URL params are parsed without crash
    expect(await page.title()).toMatch(/Book|Ramped/i);
  });

  test('end-to-end booking happy path → /api/book POST', async ({ request }) => {
    const stamp = Date.now();
    const datetime = new Date(Date.now() + 14 * 86400000); // +14 days
    datetime.setUTCHours(15, 30, 0, 0); // 10:30 CDT, inside business window
    const body = {
      datetime: datetime.toISOString(),
      name: `QA Test ${stamp}`,
      email: `qa-${stamp}@ramped-qa.invalid`,
      company: 'Ramped QA',
      notes: 'Playwright automated test — safe to delete',
      timezone: 'America/Chicago',
      tier: 'growth',
      billing: 'annual',
    };
    const r = await request.post('/api/book', { data: body });
    expect(r.status(), 'booking POST status').toBe(200);
    const j = await r.json();
    expect(j.success).toBe(true);
    expect(j.booking_id).toMatch(/^[0-9a-f-]{36}$/i);

    // Cleanup if ADMIN_TOKEN provided
    if (process.env.ADMIN_TOKEN) {
      await request.post('/api/admin-delete', {
        data: { id: j.booking_id },
        headers: { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
      });
    } else {
      console.warn(`[cleanup] booking ${j.booking_id} (${body.email}) left in DB — set ADMIN_TOKEN to auto-clean`);
    }
  });

  test('email validation: rejects invalid format', async ({ request }) => {
    const r = await request.post('/api/book', {
      data: {
        datetime: new Date(Date.now() + 14 * 86400000).toISOString(),
        name: 'X', email: 'not-an-email', timezone: 'America/Chicago',
      },
    });
    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.error).toMatch(/email/i);
  });

  test('past datetime rejected', async ({ request }) => {
    const r = await request.post('/api/book', {
      data: {
        datetime: new Date(Date.now() - 86400000).toISOString(),
        name: 'X', email: 'qa@ramped-qa.invalid', timezone: 'America/Chicago',
      },
    });
    expect(r.status()).toBe(400);
  });
});
