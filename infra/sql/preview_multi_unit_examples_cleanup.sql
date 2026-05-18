BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM listing
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM property_asset
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM property_profile
WHERE seed_source = 'preview_multi_unit_examples_v1';

COMMIT;
