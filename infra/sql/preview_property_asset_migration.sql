-- Adds app-owned property assets without breaking the current parcel-first preview model.
--
-- Important behavior:
-- - creates a primary asset for each existing parcel-backed profile/listing
-- - backfills listing.property_asset_id deterministically
-- - preserves listing.parcel_id for current app compatibility during rollout
-- - drops the one-active-listing-per-parcel constraint in favor of one-active-listing-per-asset

BEGIN;

CREATE TABLE IF NOT EXISTS property_asset (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL,
  parent_asset_id TEXT REFERENCES property_asset(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (
    asset_type IN (
      'house',
      'land',
      'apartment_building',
      'commercial_building',
      'apartment_unit',
      'commercial_unit'
    )
  ),
  public_id TEXT UNIQUE,
  display_code TEXT NOT NULL UNIQUE,
  unit_label TEXT,
  description TEXT,
  is_primary_for_parcel BOOLEAN NOT NULL DEFAULT FALSE,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS property_asset_one_primary_per_parcel_idx
  ON property_asset (parcel_id)
  WHERE is_primary_for_parcel;

CREATE INDEX IF NOT EXISTS property_asset_parcel_id_idx
  ON property_asset (parcel_id);

CREATE INDEX IF NOT EXISTS property_asset_parent_asset_id_idx
  ON property_asset (parent_asset_id);

CREATE INDEX IF NOT EXISTS property_asset_asset_type_idx
  ON property_asset (asset_type);

ALTER TABLE listing
ADD COLUMN IF NOT EXISTS property_asset_id TEXT;

ALTER TABLE property_asset
ADD COLUMN IF NOT EXISTS public_id TEXT;

WITH parcel_asset_source AS (
  SELECT DISTINCT
    source.parcel_id,
    p.public_id,
    pp.description,
    CASE
      WHEN LOWER(COALESCE(pp.property_type, '')) = 'house' THEN 'house'
      WHEN LOWER(COALESCE(pp.property_type, '')) IN ('parcel', 'land', 'lot') THEN 'land'
      WHEN LOWER(COALESCE(pp.property_type, '')) IN ('apartment', 'flat', 'unit') THEN 'apartment_unit'
      WHEN LOWER(COALESCE(pp.property_type, '')) LIKE 'commercial building%' THEN 'commercial_building'
      WHEN LOWER(COALESCE(pp.property_type, '')) LIKE 'commercial%' THEN 'commercial_unit'
      WHEN LOWER(COALESCE(pp.property_type, '')) LIKE 'apartment building%' THEN 'apartment_building'
      WHEN LOWER(COALESCE(pp.property_type, '')) LIKE 'building%' THEN 'apartment_building'
      ELSE NULL
    END AS asset_type,
    COALESCE(pp.seed_source, l.seed_source, 'migration_property_asset_v1') AS seed_source,
    COALESCE(pp.created_at, l.created_at, NOW()) AS created_at,
    GREATEST(COALESCE(pp.updated_at, pp.created_at, NOW()), COALESCE(l.updated_at, l.created_at, NOW())) AS updated_at
  FROM (
    SELECT parcel_id
    FROM property_profile
    UNION
    SELECT parcel_id
    FROM listing
  ) AS source
  LEFT JOIN property_profile pp
    ON pp.parcel_id = source.parcel_id
  LEFT JOIN (
    SELECT DISTINCT ON (parcel_id)
      parcel_id,
      seed_source,
      created_at,
      updated_at
    FROM listing
    ORDER BY parcel_id, created_at ASC, id ASC
  ) AS l
    ON l.parcel_id = source.parcel_id
  LEFT JOIN parcel_app_ready_seed_preview p
    ON p.parcel_id = source.parcel_id
)
INSERT INTO property_asset (
  id,
  parcel_id,
  asset_type,
  public_id,
  display_code,
  description,
  is_primary_for_parcel,
  seed_source,
  created_at,
  updated_at
)
SELECT
  'ast_' || SUBSTR(MD5('parcel-primary:' || parcel_id), 1, 20) AS id,
  parcel_id,
  asset_type,
  UPPER(SUBSTR(MD5('public:' || parcel_id), 1, 10)) AS public_id,
  'AST-' || UPPER(SUBSTR(MD5('display:' || parcel_id), 1, 10)) AS display_code,
  description,
  TRUE,
  seed_source,
  created_at,
  updated_at
FROM parcel_asset_source
ON CONFLICT (id) DO UPDATE
SET
  asset_type = EXCLUDED.asset_type,
  public_id = EXCLUDED.public_id,
  description = EXCLUDED.description,
  is_primary_for_parcel = EXCLUDED.is_primary_for_parcel,
  seed_source = EXCLUDED.seed_source,
  updated_at = GREATEST(property_asset.updated_at, EXCLUDED.updated_at);

UPDATE property_asset
SET public_id = UPPER(SUBSTR(MD5('public:' || parcel_id), 1, 10));

ALTER TABLE property_asset
ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS property_asset_public_id_idx
  ON property_asset (public_id);

UPDATE listing l
SET property_asset_id = pa.id
FROM property_asset pa
WHERE pa.parcel_id = l.parcel_id
  AND pa.is_primary_for_parcel
  AND l.property_asset_id IS NULL;

ALTER TABLE listing
ALTER COLUMN property_asset_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listing_property_asset_id_fkey'
  ) THEN
    ALTER TABLE listing
    ADD CONSTRAINT listing_property_asset_id_fkey
    FOREIGN KEY (property_asset_id) REFERENCES property_asset(id);
  END IF;
END $$;

DROP INDEX IF EXISTS listing_one_active_per_parcel_idx;

CREATE UNIQUE INDEX IF NOT EXISTS listing_one_active_per_asset_idx
  ON listing (property_asset_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS listing_parcel_id_idx
  ON listing (parcel_id);

CREATE INDEX IF NOT EXISTS listing_property_asset_id_idx
  ON listing (property_asset_id);

COMMENT ON TABLE property_asset IS
'App-owned marketable real estate object keyed to a parcel. Supports one parcel having many listable units over time.';

COMMENT ON COLUMN property_asset.public_id IS
'Public-safe property identifier for asset-level routes. This is the preferred user-facing property ID.';

COMMENT ON COLUMN property_asset.unit_label IS
'Optional sub-parcel unit label for apartment and commercial units, used to build stable canonical public slugs when a parcel has multiple marketable units.';

COMMENT ON COLUMN property_asset.is_primary_for_parcel IS
'Marks the default top-level asset for a parcel so legacy parcel-first records can be backfilled safely.';

COMMENT ON COLUMN listing.property_asset_id IS
'App-owned asset reference for the specific house, unit, suite, or parcel-backed asset being listed.';

DROP VIEW IF EXISTS preview_active_listing_surface_v1;

CREATE VIEW preview_active_listing_surface_v1 AS
SELECT
  l.id AS listing_id,
  l.parcel_id,
  l.property_asset_id,
  pa.public_id AS property_asset_public_id,
  p.public_id,
  p.upi,
  p.district,
  p.sector,
  p.cell,
  p.village,
  p.centroid_lat,
  p.centroid_lon,
  p.representative_size AS land_area_sqm,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
    ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
  END AS title,
  COALESCE(pa.description, pp.description) AS property_description,
  COALESCE(
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Parcel'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment'
      WHEN 'commercial_unit' THEN 'Commercial'
      ELSE 'Property'
    END,
    pp.property_type
  ) AS property_type,
  pp.bedrooms,
  pp.bathrooms,
  pp.interior_area_sqm,
  pp.year_built,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.description AS listing_description,
  l.published_at,
  a.id AS agency_id,
  a.slug AS agency_slug,
  a.business_name AS agency_name,
  a.whatsapp_phone,
  a.website_url,
  u.id AS agent_user_id,
  u.full_name AS agent_full_name,
  li.image_url AS primary_image_url
FROM listing l
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
LEFT JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN property_profile pp
  ON pp.parcel_id = l.parcel_id
JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

COMMENT ON VIEW preview_active_listing_surface_v1 IS
'Preview join surface for future browse and property queries once mock data is removed.';

COMMIT;
