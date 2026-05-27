BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM property_asset WHERE asset_type IN ('mixed_use', 'other')) THEN
    RAISE EXCEPTION 'Cannot remove mixed_use/other: property_asset still contains those asset types.';
  END IF;

  IF EXISTS (SELECT 1 FROM property_claim_request WHERE declared_asset_type IN ('mixed_use', 'other')) THEN
    RAISE EXCEPTION 'Cannot remove mixed_use/other: property_claim_request still contains those declared asset types.';
  END IF;
END $$;

ALTER TABLE property_asset
  DROP CONSTRAINT IF EXISTS property_asset_asset_type_check;

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
  DROP CONSTRAINT IF EXISTS property_claim_request_declared_asset_type_check;

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
