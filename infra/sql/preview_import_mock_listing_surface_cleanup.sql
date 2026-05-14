BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM listing
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM property_asset
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM property_profile
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agency_membership
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agency
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM app_user
WHERE seed_source = 'mock_import_listing_surface_v1';

COMMIT;
