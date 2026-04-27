# Client Portal — Plan & Architecture

**Status:** Phase 1 (frontend prototype) shipped at `/portal` with mock data. Phase 2 wires up real Supabase + signed-token auth. Phase 3 layers in agent telemetry / approvals / billing.

---

## Why a portal exists at all

Ramped sells "an AI department, live in 30 days, on a flat monthly retainer." That promise creates two specific anxieties for every customer:

1. **Pre-launch (weeks 1–4):** "Is this actually being built? What's happening between the discovery call and go-live?" — they bought a 30-day commitment based on trust and need visibility into progress.
2. **Post-launch (week 4+):** "Are the agents actually working? How much time are they saving me? Are they doing dumb things?" — agents run autonomously, so customers need a window into what the agents are doing on their behalf.

The portal exists to make the invisible visible. Without it, every customer churns to the same question — "what's actually happening?" — and the only answer is a status email from Jon. That doesn't scale.

A second-order benefit: the portal is also our retention surface. The metrics we show (hours saved, replies sent, revenue recovered) are the proof points that justify the next renewal.

---

## Comparable portal patterns (B2B SaaS)

Reference points worth stealing from:

- **Stripe customer portal** — invoices, subscription, payment method, billing history. Tight, single-purpose. Stripe owns the auth.
- **Vercel project dashboard** — deploys, analytics, env vars, team, billing, integrations. Sidebar nav, dense info.
- **Linear** — issue list, projects, cycles. Keyboard-first, fast.
- **Notion workspace** — sidebar with sections, content area, settings drawer.
- **Intercom Messenger** — embedded support messaging in a corner widget.
- **HubSpot/Pipedrive customer portals** — deals, activities, contact details, reports.
- **Lovable/Bolt customer dashboards** — project history, deploy status, billing.

The strongest pattern for our use case is **Vercel-style sidebar + Stripe-style billing card + Linear-style activity feed**. Dense but clean, no fluff, every pixel earns its keep.

---

## Sections — what goes in the portal

Ranked by phase, so we can ship in priority order.

### Phase 1 — Onboarding visibility (weeks 1–4)

| Section | Why it matters | Data source |
|---|---|---|
| **Implementation status** | The single most important pre-launch widget — shows what phase the build is in. Steps: Kickoff → Discovery → Build → QA → Live. Current step highlighted. | `bookings.status` + custom milestones table |
| **Your roadmap** | The roadmap email is one-shot — customers want to re-read it. Embed or link to `/roadmap?id=…` (already built). | `bookings.automation_map` |
| **Your team** | "You're working with Andrew, Jonathan, and Jon." Helps put faces to the company. | Static |
| **Next call** | The booked discovery call (or weekly check-in) with date/time + Meet link. | `bookings.datetime`, `bookings.meet_link` |
| **Documents** | Kickoff materials they uploaded, brand voice notes, integrations list, etc. | Supabase storage, future |
| **Support** | "Got a question? Email Jon." A real button. | mailto |

### Phase 2 — Live operations (week 4+)

| Section | Why it matters | Data source |
|---|---|---|
| **Dashboard / metrics** | Hours saved this week/month, replies sent, leads qualified. The retention proof. | New `agent_runs` aggregations |
| **Your agents** | List of agents (Inbound Quote Drafter, Lead Qualifier, etc.) with status pill (Live / Paused / Building) and per-agent metrics. | New `agents` table |
| **Activity feed** | Chronological log of what each agent did, recent first. Filterable by agent. | New `agent_logs` table |
| **Approvals queue** | For agents on human-in-the-loop, drafts waiting for review/edit/approve before send. | New `agent_drafts` table |
| **Weekly reports archive** | Same content as the weekly digest email, viewable in-portal. | Generated from `agent_runs` |

### Phase 3 — Account / billing (after Stripe lands)

| Section | Data source |
|---|---|
| **Billing** — invoices, payment method, next charge date, payment history | Stripe (PR 6 backlog) |
| **Subscription** — current plan (Starter/Growth), upgrade/downgrade, cancel | Stripe |
| **Settings** — name, company, contact preferences, email opt-out toggles | `bookings` row |
| **Agent controls** — pause/resume specific agents, change human-in-the-loop preference | `agents` table |

---

## Authentication

We do **not** want customer accounts (with passwords) for the MVP. That's an account creation flow we'd have to support, password resets, MFA — too much for a small team.

Use the same pattern we already shipped for `/roadmap` — **HMAC-signed URL tokens**:

- `MAP_LINK_SECRET` env var (already configured)
- URL: `/portal?id=UUID&exp=EPOCH&t=HMAC`
- Token expires after 90 days (longer than roadmap's 30 because customers will return repeatedly)
- Backend `/api/portal-data` validates token, returns the booking + related data
- Email customers their portal link in: booking confirmation, roadmap email, weekly reports
- "Bookmark this link to come back anytime" hint in those emails

This is the same threat model as `/roadmap` — token in their email is the auth. If they forward the email, the recipient can read but can't write to anything sensitive (the only writes from portal are settings/preferences, which still pass through validated endpoints).

**Future upgrade path** to "real" auth: once we have >10 customers, layer in magic-link login (email a one-time link → set a 90-day session cookie). The portal pages stay the same, only the auth middleware changes.

---

## Data model — what we need

Existing (no schema changes needed):
- `bookings` table has everything Phase 1 needs

New tables for Phase 2 (sketched, not migrated yet):

```sql
-- One row per agent we've built for a customer
CREATE TABLE agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- "Inbound Quote Drafter"
  channel     TEXT,                     -- "Email" / "Phone + SMS" / etc.
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'building',  -- building / live / paused
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per discrete agent action (replied to email, qualified lead, etc.)
CREATE TABLE agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,           -- "draft_quote" / "qualify_lead" / etc.
  outcome      TEXT,                    -- "sent" / "queued_for_approval" / "skipped"
  duration_ms  INT,
  hours_saved  NUMERIC,                 -- imputed savings
  metadata     JSONB DEFAULT '{}',      -- whatever payload helps the activity feed
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_agent_runs_booking_id_created ON agent_runs (booking_id, created_at DESC);

-- Drafts queued for human review before send
CREATE TABLE agent_drafts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  subject     TEXT,
  body        TEXT,
  recipient   TEXT,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending / approved / rejected / edited
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Phase 3 (post-Stripe) — `customer_invoices` and `customer_subscriptions` tables, or pull-through from Stripe API on demand.

---

## API endpoints

| Endpoint | Method | Purpose | Auth |
|---|---|---|---|
| `/api/portal-data` | GET | Returns the customer's full portal payload (booking, roadmap, agents, recent activity, metrics summary) | HMAC token |
| `/api/portal-update-settings` | POST | Update contact prefs, email opt-out, etc. | HMAC token |
| `/api/portal-approve-draft` | POST | Approve / edit / reject a queued draft | HMAC token (Phase 2) |
| `/api/portal-toggle-agent` | POST | Pause/resume an agent | HMAC token (Phase 2) |

All auth via the same `verifyMapToken()` from `api/_lib/map-token.js` — extend it to also accept a `?type=portal` parameter so portal tokens can have a different (longer) TTL than roadmap tokens.

---

## Email integration

Both `/api/book.js` (booking confirmation) and `/api/questionnaire.js` (roadmap email) should include a "Your client portal" CTA card alongside the existing "View your roadmap" card. Add `signMapToken(bookingId, ttlSeconds=7776000)` for 90-day tokens.

Future weekly reports from `/api/reminders.js` (or a new `/api/weekly-report.js` cron) should also lead with the portal link — that drives habit-forming repeat visits.

---

## What's shipped in this PR

- `portal.html` — frontend prototype with rich mock data demonstrating all Phase 1 sections
- Vercel rewrite for `/portal` route
- Stub `/api/portal-data.js` returning the customer's booking + automation_map (signed token validated, fails closed if `MAP_LINK_SECRET` missing)
- Note: full agent telemetry / approvals / billing intentionally **not** wired — they're Phase 2/3 work

## What's NOT shipped (and why)

- **Real agent data** — we don't have an `agents` table yet, and the agents themselves aren't running yet. Mock data demonstrates the layout; once agents ship, replace mock with real query.
- **Approvals queue** — same reason. Will land with the agent runtime.
- **Billing card data** — depends on PR 6 (Stripe), still in pending tasks.
- **Settings writes** — toggling agent preferences requires the `agents` table. Read-only for now.
- **Email portal-link injection** — adds a new card to two transactional emails. Held back to keep this PR focused on the portal itself; do as a follow-up.

---

## Next steps to make it real

1. Migration `db/migrations/004_agents.sql` for the three new tables above.
2. Wire `/api/portal-data` to also return agents, recent agent_runs, and pending drafts (gated behind feature flag until first customer goes live).
3. Add the portal CTA card to `book.js` and `questionnaire.js` emails — same pattern as the roadmap CTA.
4. Build the agent runtime that populates `agent_runs` (out of scope for the portal PR — that's the actual product).

---

*Last updated: 2026-04-27.*
