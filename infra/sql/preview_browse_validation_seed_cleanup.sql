-- Remove all records seeded by preview_browse_validation_v1.
-- Run this before re-seeding or when wiping the cohort entirely.
-- Safe to run multiple times (idempotent).

BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'preview_browse_validation_v1';

DELETE FROM listing
WHERE seed_source = 'preview_browse_validation_v1';

DELETE FROM property_asset_profile
WHERE seed_source = 'preview_browse_validation_v1';

DELETE FROM property_asset
WHERE seed_source = 'preview_browse_validation_v1';

COMMIT;
