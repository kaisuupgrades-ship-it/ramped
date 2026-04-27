-- 003_portal.sql — Client portal: activity tracking + support tickets.
--
-- Run on Supabase via SQL editor or `psql -f`. Idempotent (uses IF NOT EXISTS).
--
-- New surfaces this enables:
--   * /api/portal-track     — portal frontend beacon, populates portal_events + bumps bookings.portal_last_seen_at
--   * /api/portal-tickets   — customer create/list tickets (HMAC token auth)
--   * /api/admin-tickets    — admin inbox (admin bearer token auth)
--   * /api/admin-reply-ticket — admin replies, emails customer with portal link

-- ── Portal activity events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_events (
  id          BIGSERIAL PRIMARY KEY,
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,            -- 'view' / 'click_roadmap' / 'click_meet' / 'submit_ticket' / etc.
  path        TEXT,                      -- pathname of the portal page hit
  ip_hash     TEXT,                      -- sha256 of (ip + IP_HASH_SALT) — never store raw IP
  ua_hint     TEXT,                      -- short UA classification: 'iOS Safari', 'Chrome desktop', etc.
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_events_booking_created
  ON portal_events (booking_id, created_at DESC);

-- Materialized aggregates on bookings so admin can render "last seen" + visit count
-- without a join. Bumped by /api/portal-track on every event.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS portal_last_seen_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS portal_visit_count  INTEGER NOT NULL DEFAULT 0;

-- ── Support tickets ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',  -- open / replied / closed
  last_msg_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_status_chk
    CHECK (status IN ('open','replied','closed'))
);
CREATE INDEX IF NOT EXISTS idx_tickets_booking_created
  ON support_tickets (booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_lastmsg
  ON support_tickets (status, last_msg_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender      TEXT NOT NULL,            -- 'customer' / 'admin'
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_sender_chk
    CHECK (sender IN ('customer','admin'))
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_created
  ON support_messages (ticket_id, created_at);

-- Convenience: bump support_tickets.last_msg_at + status when a new message lands.
-- Trigger keeps the join-free admin inbox view fast.
CREATE OR REPLACE FUNCTION support_messages_after_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE support_tickets
     SET last_msg_at = NEW.created_at,
         updated_at  = NEW.created_at,
         status      = CASE
                         WHEN NEW.sender = 'admin'    THEN 'replied'
                         WHEN NEW.sender = 'customer' THEN 'open'
                         ELSE status
                       END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_messages_after_insert ON support_messages;
CREATE TRIGGER trg_support_messages_after_insert
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION support_messages_after_insert();
