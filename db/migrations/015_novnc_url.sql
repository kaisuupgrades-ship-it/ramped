-- 015_novnc_url.sql — add novnc_url to ramped_bot_clients so the admin panel
-- can render an "Open Desktop" link to the per-droplet noVNC web client
-- (websockify on :6080 fronting x11vnc on :5901).
--
-- Forward-only. Idempotent.

ALTER TABLE ramped_bot_clients
  ADD COLUMN IF NOT EXISTS novnc_url TEXT;
