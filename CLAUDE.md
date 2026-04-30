# CLAUDE.md — Persistent rules for AI coworkers on the Ramped AI repo

**Project:** Ramped AI — `30dayramp.com`. *"Your AI department, live in 30 days."*
**Audience:** founders, CEOs, ops leaders. Premium B2B SaaS prospects. Stripe / Ramp / Notion is the bar.
**You are:** an elite Principal Engineer + Senior Product Designer. Premium polish only. No mediocre output.

---

## What this codebase actually is

- **Static HTML + Vercel serverless** — no framework, no build step, no `package.json`, no Tailwind config.
- `styles.css` is a pre-compiled, single-line Tailwind v4 output. **Treat it as a build artifact** — don't hand-edit unless you're rebuilding Tailwind locally and committing the new output.
- 18 HTML pages at the root. Each page declares its own `:root { --ink, --paper, --line, --muted, --accent, ... }` block inline. Drift is real and ongoing — see the audit.
- API routes under `api/*.js` (Vercel serverless, Node). Shared helpers live under `api/_lib/`.
- Database: Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`).
- Email: Resend (`RESEND_API_KEY`).
- Calendar: Google OAuth → Calendar API (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`).
- LLM: Anthropic Claude (`ANTHROPIC_API_KEY`) — model `claude-sonnet-4-5` per `api/questionnaire.js`.
- Cron: `/api/reminders` every 30 min (`vercel.json`).
- Admin auth: bearer token, constant-time compare in `api/_lib/admin-auth.js`. Env: `ADMIN_TOKEN`. **Note**: `api/send-followup.js` still reads `ADMIN_PASSWORD` — fix when you touch it.

## What's brittle (read before changing anything)

1. **Pricing in three places.** `index.html` JS toggle, `book.html` `tierLabels` map, `comparison.html` static text, `one-pager.html` static text, `pricing-onepager.html` static text. Always update **all four** in lockstep, with the same source of truth.
2. **Design tokens duplicated on every page.** Adding a new color means adding it to ~12+ inline `:root` blocks. The right long-term answer is a build step (audit M1).
3. **No build step.** No way to run lint, tests, type-checks. Validation is by reading the HTML and using the smoke test (`scripts/e2e-test.sh`).
4. **`get-map` and `get-roadmap` are public-by-UUID.** Anyone with a UUID has full read. Audit C1 will fix this — don't add new public-by-UUID endpoints.
5. **`reminders.js` is not idempotent** — same booking can get the same reminder twice if cron windows overlap. Audit H3.

## Standards for any change

### Frontend
- **No Tailwind Play CDN** (`<script src="cdn.tailwindcss.com">`). It exists on `about.html` today and must be removed. Don't reintroduce it on any other page.
- **Every customer-facing page must have:** `<title>`, `<meta name="description">`, `<link rel="canonical">`, OG `og:title/description/image/url/type/site_name`, Twitter `card/title/description/image`, `<link rel="icon" href="/favicon.svg">`, `<link rel="apple-touch-icon">`, `<link rel="stylesheet" href="/styles.css">`, Vercel Insights (`<script defer src="/_vercel/insights/script.js">`).
- **Every customer-facing page must have a working mobile nav** with hamburger toggle, `aria-expanded`, `aria-controls`, drawer that closes on link click and on Escape. Pattern: copy from `index.html`.
- **Every page's primary nav must include `/about`** (and `/comparison`, `/demo`, `/book`).
- **Every page's footer must include `/about`** alongside the existing links.
- **`<h1>`** on every customer-facing page. Heading order H1 → H2 → H3, no skipping.
- **`prefers-reduced-motion: reduce`** must disable ticker, count-up, and `hover-lift` transforms.
- **Skip-to-main link** at the start of `<body>` on every page.
- **CSS variables** must match the canonical token table. Canonical: `--ink:#0B1220; --paper:#FAFAF7; --line:#E6E4DC; --muted:#5B6272; --accent:#1F4FFF; --accent-2:#0B2A8C; --good:#0F7A4B; --warn:#B45309; --surface:#F5F5F3; --ink-2:#1A2233;`. Don't add new variants (`#FAFAFA`, `#E5E8EF`) without explicit reason. The dark theme on `404.html` is the only exception.
- **Inter weights:** load `400;500;600;700;800` on every page. JetBrains Mono `400;500`. No other variants without a reason.
- **CTA copy:** primary CTA is **"Book a discovery call →"**. Secondary is **"Get started →"** for tier-bound flows. Don't invent new variants.
- **Pricing copy:** Starter `$2,500/mo` (monthly) or `$2,083/mo billed annually · save $5,000`. Growth `$5,000/mo` or `$4,167/mo billed annually · save $10,000`. + onboarding `$2,500` (Starter) / `$3,500` (Growth). Update everywhere or nowhere.
- **Email contact:** `jon@30dayramp.com` only. Not `hello@`, not `contact@`, not `support@`.

### Backend
- **All admin endpoints** must `import { setAdminCors, isAuthorized } from './_lib/admin-auth.js'` and call them. Don't roll your own bearer parsing.
- **All public POST endpoints** must rate-limit via `api/_lib/validate.js` and HTML-escape any user input before it lands in an email or HTML response.
- **No new public-by-UUID endpoints.** If a customer needs a sharable URL, use a signed/expiring token: `?id=UUID&t=HMAC(UUID + exp, SECRET)`.
- **Cron jobs must be idempotent.** Set a "last-fired" column or check before mutation.
- **Bookings table must keep its `UNIQUE(datetime)` constraint.** Don't drop it. Add via migration in `db/migrations/`.
- **No secrets in committed code.** All keys via `process.env`. Never log full request bodies that include credentials.

### SEO / Analytics
- **Sitemap must list every customer-facing canonical URL** with current `lastmod`. Auto-stamp on deploy when build pipeline lands.
- **Vercel Insights** on every customer-facing page (don't add to `/admin`, `/dashboard`).
- **JSON-LD** for `WebSite` on `/`, `Organization` on `/`, `FAQPage` where there's an FAQ, `Person` on `/about`, `Service` on `/book`.

### Security headers (don't relax)
- HSTS `max-age=63072000; includeSubDomains; preload`
- CSP `default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live; ...` — keep `'unsafe-inline'` only if you can't migrate to nonces.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

## Tone, copy, and design language

- **Plain, confident, specific.** Numbers over adjectives. "30 days, or refund" beats "fast turnaround".
- **No fluff.** No "We're passionate about..." / "We believe in..." filler.
- **Operator voice.** The reader is a CEO/founder. They've been pitched. Skip the warm-up.
- **No emoji** in customer-facing copy except where deliberately set already (e.g. tier interest badge in `book.html` post-confirmation). Don't sprinkle emoji into new content.
- **No fictional logos.** No "as seen in TechCrunch" without permission.
- **Real numbers, sourced.** "Avg. $12,000+/mo saved" is OK with a sample size. "5× ROI" is risky on n=1. Add provenance or soften.

## Visual bar

- **Stripe / Ramp / Notion** is the bar. Look at their `/pricing`, `/about`, `/customers` pages before designing a new section.
- **Generous whitespace.** Padding-block of 80–96px on desktop sections. Don't pack.
- **One accent color** used sparingly. `--accent: #1F4FFF`. Reserve for primary CTAs, key emphasis, and link hovers.
- **Type scale clamps**, e.g. `clamp(2.2rem, 5vw, 3.4rem)` for H1. Don't ship fixed-px hero text.
- **Real photography or commissioned illustration** for hero / about / customer pages. Stock SVG icons in pain-point cards are acceptable for "bridges" but never in the hero.
- **One testimonial is not social proof.** Always link to a fuller case study if you make a metric claim.

## Workflow rules for AI assistants

1. **Always `git pull origin main` and report the HEAD commit before editing.** Don't operate on stale state.
2. **Never invent findings.** Every claim in a review or audit must be backed by a file path + line number. If you can't quote it, don't claim it.
3. **Never edit `styles.css` by hand** — it's a Tailwind build output. Edit per-page inline styles, or rebuild Tailwind locally and commit the new output, never both.
4. **When you change a price, change all 4 places** (`index.html`, `book.html` `tierLabels`, `comparison.html`, `one-pager.html` + `pricing-onepager.html`). The audit lists them; verify after editing with `grep -n "2,083\|2,500\|4,167\|5,000" *.html`.
5. **When you change nav or footer, change all of them** — they're hand-copied. Verify with `for f in *.html; do echo === $f ===; awk '/<nav[^>]*aria-label="Primary"/,/<\/nav>/' "$f"; done`.
6. **Keep `AUDIT.md` honest.** When an audit item is fixed, mark it `(fixed in <commit>)` rather than deleting.
7. **Don't introduce a build step in a small PR.** It's a "M1" item — do it in a dedicated PR with `package.json`, lockfile, CI, and a deploy verification.
8. **Don't ship a customer-visible change after 5pm Friday.** Cron and email side-effects can spill over the weekend.
9. **For backend changes, run `bash scripts/e2e-test.sh` against the preview URL.** Don't merge if it fails.
10. **For frontend changes, do the manual smoke test in the audit's "Re-test Instructions" section** at minimum.
11. **When you ship a new strategy doc / deck / brand asset, add an entry to `materials.json`.** That manifest is the source-of-truth for the `/admin → Materials` tab. Every internal artifact gets a row: title, path, type, updated date, one-line description. Don't ship a new audit report or one-pager without registering it there.

## Files to handle with extra care

| File | Why |
|---|---|
| `vercel.json` | One typo and CSP / rewrites break the entire site. Verify the preview URL before merging. |
| `api/_lib/admin-auth.js` | Authentication logic; constant-time comparison must be preserved. |
| `api/book.js` | Booking flow + emails + calendar invite. Touch with care; run e2e. |
| `api/questionnaire.js` | Calls Anthropic, sends emails, mutates booking. Long file. Easy to break the prompt. |
| `db/migrations/*.sql` | Forward-only. Don't edit a committed migration; add a new one. |
| `index.html`, `book.html`, `comparison.html`, `about.html` | Top-of-funnel; visible to every prospect. |
| `og-image.png`, `favicon.svg`, `apple-touch-icon.png` | Brand assets — coordinate with whoever owns design before swapping. |

## Useful one-liners

```bash
# Verify all canonical URLs resolve
for u in / /about /book /comparison /demo /resources /questionnaire /privacy /thanks; do
  curl -s -o /dev/null -w "$u %{http_code}\n" "https://www.30dayramp.com$u"
done

# Find pages missing /styles.css
for f in *.html; do grep -q 'href="/styles.css"' "$f" || echo "MISSING: $f"; done

# Find pages missing the canonical link
for f in *.html; do grep -q 'rel="canonical"' "$f" || echo "MISSING canonical: $f"; done

# Find pages without Vercel Insights
for f in *.html; do grep -q '/_vercel/insights/script.js' "$f" || echo "MISSING insights: $f"; done

# Smoke test
bash scripts/e2e-test.sh
```

---

*Last updated: 2026-04-27 (commit `aaff7ef`). When you make a change that invalidates a rule above, edit this file in the same PR.*
