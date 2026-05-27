DROP VIEW IF EXISTS preview_active_listing_surface_v1;

ALTER TABLE listing DROP COLUMN IF EXISTS headline;

CREATE VIEW preview_active_listing_surface_v1 AS
SELECT
  l.id AS listing_id,
  l.parcel_id,
  l.property_asset_id,
  pa.public_id AS property_asset_public_id,
  p.public_id,
  p.upi,
  p.district,
  p.sector,
  p.cell,
  p.village,
  p.centroid_lat,
  p.centroid_lon,
  p.representative_size AS land_area_sqm,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
    ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
  END AS title,
  COALESCE(pa.description, pp.description) AS property_description,
  COALESCE(
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Parcel'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment'
      WHEN 'commercial_unit' THEN 'Commercial'
      ELSE 'Property'
    END,
    pp.property_type
  ) AS property_type,
  pp.bedrooms,
  pp.bathrooms,
  pp.interior_area_sqm,
  pp.year_built,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.description AS listing_description,
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
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
LEFT JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN property_profile pp
  ON pp.parcel_id = l.parcel_id
LEFT JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

COMMENT ON VIEW preview_active_listing_surface_v1 IS
'Preview join surface for future browse and property queries once mock data is removed.';
