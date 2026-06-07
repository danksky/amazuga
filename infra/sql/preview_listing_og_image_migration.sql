-- Add og_image_url to listing table.
-- NULL means no generated image yet (raw first photo used as fallback).
-- Populated asynchronously after listing images or key fields change.
ALTER TABLE listing ADD COLUMN IF NOT EXISTS og_image_url TEXT;
