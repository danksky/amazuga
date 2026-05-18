-- Imports the current mock listing surface into preview DB tables.
--
-- Important behavior:
-- - preserves mock user, agency, and listing IDs
-- - does not preserve mock property IDs
-- - remaps the 10 active mock listings onto the first 10 eligible Kigali parcels
-- - preserves current picsum placeholder image URLs from data/listings.json
--
-- Preconditions:
-- - preview_listing_seed_schema.sql has already been applied
-- - parcel_app_ready_seed_preview exists and has parcel_id/public_id rows

BEGIN;

DO $$
DECLARE
  eligible_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO eligible_count
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
        AND l.seed_source <> 'mock_import_listing_surface_v1'
    );

  IF eligible_count < 10 THEN
    RAISE EXCEPTION
      'Need at least 10 eligible Kigali parcels for mock listing import; found %.',
      eligible_count;
  END IF;
END $$;

INSERT INTO app_user (
  id,
  email,
  full_name,
  roles,
  mock_persona_label,
  mock_persona_description,
  upi_lookup_count_today,
  status,
  seed_source
)
VALUES
  ('user-1', 'daniel.kawalsky@gmail.com', 'Daniel Kawalsky', ARRAY['user', 'admin']::TEXT[], 'Admin', 'Moderates applications and reviews platform activity.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-2', 'buyer@amazuga.test', 'Aline Uwimana', ARRAY['user']::TEXT[], 'Consumer', 'Typical buyer browsing homes and saving properties.', 3, 'active', 'mock_import_listing_surface_v1'),
  ('user-3', 'new.agent@amazuga.test', 'Eric Habimana', ARRAY['user']::TEXT[], 'Prospective agent', 'Has not applied yet and should start the sell flow from scratch.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-4', 'pending.founder@amazuga.test', 'Chantal Uwase', ARRAY['user']::TEXT[], 'Pending agency founder', 'Submitted an agency registration that is still under review.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-5', 'manager@amazuga.test', 'Alice Mukamana', ARRAY['user', 'agent', 'agency_manager']::TEXT[], 'Approved agency manager', 'Approved as both agent and manager, with an active agency.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-6', 'pending.valuator@amazuga.test', 'Claude Mukiza', ARRAY['user']::TEXT[], 'Pending valuator', 'Submitted valuator recognition and is waiting for review.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-7', 'valuator@amazuga.test', 'Jeanne Mukandoli', ARRAY['user', 'valuator']::TEXT[], 'Approved valuator', 'Recognized valuator with approved valuation activity.', 0, 'active', 'mock_import_listing_surface_v1'),
  ('user-8', 'private.lister@amazuga.test', 'Ines Nyirahabimana', ARRAY['user']::TEXT[], 'Private lister', 'Owns an off-market property and wants to sell privately without an agency.', 0, 'active', 'mock_import_listing_surface_v1')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  roles = EXCLUDED.roles,
  mock_persona_label = EXCLUDED.mock_persona_label,
  mock_persona_description = EXCLUDED.mock_persona_description,
  upi_lookup_count_today = EXCLUDED.upi_lookup_count_today,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

INSERT INTO agency (
  id,
  slug,
  created_from_application_id,
  business_name,
  tin,
  whatsapp_phone,
  website_url,
  status,
  pending_manager_user_id,
  manager_user_id,
  seed_source
)
VALUES (
  'agency-1',
  'kigali-homes-group',
  'agency-application-2',
  'Kigali Homes Group',
  '107839210',
  '+250788123456',
  'https://example.com',
  'approved',
  'user-5',
  'user-5',
  'mock_import_listing_surface_v1'
)
ON CONFLICT (id) DO UPDATE
SET
  slug = EXCLUDED.slug,
  created_from_application_id = EXCLUDED.created_from_application_id,
  business_name = EXCLUDED.business_name,
  tin = EXCLUDED.tin,
  whatsapp_phone = EXCLUDED.whatsapp_phone,
  website_url = EXCLUDED.website_url,
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
  ('agency-1-manager-user-5', 'agency-1', 'user-5', 'manager', 'active', 'mock_import_listing_surface_v1'),
  ('agency-1-agent-user-5', 'agency-1', 'user-5', 'agent', 'active', 'mock_import_listing_surface_v1')
ON CONFLICT (agency_id, user_id, role) DO UPDATE
SET
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source;

INSERT INTO property_ownership (
  id,
  user_id,
  property_id,
  property_internal_id,
  parcel_id,
  ownership_scope,
  created_from_claim_request_id,
  seed_source
)
VALUES (
  'property-ownership-private-lister-5974CFE46F',
  'user-8',
  '5974CFE46F',
  'ast_2fdb9b766941533ef20f',
  '72Z7MW9A',
  'full',
  NULL,
  'mock_import_listing_surface_v1'
)
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  property_id = EXCLUDED.property_id,
  property_internal_id = EXCLUDED.property_internal_id,
  parcel_id = EXCLUDED.parcel_id,
  ownership_scope = EXCLUDED.ownership_scope,
  created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

INSERT INTO agency_application (
  id,
  created_by_user_id,
  business_name,
  tin,
  website_url,
  google_maps_url,
  status,
  seed_source,
  created_at,
  updated_at
)
VALUES
  (
    'agency-application-1',
    'user-4',
    'Umurage Property Partners',
    '119000321',
    NULL,
    NULL,
    'pending',
    'mock_import_listing_surface_v1',
    '2026-03-18T11:00:00.000Z'::TIMESTAMPTZ,
    '2026-03-18T11:00:00.000Z'::TIMESTAMPTZ
  ),
  (
    'agency-application-2',
    'user-5',
    'Kigali Homes Group',
    '107839210',
    'https://example.com',
    NULL,
    'approved',
    'mock_import_listing_surface_v1',
    '2026-03-15T09:00:00.000Z'::TIMESTAMPTZ,
    '2026-03-15T09:00:00.000Z'::TIMESTAMPTZ
  )
ON CONFLICT (id) DO UPDATE
SET
  created_by_user_id = EXCLUDED.created_by_user_id,
  business_name = EXCLUDED.business_name,
  tin = EXCLUDED.tin,
  website_url = EXCLUDED.website_url,
  google_maps_url = EXCLUDED.google_maps_url,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO agent_application (
  id,
  user_id,
  national_id_photo_url,
  selected_agency_id,
  status,
  seed_source,
  created_at,
  updated_at
)
VALUES (
  'agent-application-1',
  'user-5',
  '/placeholders/property-generic.svg',
  'agency-1',
  'approved',
  'mock_import_listing_surface_v1',
  '2026-03-16T09:00:00.000Z'::TIMESTAMPTZ,
  '2026-03-16T09:00:00.000Z'::TIMESTAMPTZ
)
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  national_id_photo_url = EXCLUDED.national_id_photo_url,
  selected_agency_id = EXCLUDED.selected_agency_id,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

INSERT INTO valuator_application (
  id,
  user_id,
  irpv_registration_number,
  status,
  seed_source,
  created_at,
  updated_at
)
VALUES
  (
    'valuator-application-1',
    'user-6',
    'IRPV-2026-188',
    'pending',
    'mock_import_listing_surface_v1',
    '2026-03-18T10:00:00.000Z'::TIMESTAMPTZ,
    '2026-03-18T10:00:00.000Z'::TIMESTAMPTZ
  ),
  (
    'valuator-application-2',
    'user-7',
    'IRPV-2026-077',
    'approved',
    'mock_import_listing_surface_v1',
    '2026-03-12T09:00:00.000Z'::TIMESTAMPTZ,
    '2026-03-12T09:00:00.000Z'::TIMESTAMPTZ
  )
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  irpv_registration_number = EXCLUDED.irpv_registration_number,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

WITH mock_listing_source AS (
  SELECT *
  FROM (
    VALUES
      (
        1,
        'property-1',
        'listing-1',
        'Kimihurura Ridge Home',
        'Detached residence positioned on a sloping parcel with open western views.',
        'House',
        4,
        3.0::NUMERIC,
        285::NUMERIC,
        2018,
        'sale',
        185000000::BIGINT,
        'RWF',
        'Modern hillside residence with city views',
        'Well-kept family home with an efficient layout, terrace seating, and easy road access.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-01T10:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-12T14:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kimihurura-ridge-home/1600/1000',
          'https://picsum.photos/seed/amazuga-kimihurura-ridge-home-2/1600/1000'
        ]::TEXT[]
      ),
      (
        2,
        'property-3',
        'listing-2',
        'Kicukiro Rental Flat',
        'Rental-ready unit with efficient interior planning and access to nearby services.',
        'Apartment',
        2,
        2.0::NUMERIC,
        88::NUMERIC,
        2021,
        'rent',
        950000::BIGINT,
        'RWF',
        'Compact rental near services and transit',
        'Bright rental unit with a practical footprint and short travel to neighborhood services.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-05T10:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-15T12:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kicukiro-rental-flat/1600/1000',
          'https://picsum.photos/seed/amazuga-kicukiro-rental-flat-2/1600/1000'
        ]::TEXT[]
      ),
      (
        3,
        'property-4',
        'listing-3',
        'Remera Garden House',
        'A mid-size home with enclosed outdoor space and straightforward circulation.',
        'House',
        3,
        2.0::NUMERIC,
        198::NUMERIC,
        2017,
        'sale',
        132000000::BIGINT,
        'RWF',
        'Three-bedroom house with enclosed garden',
        'Balanced family layout with a compact landscaped yard and updated finishes.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-06T10:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-16T10:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-remera-garden-house/1600/1000',
          'https://picsum.photos/seed/amazuga-remera-garden-house-2/1600/1000'
        ]::TEXT[]
      ),
      (
        4,
        'property-5',
        'listing-4',
        'Nyarutarama Family Residence',
        'A larger modern home arranged across multiple levels with broad frontage.',
        'House',
        5,
        4.0::NUMERIC,
        372::NUMERIC,
        2020,
        'sale',
        248000000::BIGINT,
        'RWF',
        'Large modern home with flexible upper floor',
        'Generous home footprint suited for a larger household or mixed live-work use.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-04T08:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-15T16:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-nyarutarama-family-residence/1600/1000',
          'https://picsum.photos/seed/amazuga-nyarutarama-family-residence-2/1600/1000'
        ]::TEXT[]
      ),
      (
        5,
        'property-6',
        'listing-5',
        'Gisozi Starter Home',
        'Compact detached house with efficient planning and a manageable parcel.',
        'House',
        3,
        2.0::NUMERIC,
        154::NUMERIC,
        2016,
        'sale',
        99000000::BIGINT,
        'RWF',
        'Starter home on a quiet interior road',
        'Efficient plan with practical room sizes and steady road access.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-07T12:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-17T09:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-gisozi-starter-home/1600/1000',
          'https://picsum.photos/seed/amazuga-gisozi-starter-home-2/1600/1000'
        ]::TEXT[]
      ),
      (
        6,
        'property-7',
        'listing-6',
        'Kimironko Corner House',
        'A practical corner-lot house with a stronger street presence and flexible interior use.',
        'House',
        4,
        3.0::NUMERIC,
        232::NUMERIC,
        2019,
        'sale',
        158000000::BIGINT,
        'RWF',
        'Corner parcel house near district services',
        'A bright house with a clear plan, parking apron, and easy service access.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-08T11:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-17T11:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kimironko-corner-house/1600/1000',
          'https://picsum.photos/seed/amazuga-kimironko-corner-house-2/1600/1000'
        ]::TEXT[]
      ),
      (
        7,
        'property-8',
        'listing-7',
        'Kicukiro Balcony Apartment',
        'A well-lit rental apartment with a clean plan and accessible neighborhood services.',
        'Apartment',
        2,
        2.0::NUMERIC,
        94::NUMERIC,
        2022,
        'rent',
        1200000::BIGINT,
        'RWF',
        'Two-bedroom rental with balcony',
        'Well-lit apartment with a practical kitchen and a sheltered outdoor edge.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-09T10:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-17T13:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kicukiro-balcony-apartment/1600/1000',
          'https://picsum.photos/seed/amazuga-kicukiro-balcony-apartment-2/1600/1000'
        ]::TEXT[]
      ),
      (
        8,
        'property-9',
        'listing-8',
        'Nyarugunga Flexible Rental',
        'Larger rental unit with room for a second bedroom, office, or guest use.',
        'Apartment',
        3,
        2.0::NUMERIC,
        118::NUMERIC,
        2020,
        'rent',
        1500000::BIGINT,
        'RWF',
        'Larger rental unit with flexible second room',
        'Useful rental layout with room for a home office or guest room arrangement.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-10T09:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-18T08:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-nyarugunga-flexible-rental/1600/1000',
          'https://picsum.photos/seed/amazuga-nyarugunga-flexible-rental-2/1600/1000'
        ]::TEXT[]
      ),
      (
        9,
        'property-10',
        'listing-9',
        'Kacyiru Townhouse',
        'A tidy townhouse with practical family circulation and easy access to office corridors.',
        'House',
        4,
        3.0::NUMERIC,
        214::NUMERIC,
        2018,
        'sale',
        168000000::BIGINT,
        'RWF',
        'Four-bedroom townhouse near office corridors',
        'Well-balanced townhouse with practical family sizing and quick access to Kacyiru services.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-11T08:30:00.000Z'::TIMESTAMPTZ,
        '2026-03-18T10:00:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kacyiru-townhouse/1600/1000',
          'https://picsum.photos/seed/amazuga-kacyiru-townhouse-2/1600/1000'
        ]::TEXT[]
      ),
      (
        10,
        'property-11',
        'listing-10',
        'Kimisagara Upper-Floor Rental',
        'A bright upper-floor rental with a comfortable living area and strong daily convenience.',
        'Apartment',
        2,
        2.0::NUMERIC,
        96::NUMERIC,
        2021,
        'rent',
        1100000::BIGINT,
        'RWF',
        'Upper-floor rental with bright living room',
        'Simple two-bedroom rental with an easy layout and strong day-to-day neighborhood access.',
        'agency-1',
        'user-5',
        'active',
        '2026-03-12T09:15:00.000Z'::TIMESTAMPTZ,
        '2026-03-18T10:30:00.000Z'::TIMESTAMPTZ,
        ARRAY[
          'https://picsum.photos/seed/amazuga-kimisagara-upper-floor-rental/1600/1000',
          'https://picsum.photos/seed/amazuga-kimisagara-upper-floor-rental-2/1600/1000'
        ]::TEXT[]
      )
  ) AS t(
    seq,
    mock_property_id,
    listing_id,
    title,
    property_description,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built,
    marketing_type,
    asking_price_rwf,
    currency,
    headline,
    listing_description,
    agency_id,
    agent_user_id,
    status,
    created_at,
    updated_at,
    image_urls
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
        AND l.seed_source <> 'mock_import_listing_surface_v1'
    )
),
selected_rows AS (
  SELECT
    ep.parcel_id,
    ep.public_id,
    ep.district,
    ep.sector,
    ep.cell,
    ep.village,
    mls.seq,
    mls.mock_property_id,
    mls.listing_id,
    mls.title,
    mls.property_description,
    mls.property_type,
    mls.bedrooms,
    mls.bathrooms,
    mls.interior_area_sqm,
    mls.year_built,
    mls.marketing_type,
    mls.asking_price_rwf,
    mls.currency,
    mls.headline,
    mls.listing_description,
    mls.agency_id,
    mls.agent_user_id,
    mls.status,
    mls.created_at,
    mls.updated_at,
    mls.image_urls
  FROM mock_listing_source mls
  JOIN eligible_parcels ep
    ON ep.seq = mls.seq
),
delete_stale_listings AS (
  DELETE FROM listing l
  WHERE l.seed_source = 'mock_import_listing_surface_v1'
    AND l.id NOT IN (
      SELECT listing_id
      FROM selected_rows
    )
  RETURNING l.id
),
delete_stale_profiles AS (
  DELETE FROM property_profile pp
  WHERE pp.seed_source = 'mock_import_listing_surface_v1'
    AND pp.parcel_id NOT IN (
      SELECT parcel_id
      FROM selected_rows
    )
  RETURNING pp.parcel_id
),
delete_stale_assets AS (
  DELETE FROM property_asset pa
  WHERE pa.seed_source = 'mock_import_listing_surface_v1'
    AND pa.parcel_id NOT IN (
      SELECT parcel_id
      FROM selected_rows
    )
  RETURNING pa.id
),
delete_stale_saved_properties AS (
  DELETE FROM saved_property sp
  WHERE sp.seed_source = 'mock_import_listing_surface_v1'
  RETURNING sp.id
),
upsert_assets AS (
  INSERT INTO property_asset (
    id,
    parcel_id,
    asset_type,
    public_id,
    display_code,
    title,
    description,
    is_primary_for_parcel,
    seed_source
  )
  SELECT
    'ast_' || SUBSTR(MD5('parcel-primary:' || sr.parcel_id), 1, 20),
    sr.parcel_id,
    CASE
      WHEN LOWER(sr.property_type) = 'house' THEN 'house'
      WHEN LOWER(sr.property_type) IN ('parcel', 'land', 'lot') THEN 'land'
      WHEN LOWER(sr.property_type) IN ('apartment', 'flat', 'unit') THEN 'apartment_unit'
      WHEN LOWER(sr.property_type) LIKE 'commercial%' THEN 'commercial_unit'
      WHEN LOWER(sr.property_type) LIKE 'building%' THEN 'building'
      WHEN LOWER(sr.property_type) = 'mixed use' THEN 'mixed_use'
      ELSE 'other'
    END,
    UPPER(SUBSTR(MD5('public:' || sr.parcel_id), 1, 10)),
    'AST-' || UPPER(SUBSTR(MD5('display:' || sr.parcel_id), 1, 10)),
    sr.title,
    sr.property_description,
    TRUE,
    'mock_import_listing_surface_v1'
  FROM selected_rows sr
  ON CONFLICT (id) DO UPDATE
  SET
    asset_type = EXCLUDED.asset_type,
    public_id = EXCLUDED.public_id,
    title = EXCLUDED.title,
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
    title,
    description,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built,
    seed_source
  )
  SELECT
    sr.parcel_id,
    sr.agent_user_id,
    sr.title,
    sr.property_description,
    sr.property_type,
    sr.bedrooms,
    sr.bathrooms,
    sr.interior_area_sqm,
    sr.year_built,
    'mock_import_listing_surface_v1'
  FROM selected_rows sr
  ON CONFLICT (parcel_id) DO UPDATE
  SET
    created_by_user_id = EXCLUDED.created_by_user_id,
    title = EXCLUDED.title,
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
    headline,
    description,
    seed_source,
    published_at,
    created_at,
    updated_at
  )
  SELECT
    sr.listing_id,
    sr.parcel_id,
    'ast_' || SUBSTR(MD5('parcel-primary:' || sr.parcel_id), 1, 20),
    sr.agency_id,
    sr.agent_user_id,
    sr.status,
    sr.marketing_type,
    sr.asking_price_rwf,
    sr.currency,
    sr.headline,
    sr.listing_description,
    'mock_import_listing_surface_v1',
    sr.created_at,
    sr.created_at,
    sr.updated_at
  FROM selected_rows sr
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
    headline = EXCLUDED.headline,
    description = EXCLUDED.description,
    seed_source = EXCLUDED.seed_source,
    published_at = EXCLUDED.published_at,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at
  RETURNING id
),
clear_selected_listing_images AS (
  DELETE FROM listing_image li
  WHERE li.seed_source = 'mock_import_listing_surface_v1'
    AND li.listing_id IN (
      SELECT listing_id
      FROM selected_rows
    )
  RETURNING li.id
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
  CONCAT(sr.listing_id, '-image-', image_row.sort_order) AS id,
  sr.listing_id,
  image_row.sort_order,
  image_row.image_url,
  CONCAT(sr.title, ' image ', image_row.sort_order + 1),
  'mock_import_listing_surface_v1'
FROM selected_rows sr
JOIN LATERAL (
  SELECT
    image_url,
    ordinality - 1 AS sort_order
  FROM UNNEST(sr.image_urls) WITH ORDINALITY AS image_source(image_url, ordinality)
) AS image_row
  ON TRUE
ON CONFLICT (id) DO UPDATE
SET
  listing_id = EXCLUDED.listing_id,
  sort_order = EXCLUDED.sort_order,
  image_url = EXCLUDED.image_url,
  alt_text = EXCLUDED.alt_text,
  seed_source = EXCLUDED.seed_source;

WITH saved_property_seed AS (
  SELECT
    'svp_' || SUBSTR(MD5('saved:user-2:property-1'), 1, 20) AS id,
    'user-2'::TEXT AS user_id,
    pa.public_id AS property_route_id,
    NULL::TEXT AS legacy_property_ref,
    'mock_import_listing_surface_v1'::TEXT AS seed_source
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'

  UNION ALL

  SELECT
    'svp_' || SUBSTR(MD5('saved:user-2:property-3'), 1, 20) AS id,
    'user-2'::TEXT AS user_id,
    pa.public_id AS property_route_id,
    NULL::TEXT AS legacy_property_ref,
    'mock_import_listing_surface_v1'::TEXT AS seed_source
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-2'
)
INSERT INTO saved_property (
  id,
  user_id,
  property_route_id,
  legacy_property_ref,
  seed_source
)
SELECT
  id,
  user_id,
  property_route_id,
  legacy_property_ref,
  seed_source
FROM saved_property_seed
ON CONFLICT (id) DO UPDATE
SET
  property_route_id = EXCLUDED.property_route_id,
  legacy_property_ref = EXCLUDED.legacy_property_ref,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

WITH valuation_seed AS (
  SELECT
    'valuation-1'::TEXT AS id,
    pa.public_id AS property_id,
    pa.id AS property_asset_id,
    NULL::TEXT AS legacy_property_ref,
    'user-7'::TEXT AS submitted_by_user_id,
    FALSE AS is_anonymous,
    '2026-02-01'::DATE AS effective_date,
    176000000::BIGINT AS estimated_value_rwf,
    'RWF'::TEXT AS currency,
    'approved'::TEXT AS status,
    'mock_import_listing_surface_v1'::TEXT AS seed_source,
    '2026-02-01T08:00:00.000Z'::TIMESTAMPTZ AS created_at,
    '2026-02-01T08:00:00.000Z'::TIMESTAMPTZ AS updated_at
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'

  UNION ALL

  SELECT
    'valuation-2'::TEXT AS id,
    pa.public_id AS property_id,
    pa.id AS property_asset_id,
    NULL::TEXT AS legacy_property_ref,
    'user-7'::TEXT AS submitted_by_user_id,
    TRUE AS is_anonymous,
    '2025-11-18'::DATE AS effective_date,
    168000000::BIGINT AS estimated_value_rwf,
    'RWF'::TEXT AS currency,
    'approved'::TEXT AS status,
    'mock_import_listing_surface_v1'::TEXT AS seed_source,
    '2025-11-18T08:00:00.000Z'::TIMESTAMPTZ AS created_at,
    '2025-11-18T08:00:00.000Z'::TIMESTAMPTZ AS updated_at
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  WHERE l.id = 'listing-1'
)
INSERT INTO valuation_submission (
  id,
  property_id,
  property_asset_id,
  legacy_property_ref,
  submitted_by_user_id,
  is_anonymous,
  effective_date,
  estimated_value_rwf,
  currency,
  status,
  seed_source,
  created_at,
  updated_at
)
SELECT
  id,
  property_id,
  property_asset_id,
  legacy_property_ref,
  submitted_by_user_id,
  is_anonymous,
  effective_date,
  estimated_value_rwf,
  currency,
  status,
  seed_source,
  created_at,
  updated_at
FROM valuation_seed
ON CONFLICT (id) DO UPDATE
SET
  property_id = EXCLUDED.property_id,
  property_asset_id = EXCLUDED.property_asset_id,
  legacy_property_ref = EXCLUDED.legacy_property_ref,
  submitted_by_user_id = EXCLUDED.submitted_by_user_id,
  is_anonymous = EXCLUDED.is_anonymous,
  effective_date = EXCLUDED.effective_date,
  estimated_value_rwf = EXCLUDED.estimated_value_rwf,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

COMMIT;
