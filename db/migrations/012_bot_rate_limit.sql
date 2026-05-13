-- 012_bot_rate_limit.sql — Supabase-backed rate-limit log for /api/bot-claim-code.
--
-- One row per claim attempt. Counted within a 60-minute sliding window: 10
-- per IP, 20 per code. Old rows (>24h) are swept opportunistically on every
-- request. Forward-only. Idempotent.

CREATE TABLE IF NOT EXISTS ramped_bot_claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  code TEXT NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claim_attempts_ip ON ramped_bot_claim_attempts (ip, attempted_at);
CREATE INDEX IF NOT EXISTS idx_claim_attempts_code ON ramped_bot_claim_attempts (code, attempted_at);
