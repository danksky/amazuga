-- 0011_drop_parcel_display_id.sql
--
-- Removes the stored display_id column from the parcel table and introduces
-- the parcel_label() SQL function in its place.
--
-- Background
-- ──────────
-- display_id was a denormalized string computed in the scrape-rwanda-parcels
-- pipeline ("District · Village · ParcelNumber") and stored in every parcel
-- row.  It was used as the human-readable label wherever a parcel needed a
-- name in the UI and in portal queries.
--
-- The column had two problems:
--   1. Format changes required re-running an UPDATE across 10M+ rows.
--   2. The format used village names, which agents report clients don't
--      recognise — buyers navigate by sector and cell (June 2026, Amie Nicolas).
--
-- The replacement is a SQL function that derives the label from columns already
-- present on every parcel row: upi (parcel number is the 5th UPI segment),
-- cell, and sector.  Changing the format in future is a one-line edit to the
-- function with no data migration required.
--
-- Migration 0010 reformatted the stored display_id as a stopgap while this
-- full removal was being designed.  0011 supersedes it.
--
-- Summary of changes
-- ──────────────────
--   1. Create parcel_label(upi, cell, sector) function
--   2. Drop display_id from parcel_app_ready_seed_preview CASCADE
--      (drops dependent views: property_asset_surface, active_listing_surface,
--       public_active_listing_map_surface, off_market_discoverability_surface)
--   3. Drop display_id from parcel_anchor_point_preview
--   4. Recreate the four views with parcel_label() in place of display_id


-- ── 1. parcel_label function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION parcel_label(upi TEXT, cell TEXT, sector TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN upi IS NOT NULL AND cell IS NOT NULL AND sector IS NOT NULL
    THEN split_part(upi, '/', 5) || ' ' || cell || ', ' || sector
    ELSE NULL
  END
$$;


-- ── 2. Drop display_id from parcel_app_ready_seed_preview ─────────────────
-- CASCADE drops the four dependent views; they are recreated below.

ALTER TABLE parcel_app_ready_seed_preview
  DROP COLUMN IF EXISTS display_id CASCADE;


-- ── 3. Drop display_id from parcel_anchor_point_preview ───────────────────

ALTER TABLE parcel_anchor_point_preview
  DROP COLUMN IF EXISTS display_id;


-- ── 4. Recreate dependent views ────────────────────────────────────────────

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
  pa.location_source,
  pa.display_name,
  pa.admin_district,
  pa.admin_sector,
  pa.admin_cell,
  pa.admin_village,
  pa.anchor_lat,
  pa.anchor_lon,
  -- parcel-specific fields — NULL for direct listings
  p.public_id                         AS parcel_public_id,
  parcel_label(p.upi, p.cell, p.sector) AS parcel_display_id,
  p.upi,
  COALESCE(pa.admin_district, p.district)   AS district,
  COALESCE(pa.admin_sector,   p.sector)     AS sector,
  COALESCE(pa.admin_cell,     p.cell)       AS cell,
  COALESCE(pa.admin_village,  p.village)    AS village,
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
      THEN CONCAT(COALESCE(pa.display_name, pa.public_id), ' · ', pa.unit_label)
    ELSE COALESCE(pa.display_name, pa.public_id)
  END                                 AS property_title,
  COALESCE(pa.description, pap.description) AS resolved_description
FROM property_asset pa
LEFT JOIN parcel_app_ready_seed_preview p
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
LEFT JOIN agency a
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
WHERE l.status     = 'active'
  AND l.visibility = 'public'
  AND pa.anchor_lon IS NOT NULL
  AND pa.anchor_lat IS NOT NULL;

CREATE OR REPLACE VIEW off_market_discoverability_surface AS
SELECT
  p.parcel_id,
  p.public_id     AS parcel_public_id,
  p.public_id     AS route_id,
  parcel_label(p.upi, p.cell, p.sector) AS display_id,
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
