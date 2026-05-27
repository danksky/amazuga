-- Read surface for active public listing pins and cards on the browse map.
-- One row per active public listing. Joins anchor points for in-parcel placement.
-- No UPI exposed. Hero image only (no full image arrays).
-- Used by: src/lib/server/browse-map.ts (bbox-filtered at query time).

CREATE OR REPLACE VIEW preview_public_active_listing_map_surface_v1 AS
SELECT
  l.id                                        AS listing_id,
  p.parcel_id,
  p.public_id                                 AS parcel_public_id,
  p.display_id                                AS parcel_display_id,
  pa.id                                       AS asset_id,
  pa.public_id                                AS asset_public_id,
  to_jsonb(pa)->>'unit_label'                 AS asset_unit_label,
  COALESCE(pa.public_id, p.public_id)         AS route_id,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.published_at,
  l.created_at                                AS listing_created_at,
  parcel_anchor.anchor_lon,
  parcel_anchor.anchor_lat,
  parcel_anchor.anchor_source,
  p.district,
  p.sector,
  COALESCE(
    NULLIF(BTRIM(property_profile.property_type), ''),
    CASE pa.asset_type
      WHEN 'house'               THEN 'House'
      WHEN 'land'                THEN 'Land'
      WHEN 'apartment_building'  THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit'      THEN 'Apartment Unit'
      WHEN 'commercial_unit'     THEN 'Commercial Unit'
      ELSE NULL
    END
  )                                           AS property_type,
  property_profile.bedrooms,
  property_profile.bathrooms,
  property_profile.interior_area_sqm,
  (
    SELECT li.image_url
    FROM listing_image li
    WHERE li.listing_id = l.id
      AND COALESCE(to_jsonb(li)->>'status', 'ready') = 'ready'
    ORDER BY li.sort_order ASC
    LIMIT 1
  )                                           AS hero_image_url
FROM listing l
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
JOIN parcel_anchor_point_preview parcel_anchor
  ON parcel_anchor.parcel_id = p.parcel_id
LEFT JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN property_asset_profile property_profile
  ON property_profile.property_asset_id = pa.id
WHERE l.status     = 'active'
  AND l.visibility = 'public';
