-- Migration 0013: Add listing_video table
-- Supports one optional video per listing. Thumbnail is captured client-side
-- (first frame as JPEG) and uploaded separately via the image upload URL.

CREATE TABLE IF NOT EXISTS listing_video (
  id                        TEXT PRIMARY KEY,
  listing_id                TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  video_url                 TEXT NOT NULL,
  video_storage_key         TEXT,
  thumbnail_url             TEXT,
  thumbnail_storage_key     TEXT,
  duration_seconds          INTEGER,
  content_type              TEXT,
  file_size_bytes           INTEGER,
  uploaded_by_user_id       UUID REFERENCES app_user(id),
  status                    TEXT NOT NULL DEFAULT 'ready' CHECK (
    status IN ('ready', 'pending_delete', 'delete_failed')
  ),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id)
);

CREATE INDEX IF NOT EXISTS listing_video_listing_id_idx
  ON listing_video (listing_id);
