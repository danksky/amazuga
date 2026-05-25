-- Track how many times a listing has been relisted after going inactive.
-- campaign_index starts at 1, increments each time inactive → active.
ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS campaign_index INTEGER NOT NULL DEFAULT 1;

-- Price history entries carry the campaign they belong to.
ALTER TABLE listing_price_history
  ADD COLUMN IF NOT EXISTS campaign_index INTEGER NOT NULL DEFAULT 1;
