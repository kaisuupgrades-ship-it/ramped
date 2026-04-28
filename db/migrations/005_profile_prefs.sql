-- 005_profile_prefs.sql — customer-editable profile fields.
-- Idempotent. Add new columns only — never drop or rename existing ones.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS phone                 TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notification_prefs    JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS profile_updated_at    TIMESTAMPTZ;

-- notification_prefs schema (loose):
--   {
--     "email_weekly_digest":      true,    // weekly hours-saved digest
--     "email_ticket_replies":     true,    // when admin replies to a support ticket
--     "email_billing":            true,    // invoices, payment failures, subscription changes
--     "email_agent_drafts":       true,    // drafts queued for human approval
--     "email_milestones":         true     // kickoff, go-live, etc.
--   }
-- All default to true; customer can opt out per category from the portal Profile section.
