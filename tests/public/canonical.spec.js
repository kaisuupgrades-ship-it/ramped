// tests/public/canonical.spec.js — every canonical path 200s and is well-formed.
const { test, expect } = require('@playwright/test');
const { PUBLIC_PAGES, CANONICAL_PATHS, REDIRECTING_PATHS, NOT_FOUND_PATHS } = require('../lib/pages');

test.describe('Canonical URLs', () => {
  for (const p of CANONICAL_PATHS) {
    test(`GET ${p} returns 200`, async ({ request }) => {
      const r = await request.get(p);
      expect(r.status(), `${p} status`).toBe(200);
    });
  }
});

test.describe('Redirects', () => {
  for (const r of REDIRECTING_PATHS) {
    test(`GET ${r.from} → ${r.toContains}`, async ({ request }) => {
      const res = await request.get(r.from, { maxRedirects: 0 });
      // 301/302/308 are all valid; the destination must contain the expected substring.
      expect([301, 302, 307, 308]).toContain(res.status());
      expect(res.headers()['location'] || '').toContain(r.toContains);
    });
  }
});

test.describe('404s', () => {
  for (const p of NOT_FOUND_PATHS) {
    test(`GET ${p} returns 404 with branded /404 page`, async ({ page, request }) => {
      const r = await request.get(p);
      expect(r.status()).toBe(404);
      // Render via browser too — confirm the 404 page is the styled one
      await page.goto(p);
      await expect(page.locator('h1')).toBeVisible();
      // The branded 404 has dark theme — assert by background or a known string
      const html = await page.content();
      expect(html.toLowerCase()).toMatch(/404|not found|page not found|lost/);
    });
  }
});

test.describe('Page invariants (title, h1, og:image, vercel insights)', () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.path} has valid title + h1 + meta`, async ({ page }) => {
      await page.goto(p.path);

      const title = await page.title();
      expect(title, `${p.path} <title>`).toMatch(p.title);

      if (p.h1 !== null) {
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible();
        await expect(h1, `${p.path} <h1> text`).toContainText(p.h1);
      }

      // Always require <meta name="viewport"> for mobile sanity
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport, `${p.path} viewport meta`).toContain('width=device-width');

      // Skip-link should be the first focusable
      const skip = page.locator('.skip-link, [class*="skip"]').first();
      const skipCount = await skip.count();
      expect(skipCount, `${p.path} skip-link present`).toBeGreaterThan(0);

      if (p.requiresOg) {
        const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
        const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
        expect(ogTitle, `${p.path} og:title`).toBeTruthy();
        expect(ogImage, `${p.path} og:image`).toBeTruthy();
        expect(ogImage, `${p.path} og:image is absolute URL`).toMatch(/^https?:\/\//);
      }

      if (p.vercelInsights) {
        const insights = await page.locator('script[src*="/_vercel/insights/script.js"]').count();
        expect(insights, `${p.path} loads Vercel Insights`).toBeGreaterThan(0);
      }
    });
  }
});

test.describe('No console errors on load', () => {
  for (const p of PUBLIC_PAGES.slice(0, 6)) {  // top funnel only — others share patterns
    test(`${p.path} loads without console errors`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      // Tolerate Vercel Insights' beacon being blocked by adblock, but flag everything else
      const real = errors.filter(e => !/_vercel\/insights/i.test(e) && !/Failed to load resource.*va\.vercel-scripts/.test(e));
      expect(real, `${p.path} console errors`).toEqual([]);
    });
  }
});
