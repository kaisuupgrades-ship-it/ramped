-- db/migrations/001_agent_logging.sql
-- Creates agent_runs and agent_logs tables for tracking AI agent activity.

-- ── agent_runs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_runs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      text        NOT NULL,
  agent_type     text        NOT NULL,
  status         text        NOT NULL DEFAULT 'running',
  input_summary  jsonb       NOT NULL DEFAULT '{}',
  error_message  text,
  duration_ms    integer,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_agent_runs_client_started
  ON agent_runs (client_id, started_at DESC);

-- ── agent_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id      uuid        REFERENCES agent_runs(id) ON DELETE CASCADE,
  client_id   text        NOT NULL,
  level       text        NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_agent_logs_run_id
  ON agent_logs (run_id);

CREATE INDEX IF NOT EXISTS idx_agent_logs_client_created
  ON agent_logs (client_id, created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enable RLS so anonymous/public roles cannot read or write these tables.
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- Service-role bypass: the API (which authenticates with SUPABASE_SERVICE_KEY)
-- uses the `service_role` role, which skips RLS entirely by design in Supabase.
-- We also add explicit policies so they are clearly documented in the dashboard.

-- Deny all access to non-service roles by default (no permissive policies for anon/authenticated).
-- The service_role role bypasses RLS, so no explicit policy is needed for it,
-- but we add a named one for clarity and future reference.

CREATE POLICY "service_role full access" ON agent_runs
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role full access" ON agent_logs
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
