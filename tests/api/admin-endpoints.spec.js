// tests/api/admin-endpoints.spec.js — admin auth + happy paths.
//
// All admin endpoints require Authorization: Bearer ${ADMIN_TOKEN}. If the env
// var isn't set we skip the suite (instead of failing) so CI in PR previews
// without secrets still goes green.
const { test, expect } = require('@playwright/test');

const TOKEN = process.env.ADMIN_TOKEN;
const SKIP_REASON = 'ADMIN_TOKEN env var not set';
const auth = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

test.describe('Admin auth gating', () => {
  test('GET /api/admin without auth → 401', async ({ request }) => {
    const r = await request.get('/api/admin');
    expect(r.status()).toBe(401);
  });
  test('GET /api/admin with bad token → 401', async ({ request }) => {
    const r = await request.get('/api/admin', { headers: { Authorization: 'Bearer wrong-token-xxx' } });
    expect(r.status()).toBe(401);
  });
  test('Audit H2-5: query-string ?token= no longer accepted', async ({ request }) => {
    if (!TOKEN) test.skip(true, SKIP_REASON);
    const r = await request.get(`/api/admin?token=${encodeURIComponent(TOKEN)}`);
    // Without the Authorization header, the query-string fallback is gone.
    expect(r.status(), 'querystring token must be rejected post H2-5').toBe(401);
  });
});

test.describe('Admin happy path', () => {
  test.skip(!TOKEN, SKIP_REASON);

  test('GET /api/admin returns bookings array + portal_links_enabled flag', async ({ request }) => {
    const r = await request.get('/api/admin', { headers: auth });
    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.configured).toBe(true);
    expect(Array.isArray(j.bookings)).toBe(true);
    // Audit verification: portal_links_enabled is set when MAP_LINK_SECRET is configured
    expect(typeof j.portal_links_enabled).toBe('boolean');
  });

  test('GET /api/agent-logs returns runs + stats', async ({ request }) => {
    const r = await request.get('/api/agent-logs', { headers: auth });
    expect([200, 502]).toContain(r.status()); // 502 if migration 006 not yet applied
    if (r.status() === 200) {
      const j = await r.json();
      expect(j.stats).toBeDefined();
      expect(typeof j.stats.total).toBe('number');
    }
  });

  test('GET /api/availability does not require auth', async ({ request }) => {
    const r = await request.get('/api/availability');
    expect(r.status()).toBe(200);
  });

  test('PUT /api/availability requires auth', async ({ request }) => {
    const r = await request.put('/api/availability', {
      data: { days_available: ['Mon','Tue','Wed','Thu','Fri'], start_hour: 9, end_hour: 17, slot_duration_min: 30, blocked_dates: [] },
    });
    expect(r.status()).toBe(401);
  });
});

test.describe('admin-update validation', () => {
  test.skip(!TOKEN, SKIP_REASON);

  test('rejects invalid status enum', async ({ request }) => {
    const r = await request.post('/api/admin-update', {
      headers: auth,
      data: { id: '00000000-0000-0000-0000-000000000000', status: 'definitely-not-a-status' },
    });
    expect(r.status()).toBe(400);
  });

  test('rejects missing id', async ({ request }) => {
    const r = await request.post('/api/admin-update', {
      headers: auth,
      data: { status: 'won' },
    });
    expect(r.status()).toBe(400);
  });
});
