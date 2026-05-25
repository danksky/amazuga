-- Append-only price history for listings.
-- A row is inserted whenever asking_price_rwf changes on an active listing,
-- and once at listing creation to record the opening price.
CREATE TABLE IF NOT EXISTS listing_price_history (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  price_rwf BIGINT NOT NULL CHECK (price_rwf > 0),
  changed_by_user_id TEXT REFERENCES app_user(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_price_history_listing_idx
  ON listing_price_history (listing_id, changed_at DESC);

-- Seed the opening price for every existing listing that has one.
-- Uses a deterministic ID so this is safe to re-run.
INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, changed_at)
SELECT
  'lph_init_' || l.id,
  l.id,
  l.asking_price_rwf,
  l.agent_user_id,
  l.created_at
FROM listing l
WHERE l.asking_price_rwf IS NOT NULL
ON CONFLICT (id) DO NOTHING;
