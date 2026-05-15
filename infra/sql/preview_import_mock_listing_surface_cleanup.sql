BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM saved_property
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM valuation_submission
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM property_claim_request
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM listing
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM property_asset
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM property_profile
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agency_membership
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agent_application
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM valuator_application
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agency_application
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM agency
WHERE seed_source = 'mock_import_listing_surface_v1';

DELETE FROM app_user
WHERE seed_source = 'mock_import_listing_surface_v1';

COMMIT;
