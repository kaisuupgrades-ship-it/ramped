# Full-stack deploy guide — Stripe, onboarding, agents, notifications

What ships in this PR and what you need to do to make it work in production.

---

## 1. Run the migration

Open Supabase → SQL Editor → paste the contents of:

- `db/migrations/003_portal.sql` (if not already run — fixes the support-ticket 500 error)
- `db/migrations/004_stripe_onboarding_agents.sql`

Run them in order. Both are idempotent (`IF NOT EXISTS` guards everywhere) — safe to re-run.

---

## 2. Create the Supabase Storage bucket for onboarding documents

1. Supabase → Storage → New bucket
2. Name: `onboarding`
3. Public: **No** (private — files are accessed via signed URLs only)
4. Done.

If you used a different bucket name, set `SUPABASE_ONBOARDING_BUCKET` env var to match.

---

## 3. Set environment variables on Vercel

Go to Vercel → Project → Settings → Environment Variables. Add:

### Stripe (required for billing)

- `STRIPE_SECRET_KEY` — `sk_test_…` for testing, `sk_live_…` when ready for real money
- `STRIPE_WEBHOOK_SECRET` — `whsec_…` from the Stripe webhook setup (next step)

### Slack (optional but recommended)

- `SLACK_WEBHOOK_URL` — `https://hooks.slack.com/services/…` from a Slack incoming webhook. Pings on every new booking, ticket, payment event.

### Cron auth (optional — only matters if you want to manually trigger /api/weekly-digest)

- `CRON_SECRET` — any random string. The Vercel-cron header bypasses this; manual GETs need `Authorization: Bearer $CRON_SECRET`.

### Privacy (optional)

- `IP_HASH_SALT` — `openssl rand -hex 32` output. Used to hash IPs in `portal_events` so raw IPs never land in the DB. Default fallback exists but you should rotate.

After saving env vars, **trigger a redeploy** so the functions pick them up.

---

## 4. Create the Stripe webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://www.30dayramp.com/api/stripe-webhook`
3. Events to send:
   - `invoice.paid`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the signing secret (starts with `whsec_…`) and put it in `STRIPE_WEBHOOK_SECRET` on Vercel
5. Redeploy

Test it with `stripe trigger invoice.paid` from the Stripe CLI, or send a test event from the dashboard "Send test webhook" button.

---

## 5. End-to-end smoke test

1. **Booking flow** — book a test slot at `/book`. Confirm:
   - Booking confirmation email arrives with the new portal CTA
   - Slack pings `📅 New discovery call booked` (if `SLACK_WEBHOOK_URL` set)
   - Roadmap email arrives with portal CTA
2. **Portal access** — open the portal link from the email. Confirm:
   - Phase indicator says "Discovery call in N days" (pre-call) or "Day X / Build" (post-call)
   - Activity beacon fires (admin shows "👁 Portal: last seen just now")
   - Support ticket form works → ticket appears in admin Tickets tab + Slack ping
3. **Stripe flow** — in admin, find your test booking. Confirm:
   - "💳 Invoice" button visible
   - Clicking opens a confirm dialog → on confirm, Stripe creates the invoice
   - Customer gets a hosted invoice email from Stripe
   - When you mark the invoice paid (Stripe dashboard, test mode), webhook fires → admin payment status pill flips to `onboarding paid`
4. **Onboarding flow** — once `payment_status = onboarding_paid`, refresh the portal:
   - Onboarding kit section appears
   - Fill text fields, click "Save progress" — confirms saved
   - Upload a small file — appears in the list + admin can fetch the storage path
   - Click "I'm done" → Slack pings `✅ Customer finished onboarding`

---

## 6. Live mode go-live

When you're ready to charge real money:

1. Replace `STRIPE_SECRET_KEY` with your `sk_live_…` key
2. Re-create the webhook endpoint in **live mode** (separate URL setting in Stripe), copy the new `whsec_…` and update `STRIPE_WEBHOOK_SECRET`
3. Redeploy

Test mode and live mode are completely separate in Stripe — invoices created in test mode never appear in live mode and vice versa. Don't mix them up.

---

## What's where (file map)

| Concern | File |
|---|---|
| Stripe REST wrapper | `api/_lib/stripe.js` |
| Notify (Slack) helper | `api/_lib/notify.js` |
| Send onboarding invoice | `api/admin-create-invoice.js` |
| Start subscription | `api/admin-create-subscription.js` |
| Webhook handler | `api/stripe-webhook.js` |
| Customer onboarding form | `api/portal-onboarding.js` |
| File upload signed URL | `api/portal-upload-url.js` |
| Admin agents CRUD | `api/admin-agents.js` |
| Customer draft approvals | `api/portal-approve-draft.js` |
| Weekly digest cron | `api/weekly-digest.js` |
| Migration | `db/migrations/004_stripe_onboarding_agents.sql` |
| Cron + maxDuration config | `vercel.json` |

---

*Last updated: 2026-04-27.*
