BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'preview_property_page_variants_v1';

DELETE FROM listing
WHERE seed_source = 'preview_property_page_variants_v1';

DELETE FROM property_asset
WHERE seed_source = 'preview_property_page_variants_v1';

DELETE FROM property_profile
WHERE seed_source = 'preview_property_page_variants_v1';

WITH base_eligible_parcels AS (
  SELECT
    p.parcel_id,
    p.public_id,
    p.upi,
    p.district,
    p.sector,
    p.cell,
    p.village,
    p.zone_code,
    p.zoning,
    p.gen_lu,
    p.representative_size
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
      FROM property_asset pa
      WHERE pa.parcel_id = p.parcel_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM property_profile pp
      WHERE pp.parcel_id = p.parcel_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM listing l
      WHERE l.parcel_id = p.parcel_id
    )
),
listed_land_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        1,
        'sale',
        42000000::BIGINT,
        'Preview land parcel positioned for a map-first page with zoning, size, and road context carrying the story.',
        'Preview land listing intended to validate parcel-first property pages.',
        'user-5',
        'Land',
        NULL::INTEGER,
        NULL::NUMERIC,
        NULL::NUMERIC,
        NULL::INTEGER
      ),
      (
        2,
        'sale',
        58000000::BIGINT,
        'Preview land parcel with a larger footprint for validating land-oriented detail hierarchy and map emphasis.',
        'Second land listing for previewing browse cards and detail pages outside residential defaults.',
        'user-5',
        'Land',
        NULL::INTEGER,
        NULL::NUMERIC,
        NULL::NUMERIC,
        NULL::INTEGER
      )
  ) AS t(
    seq,
    marketing_type,
    asking_price_rwf,
    property_description,
    listing_description,
    agent_user_id,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built
  )
),
listed_land_candidates AS (
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY representative_size DESC, district, sector, public_id
    ) AS seq,
    bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code = 'A1'
),
listed_land_rows AS (
  SELECT
    llc.parcel_id,
    llc.public_id,
    llc.upi,
    llc.district,
    llc.sector,
    llc.cell,
    llc.village,
    llc.zone_code,
    llc.zoning,
    llc.gen_lu,
    llc.representative_size,
    'land'::TEXT AS asset_type,
    llt.property_type,
    llt.marketing_type,
    'active'::TEXT AS listing_status,
    llt.asking_price_rwf,
    llt.property_description,
    llt.listing_description,
    llt.agent_user_id,
    llt.bedrooms,
    llt.bathrooms,
    llt.interior_area_sqm,
    llt.year_built
  FROM listed_land_candidates llc
  JOIN listed_land_templates llt
    ON llt.seq = llc.seq
),
listed_commercial_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        1,
        'rent',
        3200000::BIGINT,
        'Preview commercial unit seeded to validate utility-first page behavior with mixed-use zoning support.',
        'Commercial preview listing with rent-first CTA and mixed-use parcel context.',
        'user-5',
        'Commercial unit',
        NULL::INTEGER,
        2.0::NUMERIC,
        148.0::NUMERIC,
        2020::INTEGER
      ),
      (
        2,
        'sale',
        265000000::BIGINT,
        'Preview commercial unit intended to test broader area, access, and business-use framing on the property page.',
        'Second commercial preview listing for card variety and detail layout validation.',
        'user-5',
        'Commercial unit',
        NULL::INTEGER,
        3.0::NUMERIC,
        286.0::NUMERIC,
        2018::INTEGER
      )
  ) AS t(
    seq,
    marketing_type,
    asking_price_rwf,
    property_description,
    listing_description,
    agent_user_id,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built
  )
),
listed_commercial_candidates AS (
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY
        CASE
          WHEN zone_code = 'C3' THEN 0
          WHEN zone_code = 'C1' THEN 1
          ELSE 2
        END,
        representative_size DESC,
        district,
        sector,
        public_id
    ) AS seq,
    bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('C3', 'C1')
),
listed_commercial_rows AS (
  SELECT
    lcc.parcel_id,
    lcc.public_id,
    lcc.upi,
    lcc.district,
    lcc.sector,
    lcc.cell,
    lcc.village,
    lcc.zone_code,
    lcc.zoning,
    lcc.gen_lu,
    lcc.representative_size,
    'commercial_unit'::TEXT AS asset_type,
    lct.property_type,
    lct.marketing_type,
    'active'::TEXT AS listing_status,
    lct.asking_price_rwf,
    lct.property_description,
    lct.listing_description,
    lct.agent_user_id,
    lct.bedrooms,
    lct.bathrooms,
    lct.interior_area_sqm,
    lct.year_built
  FROM listed_commercial_candidates lcc
  JOIN listed_commercial_templates lct
    ON lct.seq = lcc.seq
),
listed_building_candidate AS (
  SELECT bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('R4', 'R3')
  ORDER BY
    CASE
      WHEN zone_code = 'R4' THEN 0
      ELSE 1
    END,
    representative_size DESC,
    district,
    sector,
    public_id
  LIMIT 1
),
listed_building_rows AS (
  SELECT
    lbc.parcel_id,
    lbc.public_id,
    lbc.upi,
    lbc.district,
    lbc.sector,
    lbc.cell,
    lbc.village,
    lbc.zone_code,
    lbc.zoning,
    lbc.gen_lu,
    lbc.representative_size,
    'apartment_building'::TEXT AS asset_type,
    'Apartment building'::TEXT AS property_type,
    'sale'::TEXT AS marketing_type,
    'active'::TEXT AS listing_status,
    910000000::BIGINT AS asking_price_rwf,
    'Preview building asset seeded to exercise building-level page behavior before unit pages exist.'::TEXT AS property_description,
    'Building-level listing for validating a summary-first page that can later branch to child units.'::TEXT AS listing_description,
    'user-5'::TEXT AS agent_user_id,
    NULL::INTEGER AS bedrooms,
    NULL::NUMERIC AS bathrooms,
    1680.0::NUMERIC AS interior_area_sqm,
    2021::INTEGER AS year_built
  FROM listed_building_candidate lbc
),
used_parcels AS (
  SELECT parcel_id FROM listed_land_rows
  UNION
  SELECT parcel_id FROM listed_commercial_rows
  UNION
  SELECT parcel_id FROM listed_building_rows
),
unlisted_house_candidate AS (
  SELECT bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('R1', 'R1A', 'R1B', 'R2')
    AND bep.parcel_id NOT IN (SELECT parcel_id FROM used_parcels)
  ORDER BY
    CASE
      WHEN zone_code = 'R1A' THEN 0
      WHEN zone_code = 'R1' THEN 1
      WHEN zone_code = 'R2' THEN 2
      ELSE 3
    END,
    representative_size DESC,
    district,
    sector,
    public_id
  LIMIT 1
),
unlisted_house_rows AS (
  SELECT
    uhc.parcel_id,
    uhc.public_id,
    uhc.upi,
    uhc.district,
    uhc.sector,
    uhc.cell,
    uhc.village,
    uhc.zone_code,
    uhc.zoning,
    uhc.gen_lu,
    uhc.representative_size,
    'house'::TEXT AS asset_type,
    'House'::TEXT AS property_type,
    NULL::TEXT AS marketing_type,
    'not_listed'::TEXT AS listing_status,
    NULL::BIGINT AS asking_price_rwf,
    'Preview unlisted house to validate map-first pages that still carry strong residential context.'::TEXT AS property_description,
    NULL::TEXT AS listing_description,
    'user-5'::TEXT AS agent_user_id,
    4::INTEGER AS bedrooms,
    3.0::NUMERIC AS bathrooms,
    214.0::NUMERIC AS interior_area_sqm,
    2019::INTEGER AS year_built
  FROM unlisted_house_candidate uhc
),
used_parcels_after_house AS (
  SELECT parcel_id FROM used_parcels
  UNION
  SELECT parcel_id FROM unlisted_house_rows
),
unlisted_apartment_candidate AS (
  SELECT bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('R4', 'R3')
    AND bep.parcel_id NOT IN (SELECT parcel_id FROM used_parcels_after_house)
  ORDER BY
    CASE
      WHEN zone_code = 'R4' THEN 0
      ELSE 1
    END,
    representative_size DESC,
    district,
    sector,
    public_id
  LIMIT 1
),
unlisted_apartment_rows AS (
  SELECT
    uac.parcel_id,
    uac.public_id,
    uac.upi,
    uac.district,
    uac.sector,
    uac.cell,
    uac.village,
    uac.zone_code,
    uac.zoning,
    uac.gen_lu,
    uac.representative_size,
    'apartment_unit'::TEXT AS asset_type,
    'Apartment unit'::TEXT AS property_type,
    NULL::TEXT AS marketing_type,
    'not_listed'::TEXT AS listing_status,
    NULL::BIGINT AS asking_price_rwf,
    'Preview unlisted apartment unit for validating unit-first copy and map-first unlisted behavior together.'::TEXT AS property_description,
    NULL::TEXT AS listing_description,
    'user-5'::TEXT AS agent_user_id,
    2::INTEGER AS bedrooms,
    2.0::NUMERIC AS bathrooms,
    96.0::NUMERIC AS interior_area_sqm,
    2022::INTEGER AS year_built
  FROM unlisted_apartment_candidate uac
),
used_parcels_after_apartment AS (
  SELECT parcel_id FROM used_parcels_after_house
  UNION
  SELECT parcel_id FROM unlisted_apartment_rows
),
unlisted_land_candidate AS (
  SELECT bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code = 'A1'
    AND bep.parcel_id NOT IN (SELECT parcel_id FROM used_parcels_after_apartment)
  ORDER BY representative_size DESC, district, sector, public_id
  LIMIT 1
),
unlisted_land_rows AS (
  SELECT
    ulc.parcel_id,
    ulc.public_id,
    ulc.upi,
    ulc.district,
    ulc.sector,
    ulc.cell,
    ulc.village,
    ulc.zone_code,
    ulc.zoning,
    ulc.gen_lu,
    ulc.representative_size,
    'land'::TEXT AS asset_type,
    'Land'::TEXT AS property_type,
    NULL::TEXT AS marketing_type,
    'not_listed'::TEXT AS listing_status,
    NULL::BIGINT AS asking_price_rwf,
    'Preview unlisted land parcel for validating pure parcel-context pages without gallery content.'::TEXT AS property_description,
    NULL::TEXT AS listing_description,
    'user-5'::TEXT AS agent_user_id,
    NULL::INTEGER AS bedrooms,
    NULL::NUMERIC AS bathrooms,
    NULL::NUMERIC AS interior_area_sqm,
    NULL::INTEGER AS year_built
  FROM unlisted_land_candidate ulc
),
selected_seed_rows AS (
  SELECT * FROM listed_land_rows
  UNION ALL
  SELECT * FROM listed_commercial_rows
  UNION ALL
  SELECT * FROM listed_building_rows
  UNION ALL
  SELECT * FROM unlisted_house_rows
  UNION ALL
  SELECT * FROM unlisted_apartment_rows
  UNION ALL
  SELECT * FROM unlisted_land_rows
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
    'preview_property_page_variants_v1'
  FROM selected_seed_rows ssr
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
    ssr.asset_type,
    UPPER(SUBSTR(MD5('public:' || ssr.parcel_id), 1, 10)),
    'AST-' || UPPER(SUBSTR(MD5('display:' || ssr.parcel_id), 1, 10)),
    ssr.property_description,
    TRUE,
    'preview_property_page_variants_v1'
  FROM selected_seed_rows ssr
  RETURNING id
),
listed_seed_rows AS (
  SELECT
    ssr.*,
    'lst_' || SUBSTR(MD5('preview_property_page_variants_v1:' || ssr.parcel_id), 1, 20) AS listing_id
  FROM selected_seed_rows ssr
  WHERE ssr.listing_status = 'active'
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
    lsr.listing_id,
    lsr.parcel_id,
    'ast_' || SUBSTR(MD5('parcel-primary:' || lsr.parcel_id), 1, 20),
    'agency-1',
    lsr.agent_user_id,
    'active',
    lsr.marketing_type,
    lsr.asking_price_rwf,
    'RWF',
    lsr.listing_description,
    'preview_property_page_variants_v1',
    NOW()
  FROM listed_seed_rows lsr
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
  'img_' || SUBSTR(MD5(lsr.listing_id || ':' || image_rows.sort_order::TEXT), 1, 20) AS id,
  lsr.listing_id,
  image_rows.sort_order,
  image_rows.image_url,
  CONCAT(lsr.sector, ' preview image ', image_rows.sort_order + 1),
  'preview_property_page_variants_v1'
FROM listed_seed_rows lsr
JOIN LATERAL (
  VALUES
    (0, CONCAT('https://picsum.photos/seed/', lsr.public_id, '-variant-1/1600/1000')),
    (1, CONCAT('https://picsum.photos/seed/', lsr.public_id, '-variant-2/1600/1000'))
) AS image_rows(sort_order, image_url)
  ON TRUE
ON CONFLICT (listing_id, sort_order) DO UPDATE
SET
  image_url = EXCLUDED.image_url,
  alt_text = EXCLUDED.alt_text,
  seed_source = EXCLUDED.seed_source;

COMMIT;
