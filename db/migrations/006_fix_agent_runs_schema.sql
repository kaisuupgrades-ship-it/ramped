-- 006_fix_agent_runs_schema.sql — reconcile dual definition of agent_runs.
--
-- Background (audit H2-3, 2026-04-29):
--   db/migrations/001_agent_logging.sql created `agent_runs` with columns
--     (client_id, agent_type, status, input_summary, error_message,
--      duration_ms, started_at, completed_at)
--   db/migrations/004_stripe_onboarding_agents.sql tries to CREATE TABLE
--     IF NOT EXISTS the same name with the new agent-runtime schema
--     (agent_id, booking_id, action, outcome, hours_saved, …).
--   The IF NOT EXISTS swallowed the conflict — production still has the 001
--   shape, while api/admin-agents.js, api/portal-data.js, api/weekly-digest.js
--   query the 004 columns and silently get 400s.
--
-- This migration:
--   1. Renames the legacy table out of the way (preserved as agent_runs_legacy).
--   2. Creates agent_runs with the 004 schema as the authoritative table.
--   3. Adds the indexes from 004.
--   4. Enables RLS with an explicit service_role policy (mirrors 001's pattern).
--
-- Forward-only. Idempotent because of the existence checks. Safe to re-run.

-- 1) Rename legacy if present (detected by the agent_type column unique to 001)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'agent_runs'
      AND column_name  = 'agent_type'
  ) THEN
    EXECUTE 'ALTER TABLE agent_runs RENAME TO agent_runs_legacy';
    RAISE NOTICE 'Renamed legacy agent_runs (mig-001 shape) to agent_runs_legacy';
  END IF;
END $$;

-- 2) Create the 004-shape agent_runs as authoritative
CREATE TABLE IF NOT EXISTS agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID REFERENCES agents(id) ON DELETE CASCADE,
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  action       TEXT NOT NULL,
  outcome      TEXT,
  duration_ms  INTEGER,
  hours_saved  NUMERIC(6,2),
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_booking_created ON agent_runs(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created   ON agent_runs(agent_id,   created_at DESC);

-- 3) RLS — service role bypasses, but document the policy explicitly.
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='agent_runs'
      AND policyname='service_role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role full access" ON agent_runs '
         || 'AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 4) Note for the operator running this:
--    api/_lib/logger.js (audit L2-2) still writes the mig-001 columns. After
--    this migration, that helper writes to a non-existent table. Either:
--      (a) retarget logger.js to the new schema, or
--      (b) delete logger.js if no callers remain (grep startRun/endRun/log).
--    Both options are tracked as audit follow-up.
