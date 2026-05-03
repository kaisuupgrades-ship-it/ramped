# SHIP-CHECKLIST.md — v2 cutover (`30dayramp.com` → `ramped-s98t`)

**Last updated:** 2026-05-03 (after the second porting session)

---

## Status: full functional parity reached

Every customer-facing route, every admin route, both crons, the Stripe webhook,
and the customer portal/roadmap/map pages now exist on v2 (`ramped-s98t`).

**Nothing actually runs end-to-end until the env vars are set.** That's the
remaining gate — see "Your turn" below.

---

## What's deployed on `ramped-s98t.vercel.app`

### Customer-facing API routes
- `POST /api/book` — create booking, generate Google Calendar event + Meet link, persist meet_link, send "you're booked" email
- `GET  /api/availability` — slot config + booked slots (Supabase + Google Calendar busy ranges merged)
- `POST /api/contact` — landing-page lead form
- `POST /api/questionnaire` — Anthropic-driven roadmap generator
- `POST /api/free-roadmap` — free email-only roadmap flow
- `GET  /api/resources` — curated AI resources (ISR-cached, 5min)
- `GET  /api/get-roadmap?id&exp&t` — public roadmap viewer (HMAC-token gated)
- `GET  /api/get-map?id&exp&t` — public automation map viewer (HMAC-token gated)
- `GET  /api/generate-map` — 410 Gone (matches legacy)

### Customer portal API routes (HMAC-token gated)
- `GET  /api/portal-data` — main portal payload (booking + agents + drafts + activity + phase)
- `POST /api/portal-approve-draft` — approve/reject/edit pending draft
- `GET  /api/portal-billing` — Stripe-derived billing summary
- `GET/POST /api/portal-onboarding` — onboarding fields + complete flag
- `GET/POST /api/portal-profile` — profile read + write (with email-change verification)
- `GET/POST /api/portal-tickets` — ticket list + reply
- `POST /api/portal-toggle-agent` — pause/resume agent (live ↔ paused)
- `POST /api/portal-track` — analytics beacon (events + last-seen + visit-count)
- `POST /api/portal-upload-url` — signed Supabase Storage upload URL

### Admin API routes (`ADMIN_TOKEN` Bearer)
- `GET  /api/admin/bookings` — bookings + leads + maps with computed phase + signed portal links
- `POST /api/admin-update` — patch booking
- `POST /api/admin-delete` — delete booking
- `GET/POST/DELETE /api/admin-agents` — agent CRUD
- `POST /api/admin-create-invoice` — Stripe onboarding invoice (idempotent)
- `POST /api/admin-create-subscription` — Stripe monthly subscription (idempotent)
- `GET/POST /api/admin-tickets` — admin inbox + reply (sends email)
- `GET/POST/PATCH/DELETE /api/admin-materials` — internal materials library (repo+uploads)
- `GET  /api/agent-logs` — agent_runs + logs feed (24h window)
- `POST /api/send-followup` — admin-triggered post-call follow-up email

### Crons (registered in [web/vercel.json](web/vercel.json))
- `*/30 * * * *` → `/api/reminders` — 24h + 1h booking reminders w/ H3 idempotency
- `0 9 * * 1` → `/api/weekly-digest` — Monday 09:00 UTC customer digest

### Webhooks
- `POST /api/stripe-webhook` — HMAC-verified, replay-protected, patches booking on payment events

### OAuth (one-time admin flows)
- `GET /api/google-oauth-start?token=ADMIN_TOKEN` — kick off Google OAuth
- `GET /api/google-oauth-callback` — receive code, show refresh token in browser

### Pages
- `/` — homepage
- `/about`, `/comparison`, `/agent-library`, `/resources`, `/free-roadmap`, `/privacy`
- `/book` — booking form with calendar picker
- `/questionnaire` — schema-driven intake
- `/thanks`
- `/admin` — bearer-token sign-in, bookings + leads tables (read-only — full CRUD via legacy admin until v2 admin screens are extended)
- `/portal?id&exp&t` — full customer dashboard (phase timeline, next call, drafts approval, agents pause/resume, recent activity)
- `/roadmap?id&exp&t` — read-only customer roadmap view
- `/map/[id]?exp&t` — read-only automation map view

### Shared lib helpers (`web/lib/`)
- `cron-auth.ts`, `admin-auth.ts`, `portal-auth.ts`, `map-token.ts`
- `email.ts`, `email-design.ts`, `validate.ts`, `notify.ts`, `audit-log.ts`, `logger.ts`
- `google-calendar.ts`, `stripe.ts` (full REST wrapper), `supabase.ts`, `phase.ts`
- `site.ts`, `cn.ts`, `pricing.ts`, `team.ts`, `pain-points.ts`, `integrations.ts`, `calendar.ts`, `questionnaire-fields.ts`

---

## Your turn — env vars on `ramped-s98t`

Vercel → Project → `ramped-s98t` → Settings → Environment Variables.
Most can be copied directly from the legacy `ramped` project.

**Required for v2 to function at all:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `RESEND_API_KEY`
- `ANTHROPIC_API_KEY`

**Required for booking calendar invites:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` *(optional, defaults to `primary`)*

**Required for admin sign-in + Google OAuth re-auth:**
- `ADMIN_TOKEN` — generate fresh: `openssl rand -hex 32`

**Required for crons:**
- `CRON_SECRET` — generate fresh: `openssl rand -hex 32`. Vercel auto-attaches this as `Authorization: Bearer ...` to scheduled invocations.

**Required for portal links + roadmap links + emails:**
- `MAP_LINK_SECRET` — copy from legacy. **If you generate a new one, every in-flight portal link breaks.**
- `IP_HASH_SALT` — copy from legacy (used for portal-track + audit-log)

**Required for Stripe (payments + webhook + invoice/subscription creation):**
- `STRIPE_SECRET_KEY` — copy from legacy
- `STRIPE_WEBHOOK_SECRET` — **must be a NEW value** for the new endpoint URL (see Stripe step below)

**Required for materials uploads:**
- `MATERIALS_BUCKET` — defaults to `materials`; copy if customised in legacy

**Required for portal document uploads:**
- `SUPABASE_ONBOARDING_BUCKET` — defaults to `onboarding`

**Optional Slack integration:**
- `SLACK_WEBHOOK_URL` — Slack incoming-webhook URL for booking/ticket/payment notifications

**Recommended:**
- `SITE_URL` = `https://ramped-s98t.vercel.app` *(temporarily, until DNS cuts; then change to https://www.30dayramp.com)*
- `OWNER_EMAIL` = `jon@30dayramp.com`
- `OAUTH_REDIRECT_HOST` — set to `https://ramped-s98t.vercel.app` for staging; change to `https://www.30dayramp.com` after DNS cut

---

## Your turn — third-party dashboards

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
- Then visit `https://ramped-s98t.vercel.app/api/google-oauth-start?token=$ADMIN_TOKEN` to mint a fresh `GOOGLE_REFRESH_TOKEN` for the new project (the legacy one's refresh token will still work, but minting a fresh one keeps the two projects independent).

### Resend
- If sending continues from `bookings@30dayramp.com`, `support@30dayramp.com`, and `reports@30dayramp.com` — no change needed (domain already verified).

### Supabase Storage buckets
- Verify both `onboarding` and `materials` buckets exist in Supabase Storage (private). Run migrations 003 (portal/onboarding_documents) and 008 (admin_materials/material_uploads) if not already applied.

### Clerk
- Currently unused. Admin uses bearer-token auth via `ADMIN_TOKEN`. If you want SSO later, layer it in as a follow-up — not required for parity.

---

## Verification — before DNS cut

Run through each of these on `https://ramped-s98t.vercel.app`:

1. **Admin sign-in** — paste `ADMIN_TOKEN` at `/admin`, verify bookings + leads list matches legacy.
2. **Cron auth** — `curl -H "Authorization: Bearer $CRON_SECRET" https://ramped-s98t.vercel.app/api/reminders` should return `{"ok":true,...}` (lists empty unless a booking falls in the ±15-min window of "1h" or "24h" from now).
3. **Stripe test webhook** — Stripe Dashboard → Webhooks → "Send test webhook". Verify a row appears in `stripe_events`.
4. **Test booking** — `/book`, pick a slot, complete the form. Verify:
   - Confirmation email arrives at the test inbox
   - Google Meet link is in the email
   - Calendar invite appears on Andrew's calendar with the test email as attendee
   - A row appears in `bookings` table with `meet_link` populated
5. **Test contact** — `/` → contact form, submit. Verify ack email + owner email.
6. **Portal link** — copy a portal URL from admin → bookings, open in incognito. Verify portal renders with phase, next call, agents.
7. **Roadmap link** — same with a roadmap link. Verify renders.

**Disable legacy crons after step 1-2 succeed** — otherwise both projects fire their reminders on the same booking. Either:
- Remove the `crons` block from legacy `vercel.json` and redeploy legacy, OR
- Delete the legacy reminders + weekly-digest routes (they're live, redirected, idempotent — but two firing systems is one too many)

---

## Your turn — DNS cut (NOT YET)

When the verification above passes:

1. Vercel → `ramped-s98t` → Settings → Domains → add `30dayramp.com` and `www.30dayramp.com`
2. Vercel → legacy `ramped` project → Settings → Domains → remove same two
3. Update Stripe webhook URL to `https://www.30dayramp.com/api/stripe-webhook` (or run both in parallel and delete the legacy endpoint after a week)
4. Update Google OAuth redirect URI to `https://www.30dayramp.com/api/google-oauth-callback`
5. Update `SITE_URL` and `OAUTH_REDIRECT_HOST` env vars on `ramped-s98t` to `https://www.30dayramp.com`
6. Keep the legacy `ramped` deploy paused-not-deleted for ~30 days as rollback

---

## Known gaps / things that fall short of perfect parity

These don't block DNS cut but worth knowing:

- **v2 admin UI is read-only.** All 7 CRUD routes exist server-side, but the admin page only renders bookings + leads tables. The "Edit", "Delete", "Materials", "Tickets" tabs from legacy admin.html aren't ported — admin uses the legacy admin URL for those flows. This is fine because admin is internal-only and the API is fully usable; just a UI follow-up.
- **Customer portal pages don't have onboarding doc upload UI.** The `/api/portal-upload-url` endpoint exists but the `<input type="file">` flow on `/portal` isn't built. Can be added in a follow-up.
- **Portal billing tab not surfaced.** `/api/portal-billing` exists but the portal page doesn't render the invoice history yet — can be added.
- **No `/dashboard` redirect.** Legacy `vercel.json` had `/dashboard → /admin`. v2 doesn't have this rewrite — add to `web/vercel.json` if anyone has the old URL bookmarked.
- **Resources-refresh cron not registered.** The route exists at `/api/resources-refresh` but Vercel cron registration is missing. Either add to `web/vercel.json` crons or trigger externally.

---

## Where to look if something breaks

- **Vercel dashboard** → `ramped-s98t` → Logs (per route)
- **Supabase dashboard** → SQL editor for read queries against `bookings`, `stripe_events`, `agent_drafts`, `support_tickets`
- **Resend dashboard** → email send history with bounce/spam reports
- **Stripe dashboard** → Events log to confirm webhook delivery succeeded
- **`gh` CLI** to check the build: `gh run list --workflow=...` (none configured currently — Vercel deploys directly)
