-- 015_novnc_url.sql — noVNC URL for the browser-accessible virtual desktop.
--
-- Set by /api/bot-heartbeat alongside hermes_url. Format:
--   http://<droplet_ip>:6080/vnc.html
-- Password is the first 8 chars of api_server_key (see cloud-init).
-- Forward-only, idempotent.

ALTER TABLE ramped_bot_clients ADD COLUMN IF NOT EXISTS novnc_url TEXT;
