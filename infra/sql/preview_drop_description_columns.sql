DROP VIEW IF EXISTS preview_active_listing_surface_v1;
DROP VIEW IF EXISTS preview_property_asset_surface_v1;

ALTER TABLE listing DROP COLUMN IF EXISTS description;
ALTER TABLE property_asset DROP COLUMN IF EXISTS description;
ALTER TABLE property_asset_profile DROP COLUMN IF EXISTS description;
ALTER TABLE property_profile DROP COLUMN IF EXISTS description;
ALTER TABLE property_claim_request DROP COLUMN IF EXISTS description;

CREATE VIEW preview_property_asset_surface_v1 AS
SELECT
  pa.id AS property_asset_id,
  pa.parcel_id,
  pa.parent_asset_id,
  pa.public_id AS property_route_id,
  pa.display_code AS property_code,
  pa.asset_type AS property_kind,
  pa.unit_label AS property_unit_label,
  pa.is_primary_for_parcel,
  p.public_id AS parcel_public_id,
  p.display_id AS parcel_display_id,
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
  COALESCE(NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Land'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment unit'
      WHEN 'commercial_unit' THEN 'Commercial unit'
      ELSE 'Property'
    END
  ) AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  pap.year_built,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
    ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
  END AS property_title
FROM property_asset pa
JOIN parcel_app_ready_seed_preview p ON p.parcel_id = pa.parcel_id
LEFT JOIN property_asset_profile pap ON pap.property_asset_id = pa.id;

CREATE VIEW preview_active_listing_surface_v1 AS
SELECT
  l.id AS listing_id,
  pas.parcel_id,
  l.property_asset_id,
  pas.property_route_id AS property_asset_public_id,
  pas.parcel_public_id AS public_id,
  pas.upi,
  pas.district,
  pas.sector,
  pas.cell,
  pas.village,
  pas.centroid_lat,
  pas.centroid_lon,
  pas.representative_size AS land_area_sqm,
  pas.property_title AS title,
  pas.property_type,
  pas.bedrooms,
  pas.bathrooms,
  pas.interior_area_sqm,
  pas.year_built,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.published_at,
  a.id AS agency_id,
  a.slug AS agency_slug,
  a.business_name AS agency_name,
  a.whatsapp_phone,
  a.website_url,
  u.id AS agent_user_id,
  u.full_name AS agent_full_name,
  li.image_url AS primary_image_url
FROM listing l
JOIN preview_property_asset_surface_v1 pas ON pas.property_asset_id = l.property_asset_id
JOIN agency a ON a.id = l.agency_id
JOIN app_user u ON u.id = l.agent_user_id
LEFT JOIN listing_image li ON li.listing_id = l.id AND li.sort_order = 0
WHERE l.status = 'active';
