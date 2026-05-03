# Ramped AI — v2 web app

Next.js 15 + TypeScript + Tailwind v4 rewrite of the marketing site + conversion funnel + auth scaffolding. Lives in `/web/` of the same repo as the legacy site so the legacy deploy at www.30dayramp.com keeps running unchanged until cutover.

## What's built tonight

| Route                    | Status      | Notes                                                                  |
|--------------------------|-------------|------------------------------------------------------------------------|
| `/`                      | ✅ ported   | Hero, pricing (live from `lib/pricing.ts`), founder note, final CTA     |
| `/about`                 | ✅ ported   | Founder note full-width, operating principles, team grid (Andrew + Jon) |
| `/book`                  | ✅ ported   | Single-screen form + sticky calendar, taken-slots greyed out            |
| `/questionnaire`         | ✅ ported   | Schema-driven form (renders from `lib/questionnaire-fields.ts`)         |
| `/free-roadmap`          | ✅ ported   | Lead-magnet form with brand-pill stack picker                           |
| `/comparison`            | ✅ ported   | VA vs AI table + hero stats                                              |
| `/resources`             | ✅ ported   | Filter + cards, fetches `/api/resources`                                |
| `/agent-library`         | ✅ ported   | 4 scenario cards (interactive Slack mockups deferred)                    |
| `/privacy`               | ✅ ported   | TOC + 7 sections                                                         |
| `/thanks`                | ✅ ported   | Dynamic by intent (booking / questionnaire / roadmap)                    |
| `/admin`                 | 🟡 placeholder | Clerk-gated landing → forwards to legacy admin until v2 dashboard lands |
| `/portal`                | 🟡 placeholder | Forwards signed-token URLs to legacy portal until v2 portal lands       |
| `/api/availability`      | ✅ ported   | Returns config + booked datetimes for the calendar                       |
| `/api/book`              | ✅ ported   | Insert booking + send confirmation + admin alert                         |
| `/api/questionnaire`     | ✅ ported   | Anthropic analysis + roadmap email + silent-failure fallback             |
| `/api/free-roadmap`      | ✅ ported   | Lead capture + acknowledgement email + admin alert                       |
| `/api/resources`         | ✅ ported   | Public read of curated resources                                          |
| `/api/stripe-webhook`    | ⏳ legacy   | Stays on the legacy deploy — high-risk to migrate                       |
| `/api/reminders` cron    | ⏳ legacy   | Stays on the legacy deploy                                               |
| `/api/weekly-digest`     | ⏳ legacy   | Stays on the legacy deploy                                               |
| `/api/portal-*`          | ⏳ legacy   | Portal data endpoints stay on the legacy deploy                          |

## Architecture wins

**Single source of truth files** — each replaces 5–12 places in the legacy codebase:

| File                                      | Replaces                                                          |
|-------------------------------------------|-------------------------------------------------------------------|
| `app/globals.css` (`@theme`)              | Per-page `:root { --bg-0: ... }` blocks across 18 HTML files      |
| `lib/pricing.ts`                          | Pricing duplicated in 5 places                                    |
| `lib/integrations.ts`                     | Brand-pill markup duplicated in 2 places                           |
| `lib/team.ts`                              | Founder data duplicated on /about + JSON-LD                       |
| `lib/site.ts`                              | Nav, footer, ticker, contact email                                 |
| `lib/calendar.ts`                          | Slot logic that drifted between book.html + /api/availability     |
| `lib/schemas/*`                           | Zod schemas shared between forms + API routes                      |
| `lib/questionnaire-fields.ts`             | Form rendering + API prompt + validation — drift is impossible    |
| `db/schema.ts`                             | Type-safe Drizzle schema mirroring Supabase tables                 |

**Type-safe forms** — react-hook-form + Zod validates the same shape on the frontend (inline field errors) and backend (request body). Renaming a schema field is a TypeScript error on both sides.

**Schema-driven questionnaire** — `lib/questionnaire-fields.ts` is the only place to add/rename a question. The `<QuestionnaireForm />` component renders all 11 questions from this schema. The `/api/questionnaire` route imports the same file to build the Anthropic prompt context. The drift bug that hid for weeks (form sent `stack`, prompt read `integrations`, customer never got a roadmap) is structurally impossible going forward.

## Local setup

```bash
cd web
cp .env.example .env.local        # fill in keys (see below)
npm install                        # ~2-3 min on a clean machine
npm run dev                        # → http://localhost:3000
```

### Required env vars

Minimum set to run locally:

- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — same DB as production
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`

For booking confirmation emails:
- `RESEND_API_KEY`

For the questionnaire to generate roadmaps via Anthropic:
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (defaults to `claude-sonnet-4-5`)

For `/admin` to render (Clerk-gated):
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Without Clerk keys, the public pages still render — `ClerkProvider` is conditional in `app/layout.tsx` so the build doesn't break. `/admin` will 404 cleanly until keys are added.

## Deploy to a preview URL via Vercel

The legacy site's existing Vercel project keeps shipping `/` from the repo root. We deploy v2 alongside it as a **separate Vercel project** with project root = `web/`. This means a separate preview URL (e.g. `ramped-v2.vercel.app`) where v2 lives — production traffic at www.30dayramp.com is untouched until we explicitly cut over via DNS.

### Step-by-step

1. **Save the v2 work to a branch** (so it's backed up + Vercel can deploy from it):
   ```bash
   cd "/c/Users/Hado/Documents/Claude/Projects/4.29.26 nanoclaw help"
   git checkout -b v2
   git add web/ lib/questionnaire-schema.js
   git commit -m "v2: Next.js 15 rewrite — homepage, /book, /questionnaire (schema-driven), /free-roadmap, /about, /comparison, /resources, /agent-library, /privacy, /thanks; /admin + /portal placeholders. Sources from same Supabase DB, Resend, Anthropic. Production traffic untouched."
   git push -u origin v2
   ```

2. **Create the Vercel project** in the dashboard:
   - Vercel → Add New → Project → Import Git Repository → pick `kaisuupgrades-ship-it/ramped`
   - **Root Directory:** `web` ← important
   - **Framework preset:** Next.js (auto-detected)
   - **Branch:** `v2`
   - Click Deploy. The first build will fail fast if any env var is missing.

3. **Add env vars** in the Vercel project's Settings → Environment Variables. Copy from the legacy project (you can use Vercel's "Link Shared Variable" feature if you store them at the team level, otherwise paste them in). The full list:
   - `DATABASE_URL` (optional — only for Drizzle direct connection)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (defaults to `jon@30dayramp.com`)
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
   - `MAP_LINK_SECRET` (only used by portal-data which is stubbed in v2 — copy anyway)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (Clerk dashboard)
   - `SITE_URL`, `NEXT_PUBLIC_SITE_URL` (set to the new preview URL or `https://www.30dayramp.com`)

4. **Trigger a redeploy** in Vercel after env vars are saved.

5. **QA the preview URL.** Click through every page. Specifically verify:
   - Booking flow: pick a time → submit → redirect to `/questionnaire` → fill out → roadmap email lands
   - Free-roadmap form: submit → ack email lands + admin alert lands
   - `/admin` after Clerk sign-in shows the placeholder + legacy link
   - Calendar slots that are taken on prod show greyed out on v2 (same DB, real-time)

6. **Cut over DNS when satisfied.** In a separate session, change DNS for www.30dayramp.com from the legacy Vercel project to the v2 project. Legacy keeps running on its old subdomain in case we need to roll back.

## Conventions

- **Server components by default.** Add `"use client"` only when you need state, refs, or browser APIs.
- **Imports use `@/...` alias** (mapped to project root in `tsconfig.json`).
- **Form submission via react-hook-form + zodResolver.** Validation errors render inline with the `Field` component.
- **API responses follow `{ ok, error?, ...data }`.** Status codes are accurate.
- **Time-zone aware logic always goes through `lib/calendar.ts`.**
- **Centralized data wins over duplication.** Prices, integrations, founder bios, questionnaire fields all live in `/lib/` modules. If you find yourself copy-pasting, ask first whether it should be a centralized export.

## Next session(s)

In priority order:

1. **Wire the v2 admin dashboard** — Bookings table, Materials manager, Audit log, manual roadmap regen
2. **Port the customer portal** with real `/api/portal/state` data + agent status
3. **Migrate Stripe webhook** from legacy `/api/stripe-webhook.js` to a v2 route handler
4. **Migrate cron jobs** (`/api/reminders`, `/api/weekly-digest`)
5. **Email templates as React Email components** — better preview, easier to maintain than the inline HTML strings
6. **Playwright E2E tests** for booking → questionnaire → submission, plus admin login
7. **Interactive Slack demos** on `/agent-library` (port the legacy interactive mockups)
8. **DNS cutover** to swap v2 onto www.30dayramp.com

## Files in this directory

```
web/
├── app/
│   ├── layout.tsx              # Root layout, header + footer, optional Clerk
│   ├── globals.css             # Tailwind v4 + design tokens (single source)
│   ├── page.tsx                # Homepage
│   ├── about/page.tsx
│   ├── book/page.tsx
│   ├── questionnaire/page.tsx
│   ├── free-roadmap/page.tsx
│   ├── comparison/page.tsx
│   ├── resources/page.tsx
│   ├── agent-library/page.tsx
│   ├── privacy/page.tsx
│   ├── thanks/page.tsx
│   ├── admin/page.tsx          # Clerk-gated placeholder
│   ├── portal/page.tsx         # Signed-token forwarding placeholder
│   └── api/
│       ├── availability/route.ts
│       ├── book/route.ts
│       ├── questionnaire/route.ts
│       ├── free-roadmap/route.ts
│       └── resources/route.ts
├── components/
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── CalendarPicker.tsx
│   ├── BookingForm.tsx
│   ├── QuestionnaireForm.tsx
│   ├── FreeRoadmapForm.tsx
│   ├── ResourcesClient.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── core.tsx            # Card, Input, Textarea, Field, Pill, Badge, Eyebrow
│       └── BrandLogo.tsx
├── lib/
│   ├── cn.ts                   # clsx + tailwind-merge
│   ├── env.ts                  # Zod-validated env access
│   ├── site.ts                 # Nav, footer, ticker, contact
│   ├── pricing.ts              # 3 tiers
│   ├── integrations.ts         # 12 tools with brand colors + Simple Icons slugs
│   ├── team.ts                 # Founder profiles
│   ├── pain-points.ts          # Qual options
│   ├── calendar.ts             # Slot generation logic (shared with API)
│   ├── email.ts                # Resend wrapper + brand shell
│   ├── supabase.ts             # REST helper (legacy compat)
│   ├── questionnaire-fields.ts # SCHEMA — used by form + prompt + validator
│   └── schemas/
│       ├── booking.ts          # Zod
│       ├── questionnaire.ts    # Zod (legacy holdover, may consolidate later)
│       └── free-roadmap.ts     # Zod
├── db/
│   ├── schema.ts               # Drizzle schema mirroring Supabase
│   └── index.ts                # Drizzle client
├── public/                     # logo, favicons, og-image, founder photos
├── middleware.ts               # Clerk middleware (gates /admin)
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── drizzle.config.ts
├── package.json
├── .env.example
├── .gitignore
└── README.md (this file)
```
