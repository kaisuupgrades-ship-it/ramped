-- 011_prospect_decks.sql
--
-- Per-booking auto-generated prep deck (custom PowerPoint per prospect).
-- Powers the new /admin/decks section. Built async after a booking is
-- created so it's ready when Jon prepares for the call.
--
-- Flow (lib/deck/generator.ts):
--   1. /api/book POST inserts a booking row + a prospect_decks row (pending)
--   2. Generator picks it up: scrape company_url → Claude extracts signals
--      → pptxgenjs renders deck → upload to Supabase Storage
--   3. Status transitions: pending → researching → generating → ready | failed
--   4. Admin UI shows the row with download + regenerate buttons

-- Bookings get an optional company_url so we have something to scrape.
-- Falls back to deriving from email domain when missing.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS company_url TEXT;

CREATE TABLE IF NOT EXISTS prospect_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- pending | researching | generating | ready | failed
  status TEXT NOT NULL DEFAULT 'pending',

  -- The URL we actually scraped (resolved from form field or email domain)
  company_url TEXT,
  -- "form" | "email_domain" | NULL — tells admin how confident the URL is
  company_url_source TEXT,

  -- Structured extraction from the scrape (industry, ICP, pains, founder, voice samples, etc.)
  research JSONB,
  -- "high" | "medium" | "low" — UX hint for whether admin should review carefully
  research_confidence TEXT,

  -- Bucket key for the generated .pptx (Supabase Storage)
  deck_storage_path TEXT,
  -- Human-readable filename (used for download)
  deck_filename TEXT,

  -- Template version used (so we can re-roll old decks when template moves)
  template_version TEXT,

  -- Chronological step + timings for debugging without re-running the pipeline
  generation_log JSONB,
  error_message TEXT,

  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lookup decks by booking quickly (admin UI joins bookings → prospect_decks)
CREATE INDEX IF NOT EXISTS prospect_decks_booking_id_idx
  ON prospect_decks (booking_id);

-- For a cron-style retry loop ("show me all pending or failed decks")
CREATE INDEX IF NOT EXISTS prospect_decks_status_created_idx
  ON prospect_decks (status, created_at DESC);

-- Keep updated_at in sync automatically
CREATE OR REPLACE FUNCTION prospect_decks_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospect_decks_updated_at_trigger ON prospect_decks;
CREATE TRIGGER prospect_decks_updated_at_trigger
  BEFORE UPDATE ON prospect_decks
  FOR EACH ROW
  EXECUTE FUNCTION prospect_decks_set_updated_at();

-- RLS: lock down the table — only the service role accesses it.
-- (Admin UI calls /api/admin/decks which uses the service role server-side.)
ALTER TABLE prospect_decks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default in Supabase, so we don't need an
-- explicit policy — denying everything else is the safe default.

COMMENT ON TABLE prospect_decks IS
  'Per-booking auto-generated prep deck. Built by lib/deck/generator.ts; reviewed via /admin/decks.';
