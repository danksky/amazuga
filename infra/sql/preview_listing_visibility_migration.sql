-- Add visibility column to listing table.
-- public   → shows in browse results and on direct link
-- unlisted → hidden from browse, but viewable on direct property page link
-- private  → hidden everywhere (reserved for future access-control use)
ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'private'));

CREATE INDEX IF NOT EXISTS listing_visibility_idx ON listing (visibility);
