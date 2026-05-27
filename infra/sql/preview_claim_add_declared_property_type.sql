ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS declared_property_type TEXT
    CHECK (declared_property_type IN (
      'house',
      'apartment_building',
      'land',
      'apartment_unit',
      'commercial_building',
      'commercial_unit'
    ));

UPDATE property_claim_request pcr
SET declared_property_type = CASE
  WHEN pcr.declared_asset_type = 'commercial_building' THEN 'commercial_building'
  WHEN pcr.declared_asset_type = 'apartment_building' THEN 'apartment_building'
  WHEN pcr.declared_asset_type = 'building' AND (
    COALESCE(parcel.zone_code, '') LIKE 'C%'
    OR LOWER(COALESCE(parcel.zoning, '')) LIKE '%commercial%'
    OR LOWER(COALESCE(parcel.gen_lu, '')) LIKE '%commercial%'
  ) THEN 'commercial_building'
  WHEN pcr.declared_asset_type = 'building' THEN 'apartment_building'
  WHEN pcr.declared_asset_type = 'house' THEN 'house'
  WHEN pcr.declared_asset_type = 'land' THEN 'land'
  WHEN pcr.declared_asset_type = 'apartment_unit' THEN 'apartment_unit'
  WHEN pcr.declared_asset_type = 'commercial_unit' THEN 'commercial_unit'
  ELSE declared_property_type
END
FROM parcel_app_ready_seed_preview parcel
WHERE parcel.parcel_id = pcr.parcel_id
  AND pcr.declared_asset_type IS NOT NULL
  AND (pcr.declared_property_type IS NULL OR BTRIM(pcr.declared_property_type) = '');

ALTER TABLE property_claim_request
  DROP CONSTRAINT IF EXISTS property_claim_request_no_plain_building_type_check;

ALTER TABLE property_claim_request
  ADD CONSTRAINT property_claim_request_no_plain_building_type_check
  CHECK (COALESCE(LOWER(BTRIM(declared_property_type)), '') <> 'building');
