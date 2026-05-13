-- 013_bot_booking_link.sql — link Ramped Bot clients back to bookings + cache email.
--
-- Two new columns on ramped_bot_clients so the admin CRM panel can show a
-- client's bot status alongside their booking record. Forward-only, idempotent.

ALTER TABLE ramped_bot_clients
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_bot_clients_booking_id ON ramped_bot_clients (booking_id);
