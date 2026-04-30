-- 008_admin_materials.sql — internal materials library (admin uploads).
--
-- Powers the /admin → Materials tab. Stores metadata for files uploaded via the
-- admin UI; the file bytes themselves live in Supabase Storage (private bucket
-- `materials`). Repo-committed artifacts (audits, strategy docs) continue to
-- live in /materials.json — this table is for "anything Jon drops in from the
-- browser that isn't tracked in git."
--
-- Forward-only. Idempotent.

CREATE TABLE IF NOT EXISTS material_uploads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL CHECK (category IN ('strategy','audits','ops','design','sales','other')),
  title        TEXT NOT NULL,
  description  TEXT,
  filename     TEXT NOT NULL,           -- original filename, preserved for download UX
  storage_path TEXT NOT NULL UNIQUE,    -- path inside the `materials` bucket
  mime         TEXT,
  size_bytes   INTEGER,
  type_pill    TEXT,                    -- pptx | pdf | markdown | png | etc — drives UI badge
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_uploads_size_chk  CHECK (size_bytes IS NULL OR size_bytes BETWEEN 0 AND 26214400)  -- 25 MB
);

CREATE INDEX IF NOT EXISTS idx_material_uploads_category_uploaded
  ON material_uploads (category, uploaded_at DESC);

-- RLS — service_role only (mirrors mig 001 pattern; admin API uses service key).
ALTER TABLE material_uploads ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='material_uploads'
      AND policyname='service_role full access'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role full access" ON material_uploads '
         || 'AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Convenience: bump updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION material_uploads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_uploads_updated_at ON material_uploads;
CREATE TRIGGER trg_material_uploads_updated_at
  BEFORE UPDATE ON material_uploads
  FOR EACH ROW EXECUTE FUNCTION material_uploads_set_updated_at();

-- ── Operator notes ─────────────────────────────────────────────────────────
-- Before the first upload works, create the `materials` bucket in Supabase:
--   1. Supabase dashboard → Storage → New bucket
--   2. Name: materials (lowercase, exact)
--   3. Public: NO (private — files served via short-lived signed URLs)
--   4. Save.
-- The admin UI surfaces a clear error if the bucket is missing.
