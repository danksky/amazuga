BEGIN;

ALTER TABLE listing_image
DROP CONSTRAINT IF EXISTS listing_image_status_check;

ALTER TABLE listing_image
ADD CONSTRAINT listing_image_status_check
CHECK (status IN ('ready', 'processing', 'failed', 'pending_delete', 'delete_failed'));

CREATE TABLE IF NOT EXISTS listing_image_cleanup_job (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by_user_id TEXT REFERENCES app_user(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_image_cleanup_job_status_run_after_idx
  ON listing_image_cleanup_job (status, run_after);

COMMIT;
