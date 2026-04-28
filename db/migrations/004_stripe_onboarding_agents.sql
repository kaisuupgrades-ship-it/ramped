-- 004_stripe_onboarding_agents.sql
-- Adds Stripe billing fields, customer onboarding doc-collection, and the agent
-- runtime tables (agents / agent_runs / agent_drafts).
--
-- Run order: this is forward-only and idempotent. Safe to re-run.

-- ── Stripe billing on bookings ────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_customer_id        TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_subscription_id    TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_invoice_id         TEXT;     -- the onboarding/one-off invoice
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status            TEXT;     -- unpaid / onboarding_paid / subscription_active / past_due / cancelled
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_started_at   TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS onboarding_paid_at        TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS billing_cadence           TEXT;     -- monthly / annual
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contract_amount_cents     INTEGER;  -- monthly retainer in cents
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_customer ON bookings(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status  ON bookings(payment_status);

-- Stripe webhook event log — used for idempotency (don't replay events) + audit
CREATE TABLE IF NOT EXISTS stripe_events (
  id          TEXT PRIMARY KEY,                  -- Stripe's event id (evt_…)
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Customer onboarding (doc collection after they pay) ──────────────────────
-- One row per uploaded artifact. Multiple artifacts per booking.
CREATE TABLE IF NOT EXISTS onboarding_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,                    -- 'logo' / 'brand_voice' / 'sample_emails' / 'integrations' / 'other'
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,                    -- path in supabase storage 'onboarding/{booking_id}/{uuid}-{filename}'
  size_bytes   INTEGER,
  mime         TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_docs_booking ON onboarding_documents(booking_id, uploaded_at DESC);

-- One row per onboarding section that asks for typed text (not a file).
-- Schema:  bookings.onboarding_data JSONB { brand_voice_notes: "...", forbidden_phrases: "...", ... }
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS onboarding_data         JSONB DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ── Agent runtime ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  channel     TEXT,                              -- 'Email' / 'Phone + SMS' / 'Slack' / etc.
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'building',  -- building / live / paused / archived
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT  agents_status_chk CHECK (status IN ('building','live','paused','archived'))
);
CREATE INDEX IF NOT EXISTS idx_agents_booking ON agents(booking_id, status);

CREATE TABLE IF NOT EXISTS agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,                    -- 'draft_quote' / 'qualify_lead' / 'send_followup' / etc.
  outcome      TEXT,                             -- 'sent' / 'queued_for_approval' / 'skipped' / 'errored'
  duration_ms  INTEGER,
  hours_saved  NUMERIC(6,2),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_booking_created ON agent_runs(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created   ON agent_runs(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_drafts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  subject      TEXT,
  body         TEXT NOT NULL,
  recipient    TEXT,
  channel      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected / edited / sent
  decided_at   TIMESTAMPTZ,
  decided_by   TEXT,                             -- 'customer' / 'admin' / 'auto'
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT   drafts_status_chk CHECK (status IN ('pending','approved','rejected','edited','sent'))
);
CREATE INDEX IF NOT EXISTS idx_drafts_booking_status ON agent_drafts(booking_id, status, created_at DESC);
