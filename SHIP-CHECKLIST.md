# SHIP-CHECKLIST.md — v2 cutover (`30dayramp.com` → `ramped-s98t`)

**Last updated:** 2026-05-03

This is the punch list to take v2 from "deployed at `ramped-s98t.vercel.app`" to "live at `30dayramp.com`". Each item is grouped by who owns it.

---

## What's done (this session)

- Build passes on `ramped-s98t`. Framework set to Next.js in `web/vercel.json`.
- `web/middleware.ts` is a no-op (Clerk Edge runtime crash bypassed).
- Crons ported with H3 idempotency fix:
  - [web/app/api/reminders/route.ts](web/app/api/reminders/route.ts) — every 30 min
  - [web/app/api/weekly-digest/route.ts](web/app/api/weekly-digest/route.ts) — Mon 09:00 UTC
- Cron schedules registered in [web/vercel.json](web/vercel.json).
- Stripe webhook ported with HMAC verification + replay protection: [web/app/api/stripe-webhook/route.ts](web/app/api/stripe-webhook/route.ts).
- Admin bookings list (read-only) at [web/app/admin/](web/app/admin/page.tsx) — bearer-token auth via `localStorage`, same UX as legacy `admin.html`. Shows phase, payment status, links to portal.
- Admin API at [web/app/api/admin/bookings/route.ts](web/app/api/admin/bookings/route.ts).
- Shared lib helpers ported: [web/lib/cron-auth.ts](web/lib/cron-auth.ts), [web/lib/admin-auth.ts](web/lib/admin-auth.ts), [web/lib/map-token.ts](web/lib/map-token.ts), [web/lib/stripe.ts](web/lib/stripe.ts), [web/lib/phase.ts](web/lib/phase.ts).

---

## You: env vars on `ramped-s98t`

Set these in Vercel → Project → `ramped-s98t` → Settings → Environment Variables. Most can be copied from the legacy `ramped` project.

**Required for v2 to function at all:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`

**Required for the booking flow:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` *(legacy still owns the calendar invite path; v2 just stores the booking row)*

**Required for admin sign-in:**
- `ADMIN_TOKEN` — generate fresh: `openssl rand -hex 32`

**Required for crons:**
- `CRON_SECRET` — generate fresh: `openssl rand -hex 32`. Vercel auto-attaches this as `Authorization: Bearer ...` to scheduled invocations.

**Required for portal links + emailed roadmap links:**
- `MAP_LINK_SECRET` — copy from legacy. If you generate a new one, all in-flight portal links break.

**Required for Stripe webhook:**
- `STRIPE_SECRET_KEY` — copy from legacy
- `STRIPE_WEBHOOK_SECRET` — **must be a NEW value** for the new endpoint URL (see Stripe step below)

**Optional but recommended:**
- `SITE_URL` = `https://ramped-s98t.vercel.app` *(temporarily, until DNS cuts)*

---

## You: third-party dashboards

### Stripe
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://ramped-s98t.vercel.app/api/stripe-webhook`
3. Events to send (match legacy):
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the new signing secret → set as `STRIPE_WEBHOOK_SECRET` in Vercel
5. **Don't disable the legacy endpoint yet.** Both can run in parallel — `stripe_events` table dedupes by event id.

### Google OAuth
- Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client → Authorized redirect URIs
- Add: `https://ramped-s98t.vercel.app/api/google-oauth-callback`
- *(Calendar invite generation hasn't been ported to v2 yet — see "Not yet ported" below — so this is only needed once you migrate that flow.)*

### Resend
- If sending continues from `bookings@30dayramp.com` and `reports@30dayramp.com`, no change needed (domain already verified).
- If you change the from address, verify the new domain in Resend dashboard.

### Clerk
- Currently bypassed via no-op middleware. Admin uses bearer-token auth instead.
- If you want SSO for admin later: add `https://ramped-s98t.vercel.app` to allowed origins in Clerk dashboard, set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` env vars, and wire the admin page to use `auth()` instead of bearer.

---

## Not yet ported (need follow-up sessions)

These legacy routes still ONLY exist on `30dayramp.com`. The v2 site won't have them until ported:

**Customer-facing (will block real customers if you cut DNS without porting):**
- `/api/availability` — slot-picker on `/book` *(v2 has a stub; verify it returns the right shape)*
- `/api/contact` — contact form
- `/api/get-map`, `/api/generate-map` — automation map generation
- `/api/get-roadmap` — public-by-token roadmap viewer
- `/portal` (entire feature) — magic-link customer portal:
  - `/api/portal-data`, `/api/portal-approve-draft`, `/api/portal-billing`, `/api/portal-onboarding`, `/api/portal-profile`, `/api/portal-tickets`, `/api/portal-toggle-agent`, `/api/portal-track`, `/api/portal-upload-url`
- `/api/google-oauth-start`, `/api/google-oauth-callback` — calendar invite flow
- `/api/book` — currently in v2 as a *minimal* port; it stores the row but does NOT generate the Google Calendar invite or Meet link. Legacy still does this. **If you cut DNS, calendar invites will silently stop until ported.**

**Admin CRUD (read-only works on v2; mutations go to legacy):**
- `/api/admin-update`, `/api/admin-delete` — edit + cancel bookings
- `/api/admin-materials` — materials manager
- `/api/admin-tickets` — support tickets
- `/api/admin-create-invoice`, `/api/admin-create-subscription` — Stripe billing actions
- `/api/admin-agents` — agent management

**Other:**
- `/api/agent-logs` — used by portal
- `/api/send-followup` — manual followup sender
- `/api/resources-refresh` — auto-refresh curated resources

---

## You: DNS (when ready, NOT YET)

**Do NOT do this until everything above is ported and verified.** Cutting DNS too early breaks live customers.

When ready:
1. Vercel → `ramped-s98t` → Settings → Domains → add `30dayramp.com` and `www.30dayramp.com`
2. Vercel → legacy `ramped` project → Settings → Domains → remove same two
3. Update Stripe webhook URL to `https://www.30dayramp.com/api/stripe-webhook` (or keep both endpoints active and let one go dark)
4. Update Google OAuth redirect URI to the new domain
5. Update `SITE_URL` env var on `ramped-s98t` to `https://www.30dayramp.com`
6. Keep the legacy `ramped` deploy paused-not-deleted for ~30 days as rollback

---

## Verification before DNS cut

1. Bearer-sign-in to `https://ramped-s98t.vercel.app/admin` with `ADMIN_TOKEN`. Verify you see the same bookings as legacy admin.
2. Test the Stripe webhook in Stripe dashboard → "Send test webhook". Verify a row appears in `stripe_events`.
3. Test crons manually: `curl -H "Authorization: Bearer $CRON_SECRET" https://ramped-s98t.vercel.app/api/reminders` — should return `{ ok: true, sent_24h: [], sent_1h: [], errors: [] }` (empty arrays unless you have a real booking in the ±15 min window of "1h" or "24h" from now).
4. Place a test booking via `/book`. Verify confirmation email arrives. *(Calendar invite won't — legacy still owns that path.)*
5. Run [scripts/e2e-test.sh](scripts/e2e-test.sh) against `https://ramped-s98t.vercel.app` — adjust the base URL.

---

## Risks I noticed

- **Both crons will fire on `ramped-s98t` AND on legacy `30dayramp.com` simultaneously** while both deploys are alive. The reminders cron's idempotency columns (`reminded_24h_at`, `reminded_1h_at`) prevent duplicate emails from a single project, but they DON'T prevent both projects from sending separately. Either:
  - Set `CRON_SECRET` to *the same value* on both projects so the column-write race resolves cleanly *(both will atomically lose the race for the second send)*, OR
  - Disable crons on legacy `vercel.json` once v2 crons are verified working (preferred — remove the `crons` block from legacy `vercel.json` and redeploy).
- **`api/_lib/admin-auth.js` ALLOWED_ORIGINS** doesn't include `ramped-s98t.vercel.app`. Doesn't matter for v2 (we don't call legacy admin from v2 frontend), but worth knowing if you ever want cross-project admin calls.
- **`api/send-followup.js` reads `ADMIN_PASSWORD`** but everything else uses `ADMIN_TOKEN`. Pre-existing inconsistency; port this when you migrate that endpoint.
