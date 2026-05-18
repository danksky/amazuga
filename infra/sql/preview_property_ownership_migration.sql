BEGIN;

CREATE TABLE IF NOT EXISTS property_ownership (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  property_id TEXT NOT NULL,
  property_internal_id TEXT NOT NULL REFERENCES property_asset(id),
  parcel_id TEXT NOT NULL,
  ownership_scope TEXT NOT NULL CHECK (ownership_scope IN ('full', 'unit')),
  created_from_claim_request_id TEXT REFERENCES property_claim_request(id),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_property_internal_id_idx
  ON property_ownership (property_internal_id);

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_user_property_internal_id_idx
  ON property_ownership (user_id, property_internal_id);

CREATE INDEX IF NOT EXISTS property_ownership_user_id_idx
  ON property_ownership (user_id);

CREATE INDEX IF NOT EXISTS property_ownership_parcel_id_idx
  ON property_ownership (parcel_id);

COMMIT;
