CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT ARRAY['user']::TEXT[],
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  tin TEXT NOT NULL,
  whatsapp_phone TEXT,
  website_url TEXT,
  google_maps_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  pending_manager_user_id TEXT REFERENCES app_user(id),
  manager_user_id TEXT REFERENCES app_user(id),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_membership (
  id TEXT PRIMARY KEY,
  agency_id TEXT NOT NULL REFERENCES agency(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS property_profile (
  parcel_id TEXT PRIMARY KEY,
  created_by_user_id TEXT REFERENCES app_user(id),
  title TEXT NOT NULL,
  description TEXT,
  property_type TEXT NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC(4, 1),
  interior_area_sqm NUMERIC(12, 2),
  year_built INTEGER,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_asset (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL,
  parent_asset_id TEXT REFERENCES property_asset(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (
    asset_type IN (
      'house',
      'land',
      'building',
      'apartment_unit',
      'commercial_unit',
      'mixed_use',
      'other'
    )
  ),
  public_id TEXT NOT NULL UNIQUE,
  display_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  is_primary_for_parcel BOOLEAN NOT NULL DEFAULT FALSE,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing (
  id TEXT PRIMARY KEY,
  parcel_id TEXT NOT NULL,
  property_asset_id TEXT NOT NULL REFERENCES property_asset(id),
  agency_id TEXT NOT NULL REFERENCES agency(id),
  agent_user_id TEXT NOT NULL REFERENCES app_user(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  marketing_type TEXT NOT NULL CHECK (marketing_type IN ('sale', 'rent')),
  asking_price_rwf BIGINT NOT NULL CHECK (asking_price_rwf > 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
  headline TEXT,
  description TEXT,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listing_image (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, sort_order)
);

CREATE UNIQUE INDEX IF NOT EXISTS property_asset_one_primary_per_parcel_idx
  ON property_asset (parcel_id)
  WHERE is_primary_for_parcel;

CREATE INDEX IF NOT EXISTS property_asset_parcel_id_idx
  ON property_asset (parcel_id);

CREATE INDEX IF NOT EXISTS property_asset_parent_asset_id_idx
  ON property_asset (parent_asset_id);

CREATE INDEX IF NOT EXISTS property_asset_asset_type_idx
  ON property_asset (asset_type);

CREATE UNIQUE INDEX IF NOT EXISTS listing_one_active_per_asset_idx
  ON listing (property_asset_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS listing_status_marketing_type_idx
  ON listing (status, marketing_type);

CREATE INDEX IF NOT EXISTS listing_parcel_id_idx
  ON listing (parcel_id);

CREATE INDEX IF NOT EXISTS listing_property_asset_id_idx
  ON listing (property_asset_id);

CREATE INDEX IF NOT EXISTS listing_agency_id_idx
  ON listing (agency_id);

CREATE INDEX IF NOT EXISTS listing_agent_user_id_idx
  ON listing (agent_user_id);

CREATE INDEX IF NOT EXISTS property_profile_property_type_idx
  ON property_profile (property_type);

CREATE OR REPLACE VIEW preview_active_listing_surface_v1 AS
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
  COALESCE(pa.title, pp.title) AS title,
  COALESCE(pa.description, pp.description) AS property_description,
  COALESCE(
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Parcel'
      WHEN 'building' THEN 'Building'
      WHEN 'apartment_unit' THEN 'Apartment'
      WHEN 'commercial_unit' THEN 'Commercial'
      WHEN 'mixed_use' THEN 'Mixed Use'
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
  l.headline,
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
JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

COMMENT ON TABLE property_profile IS
'App-owned property enrichment keyed by parcel_id. Keeps marketing and home facts separate from the parcel seed pipeline.';

COMMENT ON TABLE property_asset IS
'App-owned marketable real estate object keyed to a parcel. Supports one parcel having many listable units over time.';

COMMENT ON COLUMN property_asset.public_id IS
'Public-safe property identifier for asset-level routes. This is the preferred user-facing property ID.';

COMMENT ON COLUMN property_asset.is_primary_for_parcel IS
'Marks the default top-level asset for a parcel so legacy parcel-first records can be backfilled safely.';

COMMENT ON COLUMN listing.parcel_id IS
'Intended to join to parcel_app_ready_seed_preview.parcel_id. Deliberately not a hard FK yet because the parcel seed table is still a working preview contract.';

COMMENT ON COLUMN listing.property_asset_id IS
'App-owned asset reference for the specific house, unit, suite, or parcel-backed asset being listed.';

COMMENT ON VIEW preview_active_listing_surface_v1 IS
'Preview join surface for future browse and property queries once mock data is removed.';
