-- 0012_location_hidden_and_ownership_contest.sql
--
-- Summary of changes
-- ──────────────────
--   1. Add location_hidden column to listing
--   2. Create property_ownership_contest table for dispute tracking
--   3. Recreate active_listing_surface view to expose location_hidden
--   4. Recreate public_active_listing_map_surface to exclude hidden-location pins
--
-- Background
-- ──────────
-- Owners of UPI-backed (parcel-sourced) listings can now opt to suppress the
-- precise parcel location from public surfaces. When location_hidden = true:
--   - The property listing page shows text-only address (no map), the same
--     treatment already applied to direct (no-UPI) listings.
--   - The browse map shows no pin for the listing; the underlying parcel dot is
--     suppressed via the existing suppressionKeys mechanism. The listing still
--     appears in the browse panel / search results.
--
-- The property_ownership_contest table supports the new dispute flow: when a
-- second user tries to claim a UPI that is already owned, they can submit a
-- free-text contest. Admins review contests only (initial claims are now
-- auto-approved synchronously when the UPI is found in our parcel DB).


-- ── 1. Add location_hidden to listing ─────────────────────────────────────

ALTER TABLE listing
  ADD COLUMN IF NOT EXISTS location_hidden BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN listing.location_hidden IS
'When true, the precise parcel location is suppressed from all public surfaces.
Only meaningful for UPI-backed (parcel-sourced) listings; direct listings are
always village-level and never show precise coordinates regardless of this flag.
Listing still appears in browse panel / search results when hidden.';


-- ── 2. Create property_ownership_contest ─────────────────────────────────

CREATE TABLE IF NOT EXISTS property_ownership_contest (
  id                         TEXT PRIMARY KEY,
  upi                        TEXT NOT NULL,
  contesting_user_id         UUID NOT NULL REFERENCES app_user(id),
  claimed_property_asset_id  TEXT NOT NULL REFERENCES property_asset(id),
  claimed_property_id        TEXT NOT NULL,
  note                       TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved_upheld', 'resolved_overturned')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_ownership_contest IS
'Dispute submissions from a second claimant who believes they own an already-claimed
UPI. Created via two entry points: (a) during the UPI claim flow when the UPI is
already owned, or (b) via the "Dispute ownership" link on the property listing page.
Reviewed by admins. resolved_upheld = original owner keeps the property;
resolved_overturned = a separate transfer workflow is needed to reassign ownership.';

CREATE INDEX IF NOT EXISTS property_ownership_contest_status_idx
  ON property_ownership_contest (status);

CREATE INDEX IF NOT EXISTS property_ownership_contest_contesting_user_id_idx
  ON property_ownership_contest (contesting_user_id);

CREATE INDEX IF NOT EXISTS property_ownership_contest_upi_idx
  ON property_ownership_contest (upi);


-- ── 3. Recreate active_listing_surface with location_hidden ───────────────
-- Property pages and portal surfaces read this view; they need location_hidden
-- to decide whether to render a parcel map or fall back to text-only address.

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
  li.image_url                        AS primary_image_url,
  l.location_hidden
FROM listing l
JOIN property_asset_surface pas
  ON pas.property_asset_id = l.property_asset_id
LEFT JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';


-- ── 4. Recreate public_active_listing_map_surface with location_hidden filter
-- Hidden-location listings must not appear as map pins. They still appear in
-- browse panel results (the browse-map.ts card query does not use this view).

CREATE OR REPLACE VIEW public_active_listing_map_surface AS
SELECT
  l.id                                AS listing_id,
  pa.parcel_id,
  p.public_id                         AS parcel_public_id,
  pa.id                               AS asset_id,
  pa.public_id                        AS asset_public_id,
  pa.unit_label                       AS asset_unit_label,
  pa.public_id                        AS route_id,
  pa.location_source,
  pa.display_name,
  pa.anchor_lon,
  pa.anchor_lat,
  pa.admin_district                   AS district,
  pa.admin_sector                     AS sector,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.published_at,
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
JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id
WHERE l.status          = 'active'
  AND l.visibility      = 'public'
  AND l.location_hidden = false
  AND pa.anchor_lon IS NOT NULL
  AND pa.anchor_lat IS NOT NULL;
