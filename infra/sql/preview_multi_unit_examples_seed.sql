BEGIN;

DELETE FROM listing_image
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM listing
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM property_asset
WHERE seed_source = 'preview_multi_unit_examples_v1';

DELETE FROM property_profile
WHERE seed_source = 'preview_multi_unit_examples_v1';

WITH base_eligible_parcels AS (
  SELECT
    p.parcel_id,
    p.public_id,
    p.display_id,
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
    AND p.display_id IS NOT NULL
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
apartment_building_candidate AS (
  SELECT
    'apartment_building'::TEXT AS example_kind,
    bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('R4', 'R3')
  ORDER BY
    CASE
      WHEN bep.zone_code = 'R4' THEN 0
      ELSE 1
    END,
    bep.representative_size DESC,
    bep.district,
    bep.sector,
    bep.public_id
  LIMIT 1
),
commercial_building_candidate AS (
  SELECT
    'commercial_building'::TEXT AS example_kind,
    bep.*
  FROM base_eligible_parcels bep
  WHERE bep.zone_code IN ('C3', 'C1')
    AND bep.parcel_id NOT IN (SELECT parcel_id FROM apartment_building_candidate)
  ORDER BY
    CASE
      WHEN bep.zone_code = 'C3' THEN 0
      ELSE 1
    END,
    bep.representative_size DESC,
    bep.district,
    bep.sector,
    bep.public_id
  LIMIT 1
),
selected_buildings AS (
  SELECT * FROM apartment_building_candidate
  UNION ALL
  SELECT * FROM commercial_building_candidate
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
    sb.parcel_id,
    'user-5',
    NULL,
    CASE
      WHEN sb.example_kind = 'apartment_building' THEN 'Apartment building'
      ELSE 'Commercial building'
    END,
    NULL,
    NULL,
    CASE
      WHEN sb.example_kind = 'apartment_building' THEN 1460.0::NUMERIC
      ELSE 1280.0::NUMERIC
    END,
    CASE
      WHEN sb.example_kind = 'apartment_building' THEN 2022
      ELSE 2020
    END,
    'preview_multi_unit_examples_v1'
  FROM selected_buildings sb
),
upsert_primary_assets AS (
  INSERT INTO property_asset (
    id,
    parcel_id,
    asset_type,
    public_id,
    display_code,
    unit_label,
    description,
    is_primary_for_parcel,
    seed_source
  )
  SELECT
    'ast_' || SUBSTR(MD5('preview_multi_unit_examples_v1:building:' || sb.parcel_id), 1, 20) AS id,
    sb.parcel_id,
    CASE
      WHEN sb.example_kind = 'apartment_building' THEN 'apartment_building'
      ELSE 'commercial_building'
    END,
    UPPER(SUBSTR(MD5('preview_multi_unit_examples_v1:building-public:' || sb.parcel_id), 1, 10)),
    'AST-' || UPPER(SUBSTR(MD5('preview_multi_unit_examples_v1:building-display:' || sb.parcel_id), 1, 10)),
    NULL,
    NULL,
    TRUE,
    'preview_multi_unit_examples_v1'
  FROM selected_buildings sb
),
unit_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        'apartment_building'::TEXT,
        1::INTEGER,
        'apartment_unit'::TEXT,
        'A-201'::TEXT,
        NULL::TEXT,
        'active'::TEXT,
        'rent'::TEXT,
        1750000::BIGINT,
        2::INTEGER,
        2.0::NUMERIC,
        92.0::NUMERIC,
        2022::INTEGER
      ),
      (
        'apartment_building'::TEXT,
        2::INTEGER,
        'apartment_unit'::TEXT,
        'A-302'::TEXT,
        NULL::TEXT,
        'not_listed'::TEXT,
        NULL::TEXT,
        NULL::BIGINT,
        3::INTEGER,
        2.0::NUMERIC,
        108.0::NUMERIC,
        2022::INTEGER
      ),
      (
        'commercial_building'::TEXT,
        1::INTEGER,
        'commercial_unit'::TEXT,
        'G-04'::TEXT,
        NULL::TEXT,
        'active'::TEXT,
        'rent'::TEXT,
        2950000::BIGINT,
        NULL::INTEGER,
        1.0::NUMERIC,
        124.0::NUMERIC,
        2020::INTEGER
      ),
      (
        'commercial_building'::TEXT,
        2::INTEGER,
        'commercial_unit'::TEXT,
        'G-08'::TEXT,
        NULL::TEXT,
        'not_listed'::TEXT,
        NULL::TEXT,
        NULL::BIGINT,
        NULL::INTEGER,
        1.0::NUMERIC,
        136.0::NUMERIC,
        2020::INTEGER
      )
  ) AS t(
    example_kind,
    unit_seq,
    asset_type,
    unit_label,
    property_description,
    listing_status,
    marketing_type,
    asking_price_rwf,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built
  )
),
unit_rows AS (
  SELECT
    sb.example_kind,
    sb.parcel_id,
    sb.public_id AS parcel_public_id,
    sb.display_id,
    sb.district,
    sb.sector,
    sb.cell,
    sb.village,
    sb.zone_code,
    sb.zoning,
    sb.gen_lu,
    sb.representative_size,
    ut.unit_seq,
    ut.asset_type,
    ut.unit_label,
    ut.property_description,
    ut.listing_status,
    ut.marketing_type,
    ut.asking_price_rwf,
    ut.bedrooms,
    ut.bathrooms,
    ut.interior_area_sqm,
    ut.year_built
  FROM selected_buildings sb
  JOIN unit_templates ut
    ON ut.example_kind = sb.example_kind
),
upsert_unit_assets AS (
  INSERT INTO property_asset (
    id,
    parcel_id,
    parent_asset_id,
    asset_type,
    public_id,
    display_code,
    unit_label,
    description,
    is_primary_for_parcel,
    seed_source
  )
  SELECT
    'ast_' || SUBSTR(MD5('preview_multi_unit_examples_v1:unit:' || ur.parcel_id || ':' || ur.unit_label), 1, 20) AS id,
    ur.parcel_id,
    'ast_' || SUBSTR(MD5('preview_multi_unit_examples_v1:building:' || ur.parcel_id), 1, 20) AS parent_asset_id,
    ur.asset_type,
    UPPER(SUBSTR(MD5('preview_multi_unit_examples_v1:unit-public:' || ur.parcel_id || ':' || ur.unit_label), 1, 10)),
    'AST-' || UPPER(SUBSTR(MD5('preview_multi_unit_examples_v1:unit-display:' || ur.parcel_id || ':' || ur.unit_label), 1, 10)),
    ur.unit_label,
    ur.property_description,
    FALSE,
    'preview_multi_unit_examples_v1'
  FROM unit_rows ur
),
listed_unit_rows AS (
  SELECT
    ur.*,
    'agency-1'::TEXT AS agency_id,
    'user-5'::TEXT AS agent_user_id,
    'lst_' || SUBSTR(MD5('preview_multi_unit_examples_v1:listing:' || ur.parcel_id || ':' || ur.unit_label), 1, 20) AS listing_id
  FROM unit_rows ur
  WHERE ur.listing_status = 'active'
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
    lur.listing_id,
    lur.parcel_id,
    'ast_' || SUBSTR(MD5('preview_multi_unit_examples_v1:unit:' || lur.parcel_id || ':' || lur.unit_label), 1, 20),
    lur.agency_id,
    lur.agent_user_id,
    'active',
    lur.marketing_type,
    lur.asking_price_rwf,
    'RWF',
    lur.property_description,
    'preview_multi_unit_examples_v1',
    NOW()
  FROM listed_unit_rows lur
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
  'img_' || SUBSTR(MD5(lur.listing_id || ':' || image_rows.sort_order::TEXT), 1, 20) AS id,
  lur.listing_id,
  image_rows.sort_order,
  image_rows.image_url,
  CONCAT(lur.display_id, ' unit ', lur.unit_label, ' preview image ', image_rows.sort_order + 1),
  'preview_multi_unit_examples_v1'
FROM listed_unit_rows lur
JOIN LATERAL (
  VALUES
    (0, CONCAT('https://picsum.photos/seed/', lur.parcel_public_id, '-', lur.unit_label, '-1/1600/1000')),
    (1, CONCAT('https://picsum.photos/seed/', lur.parcel_public_id, '-', lur.unit_label, '-2/1600/1000'))
) AS image_rows(sort_order, image_url)
  ON TRUE
ON CONFLICT (listing_id, sort_order) DO UPDATE
SET
  image_url = EXCLUDED.image_url,
  alt_text = EXCLUDED.alt_text,
  seed_source = EXCLUDED.seed_source;

COMMIT;
