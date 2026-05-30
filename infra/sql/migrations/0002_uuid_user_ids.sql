-- Migration: 0002_uuid_user_ids
--
-- Change app_user.id from TEXT to UUID so it matches Supabase's auth.users.id
-- directly — no separate supabase_auth_id join column needed.
--
-- All dependent FK columns updated from TEXT to UUID in the same transaction.
--
-- Existing app_user rows are deleted: their text IDs (user-1, user-<md5hash>)
-- are dev artifacts and not valid UUIDs. Any dependent rows are cascade-deleted.
-- This migration is safe to run on the preview DB (no production user data exists).

BEGIN;

-- Drop views that reference app_user columns — they must be recreated after
-- the column type change. Views cannot be altered in place for type changes.
DROP VIEW IF EXISTS active_listing_surface;
DROP VIEW IF EXISTS public_active_listing_map_surface;
DROP VIEW IF EXISTS property_asset_surface;
DROP VIEW IF EXISTS off_market_discoverability_surface;

-- Remove all existing app_user rows and their dependent rows.
-- These are dev/mock rows with non-UUID text IDs.
TRUNCATE TABLE app_user CASCADE;

-- Drop supabase_auth_id: the Supabase auth UUID is now app_user.id directly.
ALTER TABLE app_user DROP COLUMN IF EXISTS supabase_auth_id;

-- Drop all FK constraints that reference app_user.id before changing its type.
ALTER TABLE agency DROP CONSTRAINT IF EXISTS agency_pending_manager_user_id_fkey;
ALTER TABLE agency DROP CONSTRAINT IF EXISTS agency_manager_user_id_fkey;
ALTER TABLE agency_membership DROP CONSTRAINT IF EXISTS agency_membership_user_id_fkey;
ALTER TABLE property_asset_profile DROP CONSTRAINT IF EXISTS property_asset_profile_created_by_user_id_fkey;
ALTER TABLE listing DROP CONSTRAINT IF EXISTS listing_agent_user_id_fkey;
ALTER TABLE listing_image DROP CONSTRAINT IF EXISTS listing_image_uploaded_by_user_id_fkey;
ALTER TABLE listing_image_cleanup_job DROP CONSTRAINT IF EXISTS listing_image_cleanup_job_uploaded_by_user_id_fkey;
ALTER TABLE listing_price_history DROP CONSTRAINT IF EXISTS listing_price_history_changed_by_user_id_fkey;
ALTER TABLE listing_access_grant DROP CONSTRAINT IF EXISTS listing_access_grant_granted_to_user_id_fkey;
ALTER TABLE listing_access_grant DROP CONSTRAINT IF EXISTS listing_access_grant_granted_by_user_id_fkey;
ALTER TABLE saved_property DROP CONSTRAINT IF EXISTS saved_property_user_id_fkey;
ALTER TABLE agency_application DROP CONSTRAINT IF EXISTS agency_application_created_by_user_id_fkey;
ALTER TABLE agent_application DROP CONSTRAINT IF EXISTS agent_application_user_id_fkey;
ALTER TABLE valuator_application DROP CONSTRAINT IF EXISTS valuator_application_user_id_fkey;
ALTER TABLE property_claim_request DROP CONSTRAINT IF EXISTS property_claim_request_user_id_fkey;
ALTER TABLE property_claim_request DROP CONSTRAINT IF EXISTS property_claim_request_transfer_from_user_id_fkey;
ALTER TABLE property_claim_request DROP CONSTRAINT IF EXISTS property_claim_request_transfer_initiated_by_user_id_fkey;
ALTER TABLE property_ownership DROP CONSTRAINT IF EXISTS property_ownership_user_id_fkey;
ALTER TABLE valuation_submission DROP CONSTRAINT IF EXISTS valuation_submission_submitted_by_user_id_fkey;

-- Change app_user.id to UUID.
ALTER TABLE app_user ALTER COLUMN id TYPE UUID USING id::uuid;

-- Change all dependent FK columns from TEXT to UUID.
ALTER TABLE agency
  ALTER COLUMN pending_manager_user_id TYPE UUID USING pending_manager_user_id::uuid,
  ALTER COLUMN manager_user_id TYPE UUID USING manager_user_id::uuid;

ALTER TABLE agency_membership
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE property_asset_profile
  ALTER COLUMN created_by_user_id TYPE UUID USING created_by_user_id::uuid;

ALTER TABLE listing
  ALTER COLUMN agent_user_id TYPE UUID USING agent_user_id::uuid;

ALTER TABLE listing_image
  ALTER COLUMN uploaded_by_user_id TYPE UUID USING uploaded_by_user_id::uuid;

ALTER TABLE listing_image_cleanup_job
  ALTER COLUMN uploaded_by_user_id TYPE UUID USING uploaded_by_user_id::uuid;

ALTER TABLE listing_price_history
  ALTER COLUMN changed_by_user_id TYPE UUID USING changed_by_user_id::uuid;

ALTER TABLE listing_access_grant
  ALTER COLUMN granted_to_user_id TYPE UUID USING granted_to_user_id::uuid,
  ALTER COLUMN granted_by_user_id TYPE UUID USING granted_by_user_id::uuid;

ALTER TABLE saved_property
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE agency_application
  ALTER COLUMN created_by_user_id TYPE UUID USING created_by_user_id::uuid;

ALTER TABLE agent_application
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE valuator_application
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE property_claim_request
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid,
  ALTER COLUMN transfer_from_user_id TYPE UUID USING transfer_from_user_id::uuid,
  ALTER COLUMN transfer_initiated_by_user_id TYPE UUID USING transfer_initiated_by_user_id::uuid;

ALTER TABLE property_ownership
  ALTER COLUMN user_id TYPE UUID USING user_id::uuid;

ALTER TABLE valuation_submission
  ALTER COLUMN submitted_by_user_id TYPE UUID USING submitted_by_user_id::uuid;

-- Re-add all FK constraints.
ALTER TABLE agency
  ADD CONSTRAINT agency_pending_manager_user_id_fkey
    FOREIGN KEY (pending_manager_user_id) REFERENCES app_user(id),
  ADD CONSTRAINT agency_manager_user_id_fkey
    FOREIGN KEY (manager_user_id) REFERENCES app_user(id);

ALTER TABLE agency_membership
  ADD CONSTRAINT agency_membership_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE property_asset_profile
  ADD CONSTRAINT property_asset_profile_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id);

ALTER TABLE listing
  ADD CONSTRAINT listing_agent_user_id_fkey
    FOREIGN KEY (agent_user_id) REFERENCES app_user(id);

ALTER TABLE listing_image
  ADD CONSTRAINT listing_image_uploaded_by_user_id_fkey
    FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user(id);

ALTER TABLE listing_image_cleanup_job
  ADD CONSTRAINT listing_image_cleanup_job_uploaded_by_user_id_fkey
    FOREIGN KEY (uploaded_by_user_id) REFERENCES app_user(id);

ALTER TABLE listing_price_history
  ADD CONSTRAINT listing_price_history_changed_by_user_id_fkey
    FOREIGN KEY (changed_by_user_id) REFERENCES app_user(id);

ALTER TABLE listing_access_grant
  ADD CONSTRAINT listing_access_grant_granted_to_user_id_fkey
    FOREIGN KEY (granted_to_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
  ADD CONSTRAINT listing_access_grant_granted_by_user_id_fkey
    FOREIGN KEY (granted_by_user_id) REFERENCES app_user(id);

ALTER TABLE saved_property
  ADD CONSTRAINT saved_property_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE;

ALTER TABLE agency_application
  ADD CONSTRAINT agency_application_created_by_user_id_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id);

ALTER TABLE agent_application
  ADD CONSTRAINT agent_application_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id);

ALTER TABLE valuator_application
  ADD CONSTRAINT valuator_application_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id);

ALTER TABLE property_claim_request
  ADD CONSTRAINT property_claim_request_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id),
  ADD CONSTRAINT property_claim_request_transfer_from_user_id_fkey
    FOREIGN KEY (transfer_from_user_id) REFERENCES app_user(id),
  ADD CONSTRAINT property_claim_request_transfer_initiated_by_user_id_fkey
    FOREIGN KEY (transfer_initiated_by_user_id) REFERENCES app_user(id);

ALTER TABLE property_ownership
  ADD CONSTRAINT property_ownership_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES app_user(id);

ALTER TABLE valuation_submission
  ADD CONSTRAINT valuation_submission_submitted_by_user_id_fkey
    FOREIGN KEY (submitted_by_user_id) REFERENCES app_user(id);

-- Recreate views dropped at the top of this migration.
CREATE OR REPLACE VIEW property_asset_surface AS
SELECT
  pa.id                               AS property_asset_id,
  pa.parcel_id,
  pa.parent_asset_id,
  pa.public_id                        AS property_route_id,
  pa.display_code                     AS property_code,
  pa.asset_type                       AS property_kind,
  pa.unit_label                       AS property_unit_label,
  pa.description                      AS property_description_override,
  pa.is_primary_for_parcel,
  p.public_id                         AS parcel_public_id,
  p.display_id                        AS parcel_display_id,
  p.upi,
  p.district,
  p.sector,
  p.cell,
  p.village,
  p.centroid_lat,
  p.centroid_lon,
  p.bbox_min_lon,
  p.bbox_min_lat,
  p.bbox_max_lon,
  p.bbox_max_lat,
  p.representative_size,
  p.zoning,
  p.zone_code,
  p.gen_lu,
  pap.description                     AS profile_description,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house'               THEN 'House'
      WHEN 'land'                THEN 'Land'
      WHEN 'apartment_building'  THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit'      THEN 'Apartment unit'
      WHEN 'commercial_unit'     THEN 'Commercial unit'
      ELSE 'Property'
    END
  )                                   AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  pap.year_built,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
    ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
  END                                 AS property_title,
  COALESCE(pa.description, pap.description) AS resolved_description
FROM property_asset pa
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = pa.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id;

CREATE OR REPLACE VIEW active_listing_surface AS
SELECT
  l.id                                AS listing_id,
  pas.parcel_id,
  l.property_asset_id,
  pas.property_route_id               AS property_asset_public_id,
  pas.parcel_public_id                AS public_id,
  pas.upi,
  pas.district,
  pas.sector,
  pas.cell,
  pas.village,
  pas.centroid_lat,
  pas.centroid_lon,
  pas.representative_size             AS land_area_sqm,
  pas.property_title                  AS title,
  pas.resolved_description            AS property_description,
  pas.property_type,
  pas.bedrooms,
  pas.bathrooms,
  pas.interior_area_sqm,
  pas.year_built,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.description                       AS listing_description,
  l.published_at,
  a.id                                AS agency_id,
  a.slug                              AS agency_slug,
  a.business_name                     AS agency_name,
  a.whatsapp_phone,
  a.website_url,
  u.id                                AS agent_user_id,
  u.full_name                         AS agent_full_name,
  li.image_url                        AS primary_image_url
FROM listing l
JOIN property_asset_surface pas
  ON pas.property_asset_id = l.property_asset_id
JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

CREATE OR REPLACE VIEW public_active_listing_map_surface AS
SELECT
  l.id                                AS listing_id,
  p.parcel_id,
  p.public_id                         AS parcel_public_id,
  p.display_id                        AS parcel_display_id,
  pa.id                               AS asset_id,
  pa.public_id                        AS asset_public_id,
  pa.unit_label                       AS asset_unit_label,
  COALESCE(pa.public_id, p.public_id) AS route_id,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.published_at,
  parcel_anchor.anchor_lon,
  parcel_anchor.anchor_lat,
  p.district,
  p.sector,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house'               THEN 'House'
      WHEN 'land'                THEN 'Land'
      WHEN 'apartment_building'  THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit'      THEN 'Apartment Unit'
      WHEN 'commercial_unit'     THEN 'Commercial Unit'
      ELSE NULL
    END
  )                                   AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  (
    SELECT li.image_url
    FROM listing_image li
    WHERE li.listing_id = l.id
      AND li.status = 'ready'
    ORDER BY li.sort_order ASC
    LIMIT 1
  )                                   AS hero_image_url
FROM listing l
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
JOIN parcel_anchor_point_preview parcel_anchor
  ON parcel_anchor.parcel_id = p.parcel_id
LEFT JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id
WHERE l.status     = 'active'
  AND l.visibility = 'public';

CREATE OR REPLACE VIEW off_market_discoverability_surface AS
SELECT
  p.parcel_id,
  p.public_id     AS parcel_public_id,
  p.public_id     AS route_id,
  p.display_id,
  p.district,
  p.sector,
  parcel_anchor.anchor_lon,
  parcel_anchor.anchor_lat,
  parcel_anchor.anchor_source
FROM parcel_app_ready_seed_preview p
JOIN parcel_anchor_point_preview parcel_anchor
  ON parcel_anchor.parcel_id = p.parcel_id
WHERE p.parcel_id       IS NOT NULL
  AND p.public_id       IS NOT NULL
  AND parcel_anchor.anchor_lon IS NOT NULL
  AND parcel_anchor.anchor_lat IS NOT NULL;

COMMIT;
