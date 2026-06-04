-- Migration: 0007_agency_instagram_url
-- Stores optional Instagram profile URLs submitted during agency registration
-- and copied onto approved agency records.

ALTER TABLE agency_application
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE agency
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;
