-- Allow private listers to create listings without an agency.
-- agency_id is optional; NULL means a private (owner-direct) listing.

BEGIN;

ALTER TABLE listing ALTER COLUMN agency_id DROP NOT NULL;

-- Recreate active_listing_surface with LEFT JOIN on agency so private
-- listings (agency_id IS NULL) are included.
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

COMMIT;
