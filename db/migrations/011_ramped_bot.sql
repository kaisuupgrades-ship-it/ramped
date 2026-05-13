-- 011_ramped_bot.sql — Ramped Bot (per-client VPS) provisioning + setup codes.
--
-- Renamed from 008_ramped_bot.sql in the brief: 008 + 010 already exist in this
-- repo (008_admin_materials.sql, 010_admin_audit_log.sql), so the next free
-- sequence number is 011. Forward-only. Idempotent.

CREATE TABLE IF NOT EXISTS ramped_bot_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  droplet_id TEXT,
  droplet_ip TEXT,
  vps_status TEXT DEFAULT 'pending',
  hermes_url TEXT,
  api_server_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS ramped_bot_setup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES ramped_bot_clients(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  claimed_by_ip TEXT
);
