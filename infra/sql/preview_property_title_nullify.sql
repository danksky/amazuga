-- Removes seeded property titles from property_asset and property_profile.
-- Titles are derived dynamically from parcel identifiers; storing them in
-- the DB was a leftover from earlier mock data conventions.

ALTER TABLE property_asset ALTER COLUMN title DROP NOT NULL;
ALTER TABLE property_profile ALTER COLUMN title DROP NOT NULL;

UPDATE property_asset
SET title = NULL
WHERE seed_source IN ('mock_import_listing_surface_v1', 'preview_kigali_seed_v1', 'preview_property_page_variants_v1', 'preview_multi_unit_examples_v1')
  AND title IS NOT NULL;

UPDATE property_profile
SET title = NULL
WHERE seed_source IN ('mock_import_listing_surface_v1', 'preview_kigali_seed_v1', 'preview_property_page_variants_v1', 'preview_multi_unit_examples_v1')
  AND title IS NOT NULL;

