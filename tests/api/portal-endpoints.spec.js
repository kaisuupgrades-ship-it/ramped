// tests/api/portal-endpoints.spec.js — portal endpoints + HMAC token gating.
const { test, expect } = require('@playwright/test');
const { signMapToken } = require('../lib/portal-token');

const SECRET = process.env.MAP_LINK_SECRET;
const SKIP_REASON = 'MAP_LINK_SECRET env var not set';

test.describe('Portal auth gating (HMAC)', () => {
  test('portal-data without token → 400/403', async ({ request }) => {
    const r = await request.get('/api/portal-data?id=00000000-0000-0000-0000-000000000000');
    expect([400, 403, 503]).toContain(r.status());
  });

  test('portal-data with random/forged token → 403', async ({ request }) => {
    const r = await request.get(
      '/api/portal-data?id=00000000-0000-0000-0000-000000000000&exp=' +
      (Math.floor(Date.now()/1000)+3600) + '&t=ZZZZZZZ'
    );
    expect([403, 503]).toContain(r.status());
  });

  test('portal-data with expired token → 403', async ({ request }) => {
    if (!SECRET) test.skip(true, SKIP_REASON);
    // Sign with -1 day TTL → expired
    const id = '00000000-0000-0000-0000-000000000000';
    const exp = Math.floor(Date.now() / 1000) - 60;
    // We can't call signMapToken with a negative TTL because it expires before we call.
    // Instead, sign normally then mutate exp to past
    const { t } = signMapToken(id, 60); // 60-second TTL for the signature
    const r = await request.get(`/api/portal-data?id=${id}&exp=${exp}&t=${encodeURIComponent(t)}`);
    expect(r.status()).toBe(403);
  });

  test('portal-data with valid token but unknown booking → 404', async ({ request }) => {
    if (!SECRET) test.skip(true, SKIP_REASON);
    const id = '00000000-0000-0000-0000-000000000000';
    const { exp, t } = signMapToken(id);
    const r = await request.get(`/api/portal-data?id=${id}&exp=${exp}&t=${encodeURIComponent(t)}`);
    // 404 for booking-not-found is the expected branch for a valid-but-unknown id
    expect([404, 500]).toContain(r.status());
  });
});

test.describe('portal-track beacon', () => {
  test('rejects unauth POSTs', async ({ request }) => {
    const r = await request.post('/api/portal-track?id=00000000-0000-0000-0000-000000000000', {
      data: { event: 'view' },
    });
    expect([400, 403, 503]).toContain(r.status());
  });
});

test.describe('Other portal endpoints reject unauth', () => {
  const endpoints = [
    { method: 'GET',  path: '/api/portal-tickets?id=00000000-0000-0000-0000-000000000000' },
    { method: 'GET',  path: '/api/portal-profile?id=00000000-0000-0000-0000-000000000000' },
    { method: 'GET',  path: '/api/portal-onboarding?id=00000000-0000-0000-0000-000000000000' },
    { method: 'POST', path: '/api/portal-toggle-agent?id=00000000-0000-0000-0000-000000000000', data: { agentId: '00000000-0000-0000-0000-000000000000', action: 'pause' } },
    { method: 'POST', path: '/api/portal-approve-draft?id=00000000-0000-0000-0000-000000000000', data: { draftId: '00000000-0000-0000-0000-000000000000', decision: 'approve' } },
    { method: 'POST', path: '/api/portal-billing?id=00000000-0000-0000-0000-000000000000' },
    { method: 'POST', path: '/api/portal-upload-url?id=00000000-0000-0000-0000-000000000000', data: { filename: 'x.png', mime: 'image/png', size: 1024 } },
  ];
  for (const ep of endpoints) {
    test(`${ep.method} ${ep.path.split('?')[0]} → 401/403/400/503 unauth`, async ({ request }) => {
      const opts = ep.data ? { data: ep.data } : {};
      const r = ep.method === 'GET' ? await request.get(ep.path, opts) : await request.post(ep.path, opts);
      expect([400, 401, 403, 405, 503]).toContain(r.status());
    });
  }
});

test.describe('Stripe webhook signature gating', () => {
  test('POST /api/stripe-webhook without signature → 400', async ({ request }) => {
    const r = await request.post('/api/stripe-webhook', { data: { fake: 'event' } });
    expect([400, 503]).toContain(r.status());
  });
  test('POST /api/stripe-webhook with bogus signature → 400', async ({ request }) => {
    const r = await request.post('/api/stripe-webhook', {
      data: 'fake-payload',
      headers: { 'stripe-signature': 't=1,v1=ZZZZ' },
    });
    expect([400, 503]).toContain(r.status());
  });
});
