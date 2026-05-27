-- Browse validation seed cohort: preview_browse_validation_v1
--
-- Purpose: provide 50-75 active public listings spread across Kigali districts
-- to validate map clustering, rail rendering, off-market dot suppression, and
-- mixed property types. Relies on users/agency seeded by preview_kigali_seed_v1.
--
-- Paired cleanup: preview_browse_validation_seed_cleanup.sql

BEGIN;

WITH listing_templates AS (
  SELECT *
  FROM (
    VALUES
      -- seq, marketing_type, property_type, bedrooms, bathrooms, sqm, year_built, price_rwf, prop_desc, listing_desc, agent_id
      ( 1, 'sale', 'House',             4, 3.0::NUMERIC, 268::NUMERIC, 2020, 195000000::BIGINT, 'Spacious Kigali hillside home with open living areas and terraced garden.',          'Browse validation: premium family home for sale.',                 'usr_preview_manager'),
      ( 2, 'sale', 'House',             3, 2.0::NUMERIC, 185::NUMERIC, 2018, 128000000::BIGINT, 'Three-bedroom residence with a practical layout and reliable road access.',         'Browse validation: mid-market sale listing.',                      'usr_preview_agent'),
      ( 3, 'sale', 'House',             5, 4.0::NUMERIC, 390::NUMERIC, 2021, 285000000::BIGINT, 'Large executive home with dedicated office space and staff quarters.',              'Browse validation: high-end listing for premium browse segment.',   'usr_preview_manager'),
      ( 4, 'sale', 'House',             2, 1.0::NUMERIC, 112::NUMERIC, 2016, 82000000::BIGINT,  'Compact well-maintained residence ideal for a small family or professional pair.',  'Browse validation: affordable entry-level sale card.',              'usr_preview_agent'),
      ( 5, 'sale', 'House',             4, 3.0::NUMERIC, 240::NUMERIC, 2019, 162000000::BIGINT, 'Comfortable family home with strong natural light and easy community access.',      'Browse validation: mid-high sale listing for cluster density.',     'usr_preview_manager'),
      ( 6, 'sale', 'House',             6, 4.0::NUMERIC, 445::NUMERIC, 2022, 360000000::BIGINT, 'Luxury compound with landscaped grounds and a private driveway.',                  'Browse validation: top-tier listing to test price pill rendering.', 'usr_preview_manager'),
      ( 7, 'sale', 'Land',              0, 0.0::NUMERIC,   0::NUMERIC, NULL,  48000000::BIGINT, 'Flat approved parcel with serviced access and clear title documentation.',         'Browse validation: land-only listing for type diversity.',         'usr_preview_agent'),
      ( 8, 'sale', 'House',             3, 2.0::NUMERIC, 160::NUMERIC, 2017, 105000000::BIGINT, 'Solid construction home with covered parking and a manageable garden.',            'Browse validation: standard three-bed sale card.',                 'usr_preview_agent'),
      ( 9, 'sale', 'Commercial building', 0, 0.0::NUMERIC, 320::NUMERIC, 2018, 210000000::BIGINT, 'Ground-floor commercial building with high street visibility and ample parking.', 'Browse validation: commercial sale to test property type diversity.', 'usr_preview_manager'),
      (10, 'sale', 'House',             3, 2.0::NUMERIC, 175::NUMERIC, 2015,  96000000::BIGINT, 'Established neighbourhood home with a mature garden and good public transit nearby.','Browse validation: affordable established home for geographic spread.','usr_preview_agent'),
      (11, 'rent', 'House',             3, 2.0::NUMERIC, 195::NUMERIC, 2019,   2500000::BIGINT, 'Airy family home with a covered terrace and parking for two vehicles.',             'Browse validation: standard house rental listing.',                'usr_preview_manager'),
      (12, 'rent', 'House',             4, 3.0::NUMERIC, 255::NUMERIC, 2020,   3800000::BIGINT, 'Well-maintained four-bedroom home close to schools and major roads.',               'Browse validation: larger house rental for rent browse testing.',  'usr_preview_agent'),
      (13, 'rent', 'House',             2, 1.0::NUMERIC, 120::NUMERIC, 2017,   1400000::BIGINT, 'Affordable two-bedroom rental with good access to public transportation.',          'Browse validation: low-end rent card for price diversity.',        'usr_preview_agent'),
      (14, 'rent', 'House',             5, 3.0::NUMERIC, 310::NUMERIC, 2021,   5200000::BIGINT, 'Executive rental with a private garden, generator, and water storage.',             'Browse validation: premium rent listing for cluster differentiation.','usr_preview_manager'),
      (15, 'rent', 'House',             3, 2.0::NUMERIC, 172::NUMERIC, 2018,   2100000::BIGINT, 'Clean and well-managed family home in a quiet residential area.',                  'Browse validation: mid-market rent listing for rail density.',     'usr_preview_agent')
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
      ORDER BY district, sector, public_id
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
        AND l.seed_source <> 'preview_browse_validation_v1'
    )
  LIMIT 75
),
selected_seed_rows AS (
  SELECT
    ep.parcel_id,
    ep.public_id,
    ep.district,
    ep.sector,
    ep.cell,
    ep.village,
    lt.seq                                                              AS template_seq,
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
    'lst_' || SUBSTR(MD5('preview_browse_validation_v1:' || ep.public_id), 1, 20) AS listing_id
  FROM eligible_parcels ep
  JOIN listing_templates lt
    ON lt.seq = ((ep.seq - 1) % 15) + 1
),
resolved_seed_rows AS (
  SELECT
    ssr.*,
    CASE LOWER(ssr.property_type)
      WHEN 'house'                THEN 'house'
      WHEN 'land'                 THEN 'land'
      WHEN 'commercial building'  THEN 'commercial_building'
      ELSE 'house'
    END                                                                AS asset_type,
    'ast_' || SUBSTR(MD5('bv-primary:' || ssr.parcel_id), 1, 20)      AS asset_id,
    UPPER(SUBSTR(MD5('bv-pub:' || ssr.parcel_id), 1, 10))             AS asset_public_id,
    'AST-' || UPPER(SUBSTR(MD5('bv-disp:' || ssr.parcel_id), 1, 10)) AS asset_display_code
  FROM selected_seed_rows ssr
),
delete_stale_listings AS (
  DELETE FROM listing l
  WHERE l.seed_source = 'preview_browse_validation_v1'
    AND l.id NOT IN (SELECT listing_id FROM resolved_seed_rows)
  RETURNING l.id
),
delete_stale_profiles AS (
  DELETE FROM property_profile pp
  WHERE pp.seed_source = 'preview_browse_validation_v1'
    AND pp.parcel_id NOT IN (SELECT parcel_id FROM selected_seed_rows)
  RETURNING pp.parcel_id
),
delete_stale_assets AS (
  DELETE FROM property_asset pa
  WHERE pa.seed_source = 'preview_browse_validation_v1'
    AND pa.parcel_id NOT IN (SELECT parcel_id FROM selected_seed_rows)
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
    rsr.asset_id,
    rsr.parcel_id,
    rsr.asset_type,
    rsr.asset_public_id,
    rsr.asset_display_code,
    rsr.property_description,
    TRUE,
    'preview_browse_validation_v1'
  FROM resolved_seed_rows rsr
  ON CONFLICT (id) DO UPDATE
  SET
    asset_type            = EXCLUDED.asset_type,
    public_id             = EXCLUDED.public_id,
    description           = EXCLUDED.description,
    is_primary_for_parcel = EXCLUDED.is_primary_for_parcel,
    seed_source           = EXCLUDED.seed_source,
    updated_at            = NOW()
  RETURNING id
),
upsert_profiles AS (
  INSERT INTO property_asset_profile (
    property_asset_id,
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
    rsr.asset_id,
    rsr.agent_user_id,
    rsr.property_description,
    rsr.property_type,
    NULLIF(rsr.bedrooms, 0),
    NULLIF(rsr.bathrooms, 0.0),
    NULLIF(rsr.interior_area_sqm, 0),
    rsr.year_built,
    'preview_browse_validation_v1'
  FROM resolved_seed_rows rsr
  ON CONFLICT (property_asset_id) DO UPDATE
  SET
    created_by_user_id = EXCLUDED.created_by_user_id,
    description        = EXCLUDED.description,
    property_type      = EXCLUDED.property_type,
    bedrooms           = EXCLUDED.bedrooms,
    bathrooms          = EXCLUDED.bathrooms,
    interior_area_sqm  = EXCLUDED.interior_area_sqm,
    year_built         = EXCLUDED.year_built,
    seed_source        = EXCLUDED.seed_source,
    updated_at         = NOW()
  RETURNING property_asset_id
),
upsert_listings AS (
  INSERT INTO listing (
    id,
    parcel_id,
    property_asset_id,
    agency_id,
    agent_user_id,
    status,
    visibility,
    marketing_type,
    asking_price_rwf,
    currency,
    description,
    seed_source,
    published_at
  )
  SELECT
    rsr.listing_id,
    rsr.parcel_id,
    rsr.asset_id,
    'agency_preview_kigali_homes_group',
    rsr.agent_user_id,
    'active',
    'public',
    rsr.marketing_type,
    rsr.asking_price_rwf,
    'RWF',
    rsr.listing_description,
    'preview_browse_validation_v1',
    NOW()
  FROM resolved_seed_rows rsr
  ON CONFLICT (id) DO UPDATE
  SET
    parcel_id         = EXCLUDED.parcel_id,
    property_asset_id = EXCLUDED.property_asset_id,
    agency_id         = EXCLUDED.agency_id,
    agent_user_id     = EXCLUDED.agent_user_id,
    status            = EXCLUDED.status,
    visibility        = EXCLUDED.visibility,
    marketing_type    = EXCLUDED.marketing_type,
    asking_price_rwf  = EXCLUDED.asking_price_rwf,
    currency          = EXCLUDED.currency,
    description       = EXCLUDED.description,
    seed_source       = EXCLUDED.seed_source,
    published_at      = EXCLUDED.published_at,
    updated_at        = NOW()
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
  'img_' || SUBSTR(MD5(rsr.listing_id || ':' || img.sort_order::TEXT), 1, 20),
  rsr.listing_id,
  img.sort_order,
  img.image_url,
  CONCAT(rsr.sector, ' browse validation image ', img.sort_order + 1),
  'preview_browse_validation_v1'
FROM resolved_seed_rows rsr
JOIN LATERAL (
  VALUES
    (0, CONCAT('https://picsum.photos/seed/bv-', rsr.public_id, '-1/1600/1000')),
    (1, CONCAT('https://picsum.photos/seed/bv-', rsr.public_id, '-2/1600/1000'))
) AS img(sort_order, image_url)
  ON TRUE
ON CONFLICT (listing_id, sort_order) DO UPDATE
SET
  image_url   = EXCLUDED.image_url,
  alt_text    = EXCLUDED.alt_text,
  seed_source = EXCLUDED.seed_source;

COMMIT;
