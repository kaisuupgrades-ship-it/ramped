-- 014_channel_config.sql — per-client Hermes channel configuration.
--
-- Stores the JSON blob the admin Channels tab edits (Slack/Discord/Email/AI
-- provider/Web search). Read by /api/bot-provision and /api/bot-reprovision
-- when generating cloud-init so the right env vars and config.yaml land on
-- the VPS. Forward-only, idempotent.

ALTER TABLE ramped_bot_clients
  ADD COLUMN IF NOT EXISTS channel_config JSONB DEFAULT '{}'::jsonb;
