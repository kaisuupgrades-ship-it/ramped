-- 007_rls_hardening.sql — enable RLS on every table added in mig 003 and 004.
--
-- Background (audit H2-7, 2026-04-29): mig 001 enabled RLS on agent_runs/agent_logs
-- with an explicit service_role policy. Mig 003 (portal_events, support_tickets,
-- support_messages) and mig 004 (stripe_events, onboarding_documents, agents,
-- agent_drafts) did not. The API only authenticates with SUPABASE_SERVICE_KEY
-- today, so this isn't currently exploitable — but defense-in-depth: if the
-- anon key is ever leaked into a future client-side widget, anon role would
-- have full read on every customer's tickets, agent activity, and Stripe events.
--
-- Forward-only. Idempotent (DO blocks check pg_policies before CREATE).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'portal_events',
    'support_tickets',
    'support_messages',
    'stripe_events',
    'onboarding_documents',
    'agents',
    'agent_drafts'
  ]
  LOOP
    -- Enable RLS (no-op if already enabled)
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);

    -- Add explicit service_role bypass policy if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl
        AND policyname='service_role full access'
    ) THEN
      EXECUTE format(
        'CREATE POLICY "service_role full access" ON %I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- Smoke test (run as anon role in Supabase SQL editor with `SET ROLE anon;`):
--   select count(*) from portal_events;     -- expect: permission denied
--   select count(*) from support_tickets;   -- expect: permission denied
--   select count(*) from agents;            -- expect: permission denied
-- Reset with `RESET ROLE;`.
