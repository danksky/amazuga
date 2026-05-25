BEGIN;

ALTER TABLE listing_image
ADD COLUMN IF NOT EXISTS storage_key TEXT,
ADD COLUMN IF NOT EXISTS content_type TEXT,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER,
ADD COLUMN IF NOT EXISTS uploaded_by_user_id TEXT REFERENCES app_user(id),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'failed'));

CREATE INDEX IF NOT EXISTS listing_image_listing_id_status_idx
  ON listing_image (listing_id, status);

COMMIT;
