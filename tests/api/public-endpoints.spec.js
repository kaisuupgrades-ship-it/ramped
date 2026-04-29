// tests/api/public-endpoints.spec.js — every public API endpoint, smoke test.
const { test, expect } = require('@playwright/test');

const TODAY = new Date().toISOString().slice(0, 10);

test.describe('Public APIs (no auth required)', () => {
  test('GET /api/book?date=YYYY-MM-DD returns {booked:[]}', async ({ request }) => {
    const r = await request.get(`/api/book?date=${TODAY}`);
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.booked)).toBe(true);
  });

  test('GET /api/book?date=invalid returns 400', async ({ request }) => {
    const r = await request.get('/api/book?date=not-a-date');
    expect(r.status()).toBe(400);
  });

  test('GET /api/availability returns days_available', async ({ request }) => {
    const r = await request.get('/api/availability');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j.days_available)).toBe(true);
    expect(j.days_available).toContain('Mon');
  });

  test('GET /api/resources returns array', async ({ request }) => {
    const r = await request.get('/api/resources');
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(Array.isArray(j)).toBe(true);
  });

  test('GET /api/generate-map returns 410 (intentionally retired)', async ({ request }) => {
    const r = await request.get('/api/generate-map');
    expect(r.status()).toBe(410);
  });

  test('POST /api/contact happy path (rate-limit-aware)', async ({ request }) => {
    const r = await request.post('/api/contact', {
      data: { name: `QA ${Date.now()}`, email: `qa-contact-${Date.now()}@ramped-qa.invalid` },
    });
    // 200 OK on first hit; 429 if a previous test exhausted the bucket
    expect([200, 429]).toContain(r.status());
  });
});

test.describe('Audit-fix verification: IDOR is patched', () => {
  test('GET /api/get-map?id=<random UUID> without token → 403/400', async ({ request }) => {
    const r = await request.get('/api/get-map?id=00000000-0000-0000-0000-000000000000');
    expect([400, 403, 503]).toContain(r.status()); // 400 for unsigned, 403 if signed-but-invalid, 503 if MAP_LINK_SECRET unset
  });
  test('GET /api/get-roadmap?id=<random UUID> without token → 403/400', async ({ request }) => {
    const r = await request.get('/api/get-roadmap?id=00000000-0000-0000-0000-000000000000');
    expect([400, 403, 503]).toContain(r.status());
  });
});

test.describe('Cron endpoints reject unauth (Phase 1 audit C2-1, H2-2)', () => {
  test('GET /api/reminders without auth → 401', async ({ request }) => {
    const r = await request.get('/api/reminders');
    expect(r.status(), 'cron reminders must reject unauth').toBe(401);
  });
  test('GET /api/weekly-digest without auth → 401', async ({ request }) => {
    const r = await request.get('/api/weekly-digest');
    expect(r.status(), 'cron weekly-digest must reject unauth').toBe(401);
  });
  test('GET /api/weekly-digest with spoofed UA → still 401 (audit H2-2)', async ({ request }) => {
    const r = await request.get('/api/weekly-digest', {
      headers: { 'User-Agent': 'vercel-cron/1.0' },
    });
    expect(r.status(), 'UA spoof must NOT bypass auth').toBe(401);
  });
});
