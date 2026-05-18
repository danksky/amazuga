BEGIN;

ALTER TABLE property_asset
ADD COLUMN IF NOT EXISTS unit_label TEXT;

COMMENT ON COLUMN property_asset.unit_label IS
'Optional sub-parcel unit label for apartment and commercial units, used to build stable canonical public slugs when a parcel has multiple marketable units.';

COMMIT;
