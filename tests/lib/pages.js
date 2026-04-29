// tests/lib/pages.js — canonical list of customer-facing pages with expected
// per-page invariants (title, h1, OG tags, etc.). Single source of truth
// imported by tests/public, tests/a11y, tests/mobile, tests/lighthouse.

const PUBLIC_PAGES = [
  { path: '/',               title: /Ramped AI/i,         h1: /AI department.*30 days/i,         requiresOg: true,  vercelInsights: true },
  { path: '/about',          title: /About.*Ramped/i,     h1: /.+/,                                requiresOg: true,  vercelInsights: true },
  { path: '/book',           title: /Book.*Ramped/i,      h1: /.+/,                                requiresOg: true,  vercelInsights: true },
  { path: '/comparison',     title: /Compare|VA/i,        h1: /.+/,                                requiresOg: true,  vercelInsights: true },
  { path: '/demo',           title: /demo|Ramped/i,       h1: /.+/,                                requiresOg: false, vercelInsights: true },
  { path: '/resources',      title: /Resources.*Ramped/i, h1: /.+/,                                requiresOg: true,  vercelInsights: true },
  { path: '/privacy',        title: /Privacy/i,           h1: /.+/,                                requiresOg: false, vercelInsights: false },
  { path: '/thanks',         title: /Thanks|booked/i,     h1: /.+/,                                requiresOg: false, vercelInsights: false },
  { path: '/questionnaire',  title: /Questionnaire|intake/i, h1: /.+/,                             requiresOg: false, vercelInsights: false },
  { path: '/one-pager',      title: /one.?pager|Ramped/i, h1: null /* known-missing per audit */,  requiresOg: false, vercelInsights: false },
  { path: '/pricing-onepager', title: /Pricing|Ramped/i,  h1: null /* known-missing per audit */,  requiresOg: false, vercelInsights: false },
  { path: '/roadmap',        title: /Roadmap|Ramped/i,    h1: /.+/,                                requiresOg: false, vercelInsights: false },
];

// Pages that MUST 200 (anything we link to from public nav/footer).
const CANONICAL_PATHS = [
  '/', '/about', '/book', '/comparison', '/demo', '/resources',
  '/privacy', '/thanks', '/one-pager', '/pricing-onepager',
  '/questionnaire', '/roadmap', '/sitemap.xml', '/robots.txt',
  '/favicon.svg', '/styles.css',
];

// Pages that should redirect (status 301/302/308).
const REDIRECTING_PATHS = [
  { from: '/dashboard',             toContains: '/admin' },
  { from: '/questionnaire-preview', toContains: '/book' },
];

// 404-able paths (must return 404 with branded /404 page).
const NOT_FOUND_PATHS = ['/this-page-does-not-exist-' + Date.now()];

module.exports = { PUBLIC_PAGES, CANONICAL_PATHS, REDIRECTING_PATHS, NOT_FOUND_PATHS };
