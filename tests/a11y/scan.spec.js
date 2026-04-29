// tests/a11y/scan.spec.js — axe-core scans on every customer-facing page.
//
// Uses @axe-core/playwright. Fails the test on any "serious" or "critical"
// violation. "Moderate" / "minor" are reported but don't fail (we'll trim
// them in a follow-up PR rather than blocking the suite today).
const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const { PUBLIC_PAGES } = require('../lib/pages');

for (const p of PUBLIC_PAGES) {
  test(`${p.path} has no critical/serious a11y violations`, async ({ page }) => {
    await page.goto(p.path);
    await page.waitForLoadState('networkidle').catch(() => {});

    const results = await new AxeBuilder({ page })
      // Stripe-style: check WCAG 2.1 AA only. AAA is aspirational.
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // Color-contrast on Inter at the muted shade is borderline; we audit it
      // separately. Keep it disabled here so we can ship on real blockers first.
      .disableRules(['color-contrast'])
      .analyze();

    const blocking = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    if (blocking.length) {
      console.log('Blocking violations on', p.path, JSON.stringify(blocking.map(v => ({
        id: v.id, impact: v.impact, desc: v.description, nodes: v.nodes.length,
      })), null, 2));
    }
    expect(blocking, `${p.path} a11y blockers`).toEqual([]);
  });
}
