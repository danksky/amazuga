ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS declared_asset_type TEXT
    CHECK (declared_asset_type IN (
      'house', 'land', 'building', 'apartment_unit', 'commercial_unit', 'mixed_use', 'other'
    ));
