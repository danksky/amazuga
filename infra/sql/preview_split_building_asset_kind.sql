BEGIN;

ALTER TABLE property_asset
  DROP CONSTRAINT IF EXISTS property_asset_asset_type_check;

ALTER TABLE property_claim_request
  DROP CONSTRAINT IF EXISTS property_claim_request_declared_asset_type_check;

WITH building_resolution AS (
  SELECT
    pa.id,
    CASE
      WHEN pp.property_type = 'Commercial building' THEN 'commercial_building'
      WHEN pp.property_type = 'Apartment building' THEN 'apartment_building'
      WHEN EXISTS (
        SELECT 1
        FROM property_asset child
        WHERE child.parent_asset_id = pa.id
          AND child.asset_type = 'commercial_unit'
      ) THEN 'commercial_building'
      WHEN EXISTS (
        SELECT 1
        FROM property_asset child
        WHERE child.parent_asset_id = pa.id
          AND child.asset_type = 'apartment_unit'
      ) THEN 'apartment_building'
      WHEN COALESCE(parcel.zone_code, '') LIKE 'C%'
        OR LOWER(COALESCE(parcel.zoning, '')) LIKE '%commercial%'
        OR LOWER(COALESCE(parcel.gen_lu, '')) LIKE '%commercial%'
        THEN 'commercial_building'
      ELSE 'apartment_building'
    END AS resolved_asset_type
  FROM property_asset pa
  LEFT JOIN property_profile pp
    ON pp.parcel_id = pa.parcel_id
  LEFT JOIN parcel_app_ready_seed_preview parcel
    ON parcel.parcel_id = pa.parcel_id
  WHERE pa.asset_type = 'building'
)
UPDATE property_asset pa
SET
  asset_type = resolution.resolved_asset_type,
  updated_at = NOW()
FROM building_resolution resolution
WHERE resolution.id = pa.id;

WITH claim_resolution AS (
  SELECT
    pcr.id,
    CASE
      WHEN pcr.declared_property_type = 'commercial_building' THEN 'commercial_building'
      WHEN pcr.declared_property_type = 'apartment_building' THEN 'apartment_building'
      WHEN COALESCE(parcel.zone_code, '') LIKE 'C%'
        OR LOWER(COALESCE(parcel.zoning, '')) LIKE '%commercial%'
        OR LOWER(COALESCE(parcel.gen_lu, '')) LIKE '%commercial%'
        THEN 'commercial_building'
      ELSE 'apartment_building'
    END AS resolved_asset_type
  FROM property_claim_request pcr
  LEFT JOIN parcel_app_ready_seed_preview parcel
    ON parcel.parcel_id = pcr.parcel_id
  WHERE pcr.declared_asset_type = 'building'
)
UPDATE property_claim_request pcr
SET
  declared_asset_type = resolution.resolved_asset_type,
  updated_at = NOW()
FROM claim_resolution resolution
WHERE resolution.id = pcr.id;

ALTER TABLE property_asset
  ADD CONSTRAINT property_asset_asset_type_check
  CHECK (
    asset_type IN (
      'house',
      'land',
      'apartment_building',
      'commercial_building',
      'apartment_unit',
      'commercial_unit'
    )
  );

ALTER TABLE property_claim_request
  ADD CONSTRAINT property_claim_request_declared_asset_type_check
  CHECK (
    declared_asset_type IN (
      'house',
      'land',
      'apartment_building',
      'commercial_building',
      'apartment_unit',
      'commercial_unit'
    )
  );

COMMIT;
