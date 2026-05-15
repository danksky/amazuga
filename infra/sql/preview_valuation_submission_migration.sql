BEGIN;

CREATE TABLE IF NOT EXISTS valuation_submission (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  property_asset_id TEXT REFERENCES property_asset(id),
  legacy_property_ref TEXT,
  submitted_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  effective_date DATE NOT NULL,
  estimated_value_rwf BIGINT NOT NULL CHECK (estimated_value_rwf > 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_asset_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS valuation_submission_property_asset_id_idx
  ON valuation_submission (property_asset_id);

CREATE INDEX IF NOT EXISTS valuation_submission_submitted_by_user_id_idx
  ON valuation_submission (submitted_by_user_id);

CREATE INDEX IF NOT EXISTS valuation_submission_status_idx
  ON valuation_submission (status);

CREATE INDEX IF NOT EXISTS valuation_submission_effective_date_idx
  ON valuation_submission (effective_date DESC);

WITH valuation_seed AS (
  SELECT
    'valuation-1'::TEXT AS id,
    pa.public_id AS property_id,
    pa.id AS property_asset_id,
    NULL::TEXT AS legacy_property_ref,
    'user-7'::TEXT AS submitted_by_user_id,
    FALSE AS is_anonymous,
    '2026-02-01'::DATE AS effective_date,
    176000000::BIGINT AS estimated_value_rwf,
    'RWF'::TEXT AS currency,
    'approved'::TEXT AS status,
    'mock_import_listing_surface_v1'::TEXT AS seed_source,
    '2026-02-01T08:00:00.000Z'::TIMESTAMPTZ AS created_at,
    '2026-02-01T08:00:00.000Z'::TIMESTAMPTZ AS updated_at
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'

  UNION ALL

  SELECT
    'valuation-2'::TEXT AS id,
    pa.public_id AS property_id,
    pa.id AS property_asset_id,
    NULL::TEXT AS legacy_property_ref,
    'user-7'::TEXT AS submitted_by_user_id,
    TRUE AS is_anonymous,
    '2025-11-18'::DATE AS effective_date,
    168000000::BIGINT AS estimated_value_rwf,
    'RWF'::TEXT AS currency,
    'approved'::TEXT AS status,
    'mock_import_listing_surface_v1'::TEXT AS seed_source,
    '2025-11-18T08:00:00.000Z'::TIMESTAMPTZ AS created_at,
    '2025-11-18T08:00:00.000Z'::TIMESTAMPTZ AS updated_at
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'
)
INSERT INTO valuation_submission (
  id,
  property_id,
  property_asset_id,
  legacy_property_ref,
  submitted_by_user_id,
  is_anonymous,
  effective_date,
  estimated_value_rwf,
  currency,
  status,
  seed_source,
  created_at,
  updated_at
)
SELECT
  id,
  property_id,
  property_asset_id,
  legacy_property_ref,
  submitted_by_user_id,
  is_anonymous,
  effective_date,
  estimated_value_rwf,
  currency,
  status,
  seed_source,
  created_at,
  updated_at
FROM valuation_seed
ON CONFLICT (id) DO UPDATE
SET
  property_id = EXCLUDED.property_id,
  property_asset_id = EXCLUDED.property_asset_id,
  legacy_property_ref = EXCLUDED.legacy_property_ref,
  submitted_by_user_id = EXCLUDED.submitted_by_user_id,
  is_anonymous = EXCLUDED.is_anonymous,
  effective_date = EXCLUDED.effective_date,
  estimated_value_rwf = EXCLUDED.estimated_value_rwf,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

COMMENT ON TABLE valuation_submission IS
'Preview DB-backed valuation history. property_asset_id is the preferred link to current preview properties.';

COMMIT;
