-- Per-listing access grants for private visibility listings.
-- When visibility = 'private', only users with a row here (plus the
-- listing's own agent) can see the listing on the property page.
CREATE TABLE IF NOT EXISTS listing_access_grant (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  granted_to_user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  granted_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, granted_to_user_id)
);

CREATE INDEX IF NOT EXISTS listing_access_grant_listing_idx
  ON listing_access_grant (listing_id);

CREATE INDEX IF NOT EXISTS listing_access_grant_user_idx
  ON listing_access_grant (granted_to_user_id);
