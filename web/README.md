# Ramped AI — v2 web app

Next.js 15 + TypeScript + Tailwind v4 rewrite of the marketing site + conversion funnel. Lives alongside the legacy static site (at the repo root) until the new app is ready for cutover.

## Stack

- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript (strict)
- **Styling:** Tailwind v4 — design tokens defined once in `app/globals.css`
- **DB:** Supabase Postgres via Drizzle ORM (type-safe queries)
- **Auth:** Clerk (admin-only — public pages and customer portal use signed tokens)
- **Email:** Resend
- **AI:** Anthropic Claude (for automation-map generation — wired in next session)
- **Forms:** react-hook-form + Zod schemas shared between client + server
- **Tests:** Playwright E2E (next session)

## What's in / what's not (yet)

| Page / route                  | Status         |
|-------------------------------|----------------|
| `/` homepage                  | ✅ ported      |
| `/book`                       | ✅ ported      |
| `/questionnaire`              | ✅ ported      |
| `/thanks`                     | ✅ ported      |
| `/about`                      | ⏳ next session |
| `/free-roadmap`               | ⏳ next session |
| `/comparison`                 | ⏳ next session |
| `/resources`                  | ⏳ next session |
| `/agent-library`              | ⏳ next session |
| `/admin` (Clerk-gated)        | ⏳ next session |
| `/portal` (signed-token)      | ⏳ next session |
| `/api/book`                   | ✅ ported      |
| `/api/availability`           | ✅ ported      |
| `/api/questionnaire`          | ✅ ported (Anthropic call deferred) |
| `/api/free-roadmap`           | ⏳ next session |
| `/api/stripe-webhook`         | ⏳ stays at root for now |
| `/api/reminders` (cron)       | ⏳ stays at root for now |
| `/api/portal-*`               | ⏳ next session |

## Setup

```bash
cd web
cp .env.example .env.local        # fill in keys
npm install                       # if you haven't already (sandbox started this)
npm run dev                       # → http://localhost:3000
```

### Required env vars (minimum to run locally)

- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — same DB as production
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` — for booking confirmation emails
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — only required when `/admin` is added next session

Without Clerk keys, `ClerkProvider` is skipped at the layout level so the public pages still render. Set them when you're ready to wire `/admin`.

## Architecture

### Single-source-of-truth files

These each replace 5–12 places in the old codebase:

| File                          | Replaces                                                |
|-------------------------------|---------------------------------------------------------|
| `app/globals.css` (`@theme`) | Per-page `:root { --bg-0: ... }` blocks across 18 HTML files |
| `lib/pricing.ts`              | Pricing duplicated in 5 places (homepage, book, comparison, one-pager, pricing-onepager) |
| `lib/integrations.ts`         | Brand-pill markup duplicated in 2 places (book, questionnaire) |
| `lib/team.ts`                 | Founder data duplicated on /about + JSON-LD            |
| `lib/site.ts`                 | Nav, footer, ticker, contact email                      |
| `lib/calendar.ts`             | Slot logic duplicated on book.html + /api/availability  |
| `lib/schemas/*`               | Shared validation between forms + API routes            |
| `db/schema.ts`                | Type-safe Drizzle schema mirroring Supabase tables      |

### Component library

`components/ui/`:
- `Button` — primary / secondary / ghost / outline · sm / md / lg
- `Card`, `Input`, `Textarea`, `Label`, `Field` — form primitives
- `Pill`, `Badge`, `Eyebrow` — small visual indicators
- `BrandLogo` — Simple Icons CDN with letter-chip fallback

`components/`:
- `Header`, `Footer` — site chrome
- `CalendarPicker` — date + slot picker, used by `/book`
- `BookingForm` — client-side form with Zod validation
- `QuestionnaireForm` — multi-step prep questionnaire

### Why this is better than the old setup

1. **Tokens defined once.** Want a different brand version? Edit `app/globals.css`. The old setup needed all 18 HTML files updated in lockstep.
2. **No more drift.** Pricing, integrations, founder bios, team data — all imported from one TypeScript module. Type-safe, autocompleted, refactor-safe.
3. **Slot logic deduplicated.** The bug we spent an hour debugging (slot computation in three places that didn't agree) can't happen anymore — both client and server import from `lib/calendar.ts`.
4. **Type-safe forms.** Zod schemas validate the same shape on the frontend (form errors) and backend (request body). A field rename can't half-ship.
5. **Component reuse.** Buttons, pills, calendars, badges — written once, used everywhere.

## Deploy strategy

The legacy site at the repo root keeps deploying to www.30dayramp.com via the existing Vercel project. **No production traffic is at risk.**

For tonight, this `/web/` app is local-only. To put it on a preview URL:

**Option A — Same Vercel project, subpath:**
1. In Vercel project settings → Build & Development → set Root Directory to `web/`
2. Update the existing `vercel.json` rewrites at the repo root to send `/v2/*` to the new app

**Option B — Separate Vercel project (recommended):**
1. Create a new Vercel project pointing at the `web/` directory of this repo
2. Get a preview URL (e.g. `ramped-v2.vercel.app`)
3. Once we're satisfied, change DNS for www.30dayramp.com to the new project

I recommend B. Lower blast radius, easier to roll back.

## Next session(s)

In priority order:
1. Wire Anthropic call into `/api/questionnaire` for automation-map generation
2. Port `/free-roadmap` + `/api/free-roadmap`
3. Port marketing pages (`/about`, `/comparison`, `/resources`, `/agent-library`)
4. Build new `/admin` with Clerk auth + materials/bookings/audit-log tabs
5. Build new `/portal` with real `/api/portal/state` data (not mock)
6. Migrate Stripe webhook + cron jobs
7. Email templates → React Email components
8. Playwright E2E tests for booking flow + admin login

## Conventions

- **Server components by default.** Add `"use client"` only when you need state, refs, or browser APIs.
- **Imports use `@/...` alias** (mapped to project root in `tsconfig.json`).
- **Form submission via react-hook-form + zodResolver.** Validation errors render inline with the `Field` component.
- **API responses follow `{ ok, error?, ...data }`.** Status codes are accurate (400 invalid, 401 unauth, 409 conflict, 500 server).
- **No bare datetime arithmetic — use `lib/calendar.ts`** for any time-zone-aware logic.
