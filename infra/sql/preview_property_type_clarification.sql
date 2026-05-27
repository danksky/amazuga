BEGIN;

WITH parcel_type_resolution AS (
  SELECT
    pp.parcel_id,
    CASE
      WHEN pa.asset_type = 'house' THEN 'House'
      WHEN pa.asset_type = 'land' THEN 'Land'
      WHEN pa.asset_type = 'apartment_unit' THEN 'Apartment unit'
      WHEN pa.asset_type = 'commercial_unit' THEN 'Commercial unit'
      WHEN pa.asset_type = 'commercial_building' THEN 'Commercial building'
      WHEN pa.asset_type = 'apartment_building' THEN 'Apartment building'
      WHEN pa.asset_type = 'building' AND EXISTS (
        SELECT 1
        FROM property_asset child
        WHERE child.parent_asset_id = pa.id
          AND child.asset_type = 'commercial_unit'
      ) THEN 'Commercial building'
      WHEN pa.asset_type = 'building' AND EXISTS (
        SELECT 1
        FROM property_asset child
        WHERE child.parent_asset_id = pa.id
          AND child.asset_type = 'apartment_unit'
      ) THEN 'Apartment building'
      WHEN pa.asset_type = 'building' AND (
        COALESCE(parcel.zone_code, '') LIKE 'C%'
        OR LOWER(COALESCE(parcel.zoning, '')) LIKE '%commercial%'
        OR LOWER(COALESCE(parcel.gen_lu, '')) LIKE '%commercial%'
      ) THEN 'Commercial building'
      WHEN pa.asset_type = 'building' THEN 'Apartment building'
      ELSE NULL
    END AS clarified_property_type
  FROM property_profile pp
  JOIN property_asset pa
    ON pa.parcel_id = pp.parcel_id
   AND pa.is_primary_for_parcel
  LEFT JOIN parcel_app_ready_seed_preview parcel
    ON parcel.parcel_id = pp.parcel_id
)
UPDATE property_profile pp
SET
  property_type = resolved.clarified_property_type,
  updated_at = NOW()
FROM parcel_type_resolution resolved
WHERE resolved.parcel_id = pp.parcel_id
  AND resolved.clarified_property_type IS NOT NULL
  AND pp.property_type IS DISTINCT FROM resolved.clarified_property_type;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'property_profile_no_plain_building_check'
  ) THEN
    ALTER TABLE property_profile
    ADD CONSTRAINT property_profile_no_plain_building_check
    CHECK (LOWER(BTRIM(property_type)) <> 'building');
  END IF;
END $$;

COMMIT;
