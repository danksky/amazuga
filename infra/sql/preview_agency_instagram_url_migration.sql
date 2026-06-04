BEGIN;

ALTER TABLE agency_application
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE agency
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

COMMIT;
