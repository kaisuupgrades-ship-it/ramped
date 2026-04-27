# Ramped AI — Full Audit

**Audited at:** `aaff7ef` on `main` (2026-04-27, branch synced via `git pull origin main` — already up to date)
**Scope:** all 18 HTML pages, `styles.css`, 22 API route files in `api/` (incl. `_lib/`), `vercel.json`, `db/migrations/`, `scripts/e2e-test.sh`, sitemap, robots, README.
**Method:** read-only static analysis. No headless browser / Lighthouse run — recommendations are grounded in source review.

---

## Executive Summary

Strong copy and positioning; structurally fragile under the hood. The site reads as a credible "AI department in 30 days" pitch — the hero, comparison, and pricing pages are confident and well-written. **But three things would embarrass us in front of a sharp prospect:** (1) the design system is duplicated inline on every page with quiet drift, and `about.html` ships the Tailwind Play CDN — a banner explicitly forbidden in production; (2) navigation is inconsistent — `/comparison` has no mobile nav at all, six other pages link to `/about` from neither header nor footer, and the favicon falls back to a non-existent `favicon.ico` everywhere; (3) there are real backend risks — `get-map` and `get-roadmap` have IDOR (any UUID = full access, no auth, no expiry), the questionnaire attaches to "most recent booking by email" with no booking ID, and the pricing toggle on `index.html` causes a static-HTML/JS mismatch flash on first paint. None of these are showstoppers; all are fixable in a focused 1–2 day pass. The visual language is competent but generic — to feel "Stripe / Ramp / Notion premium" we need real photography, refined motion, and one consolidated component library, not 18 hand-rolled style blocks.

---

## Phase 1 — Codebase Map ✅

- 18 HTML pages, **no build step** (no `package.json`, no Tailwind config, no PostCSS).
- `styles.css` is a one-line, pre-compiled Tailwind v4 build artifact, committed as-is.
- **Only 6 of 18 pages actually link `/styles.css`** (`book`, `client-demo`, `comparison`, `index`, `privacy`, `thanks`). The other 12 are entirely self-contained inline CSS.
- 22 API files under `api/` (Vercel serverless), 1 SQL migration, 1 bash smoke test (`scripts/e2e-test.sh`).
- `vercel.json` defines security headers, CSP, cache rules, rewrites, redirects, and one cron (`/api/reminders` every 30 min).
- Hosted at `30dayramp.com` (Supabase + Resend + Google Calendar OAuth + Anthropic Claude inferred from `process.env` references).

---

## Phase 2 — Git Sync ✅

```
Branch: main
HEAD:   aaff7ef  Audit + polish about page: responsive grid, SVG icons, nav complete, COO placeholder styled
Status: up to date with origin/main
```

Recent commit cadence is healthy (20+ commits in the last few days, all small, focused, and well-titled). Recent fixes: chip double-toggle on `book.html`, JS syntax error on questionnaire, generate-map disabled with 410, contact forms replaced with book CTAs.

---

## Phase 3 — Repo Structure & Build ⚠️

| | Status |
|---|---|
| `vercel.json` security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) | ✅ Best-practice |
| Cache-Control: 1y immutable for static assets | ✅ |
| Cache-Control: must-revalidate for HTML pages | ✅ (but only the 7 listed pages — `about`, `resources`, `comparison`, `questionnaire`, etc. miss it) |
| `README.md` content | ❌ Single line: `# Ramped`. No project overview, no run instructions, no env-var inventory, no deploy doc. |
| Build pipeline | ❌ None. `styles.css` is a frozen Tailwind output — adding a single utility class anywhere requires hand-editing the minified file or a dev rebuilding Tailwind locally and committing. |
| `package.json` / lockfile | ❌ Missing. No way to pin Node version, dependency versions for `api/*`, or run scripts locally without trial-and-error. |
| `.nvmrc` / engines | ❌ Missing. |
| `/resources` rewrite in `vercel.json` | ⚠️ Missing — works because Vercel auto-strips `.html`, but every other clean URL has an explicit rewrite. Inconsistent. |
| `sitemap.xml` coverage | ❌ Lists only `/`, `/demo`, `/comparison`, `/book`. Missing: `/about`, `/resources`, `/roadmap`, `/one-pager`, `/pricing-onepager`, `/questionnaire`, `/privacy`. (The `/admin` exclusion is correct.) |
| `sitemap.xml` lastmod | ⚠️ Hardcoded `2026-04-23` — already 4 days stale. Should be auto-generated or updated on deploy. |
| `robots.txt` disallows `/admin` and `/api/` | ✅ |
| `vercel.json` redirects to-from drift | ⚠️ `/dashboard → /admin` and `/questionnaire-preview → /book` are non-permanent redirects, but those pages still exist in the repo as orphaned files. Either delete the source files or remove the redirects. |

---

## Phase 4 — HTML Quality / SEO / Meta ⚠️

| Page | Canonical | OG tags | Twitter | apple-touch-icon | JSON-LD | Vercel Insights | `<h1>` | description |
|---|---|---|---|---|---|---|---|---|
| `index.html` | ✅ | ✅ | ✅ | ✅ | ✅ (3 schemas) | ✅ | ✅ | ✅ |
| `book.html` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `comparison.html` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `about.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `resources.html` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `questionnaire.html` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `one-pager.html` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `pricing-onepager.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `privacy.html` | ✅ | partial | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `thanks.html` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `roadmap.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `map-result.html` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `404.html` | ❌ (OK, noindex) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

**Critical gaps:**

- ❌ **`about.html` has no canonical, no OG, no Twitter card, no apple-touch-icon, no JSON-LD.** A page named "About — Ramped AI" is the second-most-likely page someone shares to LinkedIn. Right now it has no preview image, no rich snippet — it'll look like a broken card.
- ❌ **`favicon.ico` is referenced by every page** (`<link rel="alternate icon" href="/favicon.ico">`) **but the file does not exist in the repo.** Older browsers and tabs that prefer ICO will hit a 404. Either drop the alternate link or generate a real `.ico`.
- ⚠️ **JSON-LD is only on `index.html` and `comparison.html`.** `/about` should have a `Person` schema for Andrew Yoon and a `BreadcrumbList`. `/book` should have an `Event` or `Service` schema. `/resources` should have `Article` schema for each resource.
- ⚠️ **Vercel Insights is only on 5 pages** (`404`, `book`, `client-demo`, `index`, `resources`). You're flying blind on `/about`, `/comparison`, `/questionnaire`, `/thanks` — the exact funnel pages where conversion data matters.
- ⚠️ Inter font weight loadout drifts page to page: `index` loads `400;500;600;700;800`, `book` loads `400;500;600;700` (no 800), `logo-concepts` loads `400;600;700;800;900` (no 500, has 900). **`roadmap.html` does not load Inter at all** — it inherits system fonts.

---

## Phase 5 — Design System / CSS Drift ❌

This is the biggest structural issue.

- ❌ **No single source of truth for design tokens.** Every page declares its own `:root { --ink, --paper, --line, --muted, --accent, ... }` block.
- ❌ **Tokens drift between pages:**
  - `--paper`: `#FAFAF7` (most pages) vs `#FAFAFA` on `about.html`
  - `--line`: `#E6E4DC` (most) vs `#E5E8EF` (`about.html`, `pricing-onepager.html`) vs `rgba(250,250,247,0.1)` (`404.html` — dark theme, OK)
  - `--surface`: `#F5F5F3` (most) vs `#F4F5F7` (`about`) vs `#F7F8FA` (`pricing-onepager`)
  - `--muted`: `#5B6272` (most) vs `#8A95A8` (`404.html`)
- ❌ **`about.html` ships `<script src="https://cdn.tailwindcss.com?plugins=typography" defer>`** — the **Tailwind Play CDN, which is explicitly NOT for production**. It's render-blocking, kills perceived speed, and ignores the existing `styles.css` artifact other pages use. **Remove on day one.**
- ⚠️ The pre-compiled `styles.css` is a single 21KB minified line. Editing it is hostile. Adding a new utility means either (a) hand-grafting it into the minified blob or (b) running Tailwind locally and re-committing — and there's no Tailwind config in the repo to do that with.
- ⚠️ **Button styling (`btn-primary`, `btn-ghost`) is duplicated inline on at least 5 pages** with subtle differences (`padding:13px 22px` here, `padding:9px 14px` there, `padding:8px 16px` on `book.html`).
- ⚠️ Footer markup is hand-copied across `index`, `book`, `about`, `comparison`, `resources` — minor diffs creeping in (about's footer is the only one with an `/about` link in it).

**Fix direction:** stand up a real Tailwind v4 build (one config file, one source CSS, output to `styles.css`). Move tokens, button classes, nav, footer into reusable include snippets. The site is small enough (18 pages) that a 1-day investment in a build step + partials erases an entire class of bugs.

---

## Phase 6 — API / Backend Security ⚠️

The backend is more thoughtful than the frontend — there's a shared `_lib/admin-auth.js` with a constant-time token comparison, a CORS allowlist that's actually used, an in-memory rate limiter, and `validate.js` HTML-escapes user input before it goes into emails. Real issues remain:

| Severity | Finding | File / Line |
|---|---|---|
| ❌ Critical | **IDOR on automation map.** `GET /api/get-map?id=UUID` returns a customer's full automation map to anyone with the UUID. No auth, no signed token, no expiry, no email-match check. UUIDs leak through email links, browser history, and `Referer` headers. | `api/get-map.js:21–31` |
| ❌ Critical | **IDOR on roadmap.** Same pattern. `GET /api/get-roadmap?id=BOOKING_UUID` returns name/company/datetime/automation_map/questionnaire. The endpoint is explicitly designed as "public" but should still be a signed/expiring URL. | `api/get-roadmap.js:25–60` |
| ❌ Critical | **Questionnaire attaches to "most recent booking by email"** — no booking ID supplied by the client. If a prospect books twice (rescheduled, or two pending bookings), the wrong record gets the questionnaire data. | `api/questionnaire.js` (find-by-email branch) |
| ⚠️ High | **Double-booking race condition.** `book.js` POST relies on Supabase returning 409 on duplicate — but only works if `bookings.datetime` has a `UNIQUE` constraint. The migration shipped (`db/migrations/001_agent_logging.sql`) only sets up `agent_runs`/`agent_logs`; the bookings constraint is not in version control. **Verify in Supabase console** and back-fill a migration. | `api/book.js`; missing migration |
| ⚠️ High | **`reminders.js` cron is not idempotent.** Window is ±15 min; cron runs every 30 min. A booking that lands at exactly the cron-edge could get a reminder twice. No `reminded_24h_at` / `reminded_1h_at` column being checked. | `api/reminders.js`, `vercel.json` cron |
| ⚠️ High | **Env var naming mismatch.** `send-followup.js` reads `ADMIN_PASSWORD`; every other admin endpoint reads `ADMIN_TOKEN` via `_lib/admin-auth.js`. One can be set in Vercel and the other left blank — silent failure. | `api/send-followup.js` |
| ⚠️ Medium | **Rate limiting is in-memory (per-instance).** Vercel scales serverless containers horizontally; an attacker can defeat the 5-req/min cap by hitting the same endpoint from different sources fast enough to land on different containers. | `api/_lib/validate.js` |
| ⚠️ Medium | **Anthropic API key passed to `api.anthropic.com` from `questionnaire.js`** — fine, but the prompt is built by string-interpolating booking + questionnaire data without sanitization. Low risk because Claude returns enforced JSON, but defense-in-depth: pass user data as a separate user-role message, not interpolated into the system prompt. | `api/questionnaire.js` |
| ✅ | CSP, HSTS, Referrer-Policy, Permissions-Policy headers in `vercel.json`. | `vercel.json` |
| ✅ | Constant-time token comparison; CORS allowlist; admin endpoints all check auth. | `api/_lib/admin-auth.js` |
| ✅ | `generate-map.js` correctly returns 410 Gone (intentionally disabled). | |
| ✅ | RLS enabled on `agent_runs` / `agent_logs`. | `db/migrations/001_agent_logging.sql` |

---

## Phase 7 — Performance & Assets ⚠️

| | Status |
|---|---|
| Total uncompressed page weight | `client-demo.html` 136KB · `admin.html` 88KB · `index.html` 60KB. ⚠️ Heavy for static HTML. |
| `og-image.png` | ❌ **5KB.** Standard Open Graph images at 1200×630 are 50–200KB. This image is almost certainly low-resolution or near-empty. Will look bad when shared on Slack / LinkedIn / iMessage. |
| `apple-touch-icon.png` | ⚠️ 1.5KB. Should be 180×180 with real visual weight. Currently nearly blank. |
| `favicon.svg` | ✅ 404 bytes — fine. |
| `xtractordepot-logo.jpg` | ✅ 7.9KB JPG. Could be WebP for ~30% smaller, but not urgent. |
| Inline `<style>` blocks per page | ⚠️ Most pages duplicate ~50–150 lines of CSS that could be moved to `styles.css` — hurts cache reuse across pages. |
| Google Fonts loaded via `<link>` | ⚠️ Every page loads Inter 400+500+600+700+800 + JetBrains Mono 400+500. Could `font-display: swap` and self-host to remove the third-party round-trip. |
| `defer` on Vercel Insights | ✅ |
| Tailwind Play CDN on `about.html` | ❌ Adds ~280KB JS that runs on every page view. **Remove.** |
| Image lazy-loading | ✅ The one image (`xtractordepot-logo.jpg`) uses `loading="lazy"` and `decoding="async"`. |

---

## Phase 8 — Accessibility ⚠️

| | Status |
|---|---|
| `lang="en"` on all pages | ✅ |
| Skip-to-main link on `index.html`, `book.html`, `comparison.html` | ✅ |
| Skip-to-main link missing on `about.html`, `questionnaire.html`, `resources.html`, etc. | ⚠️ |
| `aria-label`, `aria-controls`, `aria-expanded` on mobile nav toggle (`index.html`) | ✅ Excellent. |
| **Mobile nav drawer** | ❌ Only `index.html`, `book.html`, `resources.html` have a working mobile drawer. **`comparison.html` mobile shows ONLY the "Get started" CTA** — Demo, VA-vs-AI, all hidden. **`about.html` mobile shows nothing** — the entire nav is `hidden sm:flex` with no mobile alternative. |
| Heading hierarchy | ⚠️ `<h1>` missing on `one-pager.html`, `pricing-onepager.html`, `map-result.html` (customer-facing pages — they should have at least one). |
| Focus rings | ✅ `:focus-visible` styled with accent-color outline on most pages. |
| Form labels + errors | ✅ `book.html` form has labels, `aria-invalid`, `role="alert"`, `aria-live="polite"`. Best-in-class for a hand-rolled form. |
| Color contrast | ⚠️ `--muted: #5B6272` on `--paper: #FAFAF7` is ~5.7:1 — passes AA for body text but fails AAA. Acceptable. The `404.html` `--muted: #8A95A8` on dark `--ink` is ~5.4:1 — also passes AA. |
| Image alt text | ✅ The single `<img>` has alt text. |
| `aria-hidden="true"` on decorative SVGs | ✅ Consistently applied. |
| `prefers-reduced-motion` | ❌ Ticker animation on `index.html`, hover-lift transforms, count-up animation — none honor reduced-motion. Easy fix. |

---

## Phase 9 — Cross-Page Consistency ❌

This is where most of the embarrassing bugs live.

### Navigation
- ❌ `/about` link is in nav of **only** `index.html` and `about.html`. **`book`, `comparison`, `resources`, `client-demo` all link past About entirely.**
- ❌ `comparison.html` mobile nav is broken: no hamburger, no drawer, just one CTA.
- ❌ `about.html` mobile shows no nav at all.
- ⚠️ Footer's About link is missing from `index`, `book`, `comparison` footers (only `about.html` and `resources.html` footers include it).

### Email contact drift
- `jon@30dayramp.com` — primary, used on 14 pages ✅
- `hello@30dayramp.com` — `map-result.html` line 783 ❌ **inconsistent**
- `preview@30dayramp.com` — `questionnaire-preview.html` (likely intentional placeholder) ⚠️
- Demo / fictional emails on `client-demo.html` — ✅ scoped to fake data.

### Pricing display drift
| Source | Starter shown | Growth shown |
|---|---|---|
| `index.html` (annual default) | $2,083/mo | $4,167/mo |
| `index.html` (monthly toggle) | $2,500/mo | $5,000/mo |
| `book.html` tier badge | $2,500/mo (always) | $5,000/mo (always) |
| `comparison.html` | "From $2,500/mo + $2,500 onboarding" | (3-yr math: $92,500) |
| `one-pager.html` | $2,500/mo + $2,500 onboarding | $5,000/mo + ? |
| `pricing-onepager.html` | $2,500/mo (annual: $2,083/mo) | $5,000/mo (annual: $4,167/mo) |

A prospect on `index.html` defaulted to **annual** sees $2,083/mo and clicks "Get started → /book?tier=starter". The booking page's tier badge says `Starter · $2,500/mo`. They wonder why the price went up. **This is a conversion-killer.**

### CTA copy drift
- "Book a discovery call" / "Book a free 30-min call" / "Book a free 30-minute discovery call" / "Get started" / "Let's talk" — at least 5 variants for the same primary CTA.
- "Watch a live agent demo →" / "See it in action →" / no demo CTA on `/about` — inconsistent.

### Pricing toggle FOUC bug
`index.html` line 529 renders static HTML with `<span id="starter-period">/yr</span>`. JS calls `setBilling(true)` on load and overwrites this to `/mo`. Until the JS runs, users see "$2,083/yr" — which is **wildly wrong** (no plan is $2,083/year). On a slow phone or with JS blocked, this is the price they see. ❌

---

## Phase 10 — Visual / UX / Conversion ⚠️

Treating the site against a Stripe / Ramp / Notion bar:

### What's working
- ✅ Hero copy is sharp: *"Your AI department, live in 30 days."* — clear, time-bounded, ownable.
- ✅ Pricing-with-guarantee block is unusually direct ("If your AI agent isn't live in 30 days, you get a full refund. No questions, no partial payments, no fine print.") — that's premium-tier confidence.
- ✅ The VA-vs-AI comparison page is genuinely useful, not filler.
- ✅ Comparison table layout is readable. The 3-year math callout is good.
- ✅ Booking flow (calendar → slots → form → confirmation → questionnaire) is genuinely well-built. Best part of the site.
- ✅ FAQ + JSON-LD `FAQPage` schema = good for Google rich results.

### What's holding it back from "expensive"
- ❌ **No real photography anywhere.** Stock SVG icons in pain-icon tiles, gradient placeholder for Andrew's headshot on `about.html`, ghost silhouette for the COO. Stripe / Ramp / Notion all use real photography or commissioned illustration. Right now the visual feel is "competent indie SaaS," not "premium" — exactly the gap the brief calls out.
- ❌ **Single testimonial.** One quote from Xtractor Depot is the entire social-proof pillar of the site. For a $2,500–5,000/mo product, that's thin. Need 3–5 named testimonials with photos, ideally one video.
- ⚠️ **Numbers smell aggregated from a sample of one.** "Avg. $12,000+/mo saved" and "5× avg. ROI year 1" are repeated in the hero stats, ticker, and about page. If the only completed deployment is Xtractor Depot, "average" is misleading. Either add provenance ("based on XYZ deployments") or soften to projected/illustrative.
- ⚠️ **"Verified" badges next to case-study metrics on `about.html`** — green chips next to "14 hrs/wk", "4h → 8m", "Zero" — with no source link. Trust theater. Either link to a one-page case study PDF or remove the badges.
- ⚠️ **Hero has no image, no diagram, no product shot.** Just text + a CTA card. Compare to Ramp.com — every fold has a product shot or animation. The grid background is well-executed but it's not a substitute for showing the thing.
- ⚠️ **Industry pill row** on `index.html` ("Healthcare · Legal · Real Estate · Dental · Field Services · Logistics · Cannabis · Finance") is a list of 8 industries with no proof Ramped has shipped to any of them other than industrial supply. Risky if a prospect's industry is on the list.
- ⚠️ **Ticker scrolls 6 stats indefinitely** — premium sites use scrolling text sparingly. Feels like it's hiding the lack of logos.
- ⚠️ **`about.html` "Co-Founder · COO — Coming soon" placeholder card** is honest but visually loud — a dashed border + plus icon + "We're growing the team. More to come here soon." A prospect seeing "1 founder + a placeholder" can read this as either authentic or unstaffed. Either move to a "Founder + advisors" framing or hide until filled.
- ⚠️ **OG image is 5KB.** Every social share will have a low-res preview.
- ⚠️ **No keyboard shortcut for slot selection** in the booking calendar. Prospects who tab through forms (and prospects' lawyers, who do this professionally) will notice.
- ⚠️ **Empty states** — `resources.html` skeleton placeholders are good. But what does the page look like on a fresh deploy where the cron hasn't populated `ai_resources` yet? Worth checking.
- ❌ **Andrew's bio mentions "SpaceX and Lucid Motors" as Xtractor Depot clients.** If verifiable — fantastic, lead with it on the homepage. If not — high legal/credibility risk, especially on a page with "Verified" badges. **Confirm this claim is litigation-proof or remove it.**

### Mobile-specific
- ❌ `comparison.html` mobile nav is one CTA. From `/comparison` on a phone, the only path forward is `/book` — no `/`, no `/demo`, no `/about`.
- ❌ `about.html` mobile has no nav at all (`hidden sm:flex` with no mobile alternative).
- ⚠️ `index.html` hero stats grid on `<480px` collapses to 2 columns with 6 items → 3 rows. Acceptable but tall.

---

## Phase 11 — Comprehensive Improvement Plan (prioritized)

### ❌ Critical — fix this week (could hurt revenue or credibility)

| # | Finding | File:line | Fix |
|---|---|---|---|
| C1 | IDOR on `get-map` and `get-roadmap` — any UUID = full read | `api/get-map.js:21–31`, `api/get-roadmap.js:25–60` | Require a signed token query param (`?id=UUID&t=HMAC(UUID,SECRET,exp)`). Reject if HMAC invalid or expired. Add `expires_at` to returned objects. |
| C2 | Questionnaire attaches to "most recent booking by email" | `api/questionnaire.js` find-by-email branch | Pass `booking_id` from the `book.html` flow and require it server-side. Remove the email-only fallback. |
| C3 | Tailwind Play CDN on `about.html` | `about.html:10` | Delete the script tag. Replace any Tailwind utility classes with the same CSS variables / inline styles the rest of the site uses, **or** stand up the Tailwind build (item M1). |
| C4 | `comparison.html` has no mobile nav | `comparison.html:120–124` | Copy the mobile-nav-drawer block from `index.html`. |
| C5 | `about.html` mobile shows no nav | `about.html:89–96` | Same — add mobile drawer. |
| C6 | Pricing toggle FOUC: static `/yr` flashes before JS swaps to `/mo` | `index.html:529, 565` | Render the annual values directly in HTML (`$2,083/mo`), not `/yr`. Move the toggle initial state into the markup, not the JS. |
| C7 | Pricing mismatch between annual default on home and tier badge on `/book` | `book.html:366` | Change `tierLabels` to read the URL `?tier=` AND `?billing=annual\|monthly`, and pass `billing=annual` from the homepage CTAs. Match the displayed price to whatever the user clicked from. |
| C8 | `favicon.ico` referenced everywhere but file doesn't exist | every HTML page (`<link rel="alternate icon" href="/favicon.ico">`) | Generate a real `.ico` (multi-resolution: 16/32/48) from `favicon.svg`, commit to root. Or remove the `alternate icon` line. |
| C9 | `about.html` missing canonical, OG, Twitter, apple-touch-icon, JSON-LD | `about.html:1–17` | Copy the meta block from `index.html`, swap URL/title/description. Add `Person` JSON-LD for Andrew. |
| C10 | OG image is 5KB | `og-image.png` | Replace with a 1200×630 PNG ≈ 80–150KB. Include logo + tagline + "Live in 30 days." Ideally a designer's asset, not a screenshot. |
| C11 | Verify "SpaceX / Lucid Motors as Xtractor Depot clients" claim | `about.html:148` | If verifiable: add proof (LinkedIn screenshot, customer logo with permission). If not: remove from copy. |

### ⚠️ High — fix this sprint

| # | Finding | File:line | Fix |
|---|---|---|---|
| H1 | Email inconsistency (`hello@` vs `jon@`) | `map-result.html:783` | Replace `hello@30dayramp.com` with `jon@30dayramp.com`. |
| H2 | `/about` link missing from nav on `book`, `comparison`, `resources`, `client-demo` | each page's `<nav>` | Add `<a href="/about">About</a>` to each nav, between Demo and Comparison. Same in footers. |
| H3 | `reminders.js` cron not idempotent | `api/reminders.js`, schema | Add `reminded_24h_at`, `reminded_1h_at` `timestamptz` columns to `bookings`. Skip if already set. |
| H4 | `ADMIN_PASSWORD` vs `ADMIN_TOKEN` env-var split | `api/send-followup.js:8, 61` | Replace with `isAuthorized(req)` import from `_lib/admin-auth.js`. |
| H5 | Sitemap missing `/about`, `/resources`, `/roadmap`, `/questionnaire`, `/privacy`, `/one-pager` | `sitemap.xml` | Add entries; auto-stamp `lastmod` from CI. |
| H6 | Vercel Insights missing on `about`, `comparison`, `questionnaire`, `thanks`, `privacy` | each `<head>` | Add `<script defer src="/_vercel/insights/script.js"></script>`. |
| H7 | JSON-LD missing on `/about`, `/book` | `about.html`, `book.html` | Add `Person` (Andrew) on `/about`, `Service` + `Offer` on `/book`. |
| H8 | Skip-link missing on `about`, `questionnaire`, `resources`, `one-pager`, `pricing-onepager` | each `<body>` start | Add `<a href="#main" class="skip-link">Skip to main content</a>` and matching `#main` target. |
| H9 | `prefers-reduced-motion` not honored | `index.html` ticker, all `hover-lift`, count-up | Add `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }`. |
| H10 | `roadmap.html` doesn't load Inter font | `roadmap.html` `<head>` | Add the Inter `<link>` blocks. |
| H11 | Bookings table likely missing UNIQUE on `datetime` | Supabase schema | Add migration `ALTER TABLE bookings ADD CONSTRAINT bookings_datetime_unique UNIQUE (datetime);`. Commit migration to `db/migrations/`. |
| H12 | Rate-limiter is in-memory | `api/_lib/validate.js` | Migrate to Vercel KV / Upstash for distributed rate limiting before any pay-per-request endpoint hits real volume. |

### Medium — backlog

| # | Finding | Fix |
|---|---|---|
| M1 | No build pipeline; `styles.css` is a frozen Tailwind output | Stand up Tailwind v4 + `package.json` + `tailwind.config.js` + `npm run build`. Move all per-page `:root` token blocks into a single `tokens.css` import. |
| M2 | Footer / nav / `<head>` boilerplate copy-pasted across 18 pages | Move to per-route HTML partials. Easiest path without a framework: a tiny Node script in `scripts/build.js` that templates fragments at build time and writes static HTML. |
| M3 | Inter font weight loadout drift | Standardize on `400;500;600;700;800` everywhere. |
| M4 | `README.md` is a single line | Write a proper one: stack, env vars (with redacted examples), `npm install && npm run dev`, deploy notes, "where do bookings live", who-to-page. |
| M5 | `/dashboard` and `/questionnaire-preview` files exist but are redirected | Delete the source files; let the redirect 404 to be safe. |
| M6 | `client-demo.html` is 136KB | Split off the per-industry demos into separate routes lazy-loaded on click. |
| M7 | "Verified" badges on `/about` case-study metrics with no source | Either link to a downloadable case study or remove the chip. |
| M8 | Single testimonial as social proof | Land 2 more named testimonials in next 30 days. Aim for 1 video. |
| M9 | Industry pill row implies broader deployment than is real | Either ship one shadow case study per industry or trim list to "Manufacturing · Industrial Supply · Field Services" + "and more on request". |
| M10 | Self-host or `font-display: swap` on Google Fonts | Reduces initial render block. |
| M11 | `og-image.png` reused across all pages | Per-page OG images for top 4 pages would lift CTR on social. |

### Low — polish

| # | Finding | Fix |
|---|---|---|
| L1 | Ticker can be paused with hover but not keyboard-stopped | Add `@media (hover:none)` to disable, or a pause button. |
| L2 | Background grid uses `linear-gradient(...)` with `1px` lines — at 2x dpi can look fuzzy | Use SVG pattern or test on a Retina display. |
| L3 | `404.html` doesn't link to `/book` or `/comparison` | Add a secondary CTA: "Or book a discovery call →". |
| L4 | `xtractordepot-logo.jpg` could be WebP | Saves ~3KB. |
| L5 | OAuth callback HTML reflects `error` query param | HTML-escape (`api/google-oauth-callback.js:16`). |
| L6 | `vercel.json` redirects `/dashboard → /admin` are non-permanent | Mark `permanent: true` once you're sure no one bookmarks `/dashboard`. |

---

## Final Output

### Top 5 Actions to Implement Immediately

1. **Patch the IDOR.** Add a signed, expiring token requirement on `/api/get-map` and `/api/get-roadmap`. Generate the token in `api/questionnaire.js` when the map is created and embed it in the customer email. Today.
2. **Kill the Tailwind Play CDN on `about.html`.** Replace its Tailwind classes with inline styles matching the rest of the site, then add the missing meta block (canonical, OG, Twitter, apple-touch-icon, Vercel Insights, mobile nav drawer). Today.
3. **Fix the pricing FOUC + tier-badge mismatch.** Render `$2,083/mo` directly in `index.html` markup. Pass `?billing=annual|monthly` through to `/book` and have `tierLabels` read it. Today.
4. **Add mobile nav to `comparison.html` and `about.html`.** Copy the working drawer pattern from `index.html`. Add `/about` to every primary nav and footer. Today.
5. **Replace `og-image.png` with a real 1200×630 share asset, generate a real `favicon.ico`, and verify the SpaceX/Lucid claim before next prospect call.** This week.

### Step-by-Step Implementation Plan

1. **Branch.** `git checkout -b audit-2026-04-27`.
2. **Critical batch (1 PR):**
   - Patch IDOR (C1).
   - Replace `tierLabels` and homepage `/yr` static markup (C6, C7).
   - Add mobile nav to `comparison.html`, `about.html` (C4, C5).
   - Add full meta block to `about.html` (C9).
   - Remove Tailwind CDN from `about.html` (C3).
   - Fix `hello@` → `jon@` on `map-result.html` (H1).
   - Add `/about` to every primary nav and footer (H2).
3. **Asset batch (1 PR):**
   - New `og-image.png` (1200×630, ~120KB).
   - New `favicon.ico` (multi-res from `favicon.svg`).
   - New `apple-touch-icon.png` (180×180).
   - Sitemap rebuilt with all canonical pages and current `lastmod` (H5).
4. **Backend batch (1 PR):**
   - Bookings UNIQUE migration (H11).
   - Reminders idempotency columns + check (H3).
   - `send-followup` to use shared `isAuthorized` (H4).
   - Questionnaire `booking_id` enforcement (C2).
5. **A11y / SEO batch (1 PR):**
   - Vercel Insights everywhere (H6).
   - JSON-LD on `/about` and `/book` (H7).
   - Skip-links across remaining pages (H8).
   - `prefers-reduced-motion` (H9).
   - Roadmap loads Inter (H10).
6. **Build pipeline (separate PR, larger scope):** M1, M2, M4 — Tailwind config + partials + README. **Don't merge into the same PR as the critical fixes.**

### Re-test Instructions (smoke test after each batch)

After **each** PR merges:

1. **Local check:**
   ```
   git pull origin main
   git rev-parse HEAD                                    # capture commit hash
   ```
2. **Deployment check:** open the Vercel preview URL for the PR.
3. **Manual desktop run-through (Chrome, 1440×900):**
   - `/` — load, count up animations fire, pricing toggle works without flash, FAQ opens, CTAs go to `/book`.
   - `/about` — meta in social share preview (use `view-source:` to confirm canonical/OG present), mobile drawer at <640px, no Tailwind CDN script in network panel.
   - `/comparison` — mobile drawer at <640px, all nav links present desktop.
   - `/book` — calendar loads, click a date, pick a slot, submit a fake booking with email `claude-test+<timestamp>@30dayramp.com` and `?tier=starter&billing=annual` — confirm tier badge shows `$2,083/mo (annual)`. Confirmation appears.
   - Questionnaire flow runs, submits to `/api/questionnaire`, `you're all set` page renders.
   - `/admin?token=$ADMIN_TOKEN` — booking shows up; click "View Map"; the map URL has a signed token; loading without the token returns 401/403.
   - `/resources` — list renders.
   - `/404-test` — 404 page loads with link home.
4. **Lighthouse run** (Chrome devtools → Lighthouse → mobile, desktop):
   - Targets: Performance ≥ 90 mobile, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 100.
5. **Console / Network:**
   - No 404s in network (especially `favicon.ico`).
   - No CSP violations in console.
   - `og-image.png` request: 1200×630, < 200KB.
6. **Run the smoke test script:**
   ```
   bash scripts/e2e-test.sh
   ```
7. **Social preview check:** paste `https://www.30dayramp.com/about` into LinkedIn / Slack / iMessage and confirm preview card renders with image + title + description.
8. **If anything fails, do not merge to `main`.** Open a bug task in the audit doc, fix, retest from step 2.

---

*End of audit.*
