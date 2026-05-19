BEGIN;

INSERT INTO app_user (
  id,
  email,
  full_name,
  roles,
  status,
  seed_source
)
VALUES
  (
    'usr_preview_admin',
    'daniel.kawalsky@gmail.com',
    'Daniel Kawalsky',
    ARRAY['user', 'admin']::TEXT[],
    'active',
    'preview_kigali_seed_v1'
  ),
  (
    'usr_preview_manager',
    'manager.preview@amazuga.test',
    'Alice Mukamana',
    ARRAY['user', 'agent', 'agency_manager']::TEXT[],
    'active',
    'preview_kigali_seed_v1'
  ),
  (
    'usr_preview_agent',
    'agent.preview@amazuga.test',
    'Eric Habimana',
    ARRAY['user', 'agent']::TEXT[],
    'active',
    'preview_kigali_seed_v1'
  ),
  (
    'usr_preview_buyer',
    'buyer.preview@amazuga.test',
    'Aline Uwimana',
    ARRAY['user']::TEXT[],
    'active',
    'preview_kigali_seed_v1'
  )
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  roles = EXCLUDED.roles,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

INSERT INTO agency (
  id,
  slug,
  business_name,
  tin,
  whatsapp_phone,
  website_url,
  google_maps_url,
  status,
  pending_manager_user_id,
  manager_user_id,
  seed_source
)
VALUES (
  'agency_preview_kigali_homes_group',
  'kigali-homes-group',
  'Kigali Homes Group',
  '107839210',
  '+250788123456',
  'https://example.com',
  'https://maps.google.com/?q=Kigali+Homes+Group',
  'approved',
  'usr_preview_manager',
  'usr_preview_manager',
  'preview_kigali_seed_v1'
)
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  business_name = EXCLUDED.business_name,
  tin = EXCLUDED.tin,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  website_url = EXCLUDED.website_url,
  google_maps_url = EXCLUDED.google_maps_url,
  status = EXCLUDED.status,
  pending_manager_user_id = EXCLUDED.pending_manager_user_id,
  manager_user_id = EXCLUDED.manager_user_id,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

INSERT INTO agency_membership (
  id,
  agency_id,
  user_id,
  role,
  status,
  seed_source
)
VALUES
  (
    'agency_membership_preview_manager',
    'agency_preview_kigali_homes_group',
    'usr_preview_manager',
    'manager',
    'active',
    'preview_kigali_seed_v1'
  ),
  (
    'agency_membership_preview_agent',
    'agency_preview_kigali_homes_group',
    'usr_preview_agent',
    'agent',
    'active',
    'preview_kigali_seed_v1'
  )
ON CONFLICT (agency_id, user_id, role) DO UPDATE
SET
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source;

WITH listing_templates AS (
  SELECT *
  FROM (
    VALUES
      (1, 'sale', 'House', 4, 3.0::NUMERIC, 245::NUMERIC, 2019, 185000000::BIGINT, 'Preview hillside residence with a practical family layout and easy road access.', 'Modern Kigali home ready for a preview sale flow.', 'usr_preview_manager'),
      (2, 'rent', 'Apartment', 2, 2.0::NUMERIC, 92::NUMERIC, 2021, 950000::BIGINT, 'Preview rental apartment with a bright living area and easy access to services.', 'Simple preview rental listing for end-to-end browse and detail validation.', 'usr_preview_agent'),
      (3, 'sale', 'House', 3, 2.0::NUMERIC, 198::NUMERIC, 2017, 132000000::BIGINT, 'Preview house with enclosed outdoor space and balanced day-to-day circulation.', 'Preview family listing with placeholder imagery and parcel-backed identity.', 'usr_preview_manager'),
      (4, 'sale', 'House', 5, 4.0::NUMERIC, 372::NUMERIC, 2020, 248000000::BIGINT, 'Preview larger home arranged for flexible household use and strong frontage.', 'Higher-end preview listing for testing a more premium sale card.', 'usr_preview_manager'),
      (5, 'sale', 'House', 3, 2.0::NUMERIC, 154::NUMERIC, 2016, 99000000::BIGINT, 'Preview detached home with efficient planning and a manageable parcel footprint.', 'Mid-market preview sale listing for browse density and route validation.', 'usr_preview_agent'),
      (6, 'sale', 'House', 4, 3.0::NUMERIC, 232::NUMERIC, 2018, 158000000::BIGINT, 'Preview home with stronger street presence and flexible everyday use.', 'Additional sale inventory to exercise map, card, and property states.', 'usr_preview_agent'),
      (7, 'rent', 'Apartment', 2, 2.0::NUMERIC, 94::NUMERIC, 2022, 1200000::BIGINT, 'Preview apartment with a practical kitchen, balcony edge, and good light.', 'Second rental listing for preview variety without external media sourcing.', 'usr_preview_agent'),
      (8, 'rent', 'Apartment', 3, 2.0::NUMERIC, 118::NUMERIC, 2020, 1500000::BIGINT, 'Preview rental layout with space for a guest room, office, or shared use.', 'Third rental listing to validate rent-specific browse behavior.', 'usr_preview_agent')
  ) AS t(
    seq,
    marketing_type,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built,
    asking_price_rwf,
    property_description,
    listing_description,
    agent_user_id
  )
),
eligible_parcels AS (
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        district,
        sector,
        public_id
    ) AS seq,
    parcel_id,
    public_id,
    district,
    sector,
    cell,
    village
  FROM parcel_app_ready_seed_preview p
  WHERE p.inventory_status = 'approved'
    AND p.district IN ('Gasabo', 'Kicukiro', 'Nyarugenge')
    AND p.parcel_id IS NOT NULL
    AND p.public_id IS NOT NULL
    AND p.centroid_lat IS NOT NULL
    AND p.centroid_lon IS NOT NULL
    AND COALESCE(p.sector, '') <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM listing l
      WHERE l.parcel_id = p.parcel_id
        AND l.status = 'active'
        AND l.seed_source <> 'preview_kigali_seed_v1'
    )
),
selected_seed_rows AS (
  SELECT
    ep.parcel_id,
    ep.public_id,
    ep.district,
    ep.sector,
    ep.cell,
    ep.village,
    lt.seq,
    lt.marketing_type,
    lt.property_type,
    lt.bedrooms,
    lt.bathrooms,
    lt.interior_area_sqm,
    lt.year_built,
    lt.asking_price_rwf,
    lt.property_description,
    lt.listing_description,
    lt.agent_user_id,
    'lst_' || SUBSTR(MD5('preview_kigali_seed_v1:' || ep.public_id), 1, 20) AS listing_id
  FROM eligible_parcels ep
  JOIN listing_templates lt
    ON lt.seq = ep.seq
),
delete_stale_seed_listings AS (
  DELETE FROM listing l
  WHERE l.seed_source = 'preview_kigali_seed_v1'
    AND l.id NOT IN (
      SELECT listing_id
      FROM selected_seed_rows
    )
  RETURNING l.id
),
delete_stale_seed_profiles AS (
  DELETE FROM property_profile pp
  WHERE pp.seed_source = 'preview_kigali_seed_v1'
    AND pp.parcel_id NOT IN (
      SELECT parcel_id
      FROM selected_seed_rows
    )
  RETURNING pp.parcel_id
),
delete_stale_seed_assets AS (
  DELETE FROM property_asset pa
  WHERE pa.seed_source = 'preview_kigali_seed_v1'
    AND pa.parcel_id NOT IN (
      SELECT parcel_id
      FROM selected_seed_rows
    )
  RETURNING pa.id
),
upsert_assets AS (
  INSERT INTO property_asset (
    id,
    parcel_id,
    asset_type,
    public_id,
    display_code,
    description,
    is_primary_for_parcel,
    seed_source
  )
  SELECT
    'ast_' || SUBSTR(MD5('parcel-primary:' || ssr.parcel_id), 1, 20),
    ssr.parcel_id,
    CASE
      WHEN LOWER(ssr.property_type) = 'house' THEN 'house'
      WHEN LOWER(ssr.property_type) IN ('parcel', 'land', 'lot') THEN 'land'
      WHEN LOWER(ssr.property_type) IN ('apartment', 'flat', 'unit') THEN 'apartment_unit'
      WHEN LOWER(ssr.property_type) LIKE 'commercial%' THEN 'commercial_unit'
      WHEN LOWER(ssr.property_type) LIKE 'building%' THEN 'building'
      WHEN LOWER(ssr.property_type) = 'mixed use' THEN 'mixed_use'
      ELSE 'other'
    END,
    UPPER(SUBSTR(MD5('public:' || ssr.parcel_id), 1, 10)),
    'AST-' || UPPER(SUBSTR(MD5('display:' || ssr.parcel_id), 1, 10)),
    ssr.property_description,
    TRUE,
    'preview_kigali_seed_v1'
  FROM selected_seed_rows ssr
  ON CONFLICT (id) DO UPDATE
  SET
    asset_type = EXCLUDED.asset_type,
    public_id = EXCLUDED.public_id,
    description = EXCLUDED.description,
    is_primary_for_parcel = EXCLUDED.is_primary_for_parcel,
    seed_source = EXCLUDED.seed_source,
    updated_at = NOW()
  RETURNING id
),
upsert_profiles AS (
  INSERT INTO property_profile (
    parcel_id,
    created_by_user_id,
    description,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built,
    seed_source
  )
  SELECT
    ssr.parcel_id,
    ssr.agent_user_id,
    ssr.property_description,
    ssr.property_type,
    ssr.bedrooms,
    ssr.bathrooms,
    ssr.interior_area_sqm,
    ssr.year_built,
    'preview_kigali_seed_v1'
  FROM selected_seed_rows ssr
  ON CONFLICT (parcel_id) DO UPDATE
  SET
    created_by_user_id = EXCLUDED.created_by_user_id,
    description = EXCLUDED.description,
    property_type = EXCLUDED.property_type,
    bedrooms = EXCLUDED.bedrooms,
    bathrooms = EXCLUDED.bathrooms,
    interior_area_sqm = EXCLUDED.interior_area_sqm,
    year_built = EXCLUDED.year_built,
    seed_source = EXCLUDED.seed_source,
    updated_at = NOW()
  RETURNING parcel_id
),
upsert_listings AS (
  INSERT INTO listing (
    id,
    parcel_id,
    property_asset_id,
    agency_id,
    agent_user_id,
    status,
    marketing_type,
    asking_price_rwf,
    currency,
    description,
    seed_source,
    published_at
  )
  SELECT
    ssr.listing_id,
    ssr.parcel_id,
    'ast_' || SUBSTR(MD5('parcel-primary:' || ssr.parcel_id), 1, 20),
    'agency_preview_kigali_homes_group',
    ssr.agent_user_id,
    'active',
    ssr.marketing_type,
    ssr.asking_price_rwf,
    'RWF',
    ssr.listing_description,
    'preview_kigali_seed_v1',
    NOW()
  FROM selected_seed_rows ssr
  ON CONFLICT (id) DO UPDATE
  SET
    parcel_id = EXCLUDED.parcel_id,
    property_asset_id = EXCLUDED.property_asset_id,
    agency_id = EXCLUDED.agency_id,
    agent_user_id = EXCLUDED.agent_user_id,
    status = EXCLUDED.status,
    marketing_type = EXCLUDED.marketing_type,
    asking_price_rwf = EXCLUDED.asking_price_rwf,
    currency = EXCLUDED.currency,
    description = EXCLUDED.description,
    seed_source = EXCLUDED.seed_source,
    published_at = EXCLUDED.published_at,
    updated_at = NOW()
  RETURNING id
)
INSERT INTO listing_image (
  id,
  listing_id,
  sort_order,
  image_url,
  alt_text,
  seed_source
)
SELECT
  'img_' || SUBSTR(MD5(ssr.listing_id || ':' || image_rows.sort_order::TEXT), 1, 20) AS id,
  ssr.listing_id,
  image_rows.sort_order,
  image_rows.image_url,
  CONCAT(ssr.sector, ' preview image ', image_rows.sort_order + 1),
  'preview_kigali_seed_v1'
FROM selected_seed_rows ssr
JOIN LATERAL (
  VALUES
    (0, CONCAT('https://picsum.photos/seed/', ssr.public_id, '-1/1600/1000')),
    (1, CONCAT('https://picsum.photos/seed/', ssr.public_id, '-2/1600/1000'))
) AS image_rows(sort_order, image_url)
  ON TRUE
ON CONFLICT (listing_id, sort_order) DO UPDATE
SET
  image_url = EXCLUDED.image_url,
  alt_text = EXCLUDED.alt_text,
  seed_source = EXCLUDED.seed_source;

COMMIT;
