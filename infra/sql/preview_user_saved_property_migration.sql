BEGIN;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS mock_persona_label TEXT;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS mock_persona_description TEXT;

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS upi_lookup_count_today INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_user_upi_lookup_count_today_nonnegative'
  ) THEN
    ALTER TABLE app_user
    ADD CONSTRAINT app_user_upi_lookup_count_today_nonnegative
    CHECK (upi_lookup_count_today >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE app_user
VALIDATE CONSTRAINT app_user_upi_lookup_count_today_nonnegative;

CREATE TABLE IF NOT EXISTS saved_property (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  property_route_id TEXT,
  legacy_property_ref TEXT,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_route_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS saved_property_user_id_idx
  ON saved_property (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_route_id_idx
  ON saved_property (user_id, property_route_id)
  WHERE property_route_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_legacy_ref_idx
  ON saved_property (user_id, legacy_property_ref)
  WHERE legacy_property_ref IS NOT NULL;

WITH persona_source AS (
  SELECT *
  FROM (
    VALUES
      (
        'user-1',
        'Admin',
        'Moderates applications and reviews platform activity.',
        0
      ),
      (
        'user-2',
        'Consumer',
        'Typical buyer browsing homes and saving properties.',
        3
      ),
      (
        'user-3',
        'Prospective agent',
        'Has not applied yet and should start the sell flow from scratch.',
        0
      ),
      (
        'user-4',
        'Pending agency founder',
        'Submitted an agency registration that is still under review.',
        0
      ),
      (
        'user-5',
        'Approved agency manager',
        'Approved as both agent and manager, with an active agency.',
        0
      ),
      (
        'user-6',
        'Pending valuator',
        'Submitted valuator recognition and is waiting for review.',
        0
      ),
      (
        'user-7',
        'Approved valuator',
        'Recognized valuator with approved valuation activity.',
        0
      )
  ) AS t(user_id, mock_persona_label, mock_persona_description, upi_lookup_count_today)
)
UPDATE app_user u
SET
  mock_persona_label = ps.mock_persona_label,
  mock_persona_description = ps.mock_persona_description,
  upi_lookup_count_today = ps.upi_lookup_count_today,
  updated_at = NOW()
FROM persona_source ps
WHERE ps.user_id = u.id;

WITH mock_property_route_map AS (
  SELECT 'property-1'::TEXT AS legacy_property_ref, pa.public_id AS property_route_id
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'
  UNION ALL
  SELECT 'property-3'::TEXT AS legacy_property_ref, pa.public_id AS property_route_id
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-2'
),
saved_property_seed AS (
  SELECT
    'svp_' || SUBSTR(MD5('saved:user-2:property-1'), 1, 20) AS id,
    'user-2'::TEXT AS user_id,
    m1.property_route_id,
    NULL::TEXT AS legacy_property_ref,
    'mock_import_listing_surface_v1'::TEXT AS seed_source
  FROM mock_property_route_map m1
  WHERE m1.legacy_property_ref = 'property-1'

  UNION ALL

  SELECT
    'svp_' || SUBSTR(MD5('saved:user-2:property-3'), 1, 20) AS id,
    'user-2'::TEXT AS user_id,
    m3.property_route_id,
    NULL::TEXT AS legacy_property_ref,
    'mock_import_listing_surface_v1'::TEXT AS seed_source
  FROM mock_property_route_map m3
  WHERE m3.legacy_property_ref = 'property-3'
)
INSERT INTO saved_property (
  id,
  user_id,
  property_route_id,
  legacy_property_ref,
  seed_source
)
SELECT
  id,
  user_id,
  property_route_id,
  legacy_property_ref,
  seed_source
FROM saved_property_seed
ON CONFLICT (id) DO UPDATE
SET
  property_route_id = EXCLUDED.property_route_id,
  legacy_property_ref = EXCLUDED.legacy_property_ref,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

COMMENT ON COLUMN app_user.mock_persona_label IS
'Short mock persona label used by the preview quick-sign-in UI.';

COMMENT ON COLUMN app_user.mock_persona_description IS
'Longer mock persona description used by the preview quick-sign-in UI.';

COMMENT ON COLUMN app_user.upi_lookup_count_today IS
'Preview-only counter preserved from the mock user fixtures.';

COMMENT ON TABLE saved_property IS
'User saved-property references. property_route_id is the preferred asset-aware route ID for preview runtime.';

COMMIT;
