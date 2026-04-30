-- 010_admin_audit_log.sql — forensic trail for admin mutations.
--
-- Audit M2-6 (2026-04-29): every destructive admin action should leave a row
-- here so we can reconstruct what happened if a bearer token is ever stolen,
-- or if a human admin makes a mistake we want to undo.
--
-- Each row captures: WHO (admin token hash, IP), WHAT (action verb), WHICH
-- (target table + id), WHY (optional reason text), and WHEN. Body diff is
-- stored as JSONB if the caller passes it.
--
-- Forward-only. Idempotent.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  action       TEXT NOT NULL,                 -- e.g. 'booking.delete' / 'invoice.create' / 'agent.archive'
  target_table TEXT,                          -- 'bookings' / 'agents' / 'support_tickets' / etc
  target_id    TEXT,                          -- UUID or external id of the affected row
  actor_hash   TEXT,                          -- sha256(admin_token + IP_HASH_SALT) — never the raw token
  actor_ip_hash TEXT,                         -- sha256(ip + IP_HASH_SALT) — never the raw IP
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- before/after diff or relevant fields
  result_status INTEGER,                      -- HTTP status the endpoint returned
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_target
  ON admin_audit_log (action, target_id);

-- RLS: service_role only (admin endpoints use service key; UI access is read-only via /api/admin-audit).
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_audit_log'
      AND policyname='service_role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role full access" ON admin_audit_log '
         || 'AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
