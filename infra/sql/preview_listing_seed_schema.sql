CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT ARRAY['user']::TEXT[],
  avatar_url TEXT,
  mock_persona_label TEXT,
  mock_persona_description TEXT,
  upi_lookup_count_today INTEGER NOT NULL DEFAULT 0 CHECK (upi_lookup_count_today >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  created_from_application_id TEXT,
  business_name TEXT NOT NULL,
  tin TEXT NOT NULL,
  whatsapp_phone TEXT,
  website_url TEXT,
  google_maps_url TEXT,
  instagram_url TEXT,
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
  description TEXT,
  property_type TEXT NOT NULL CHECK (LOWER(BTRIM(property_type)) <> 'building'),
  bedrooms INTEGER,
  bathrooms NUMERIC(4, 1),
  interior_area_sqm NUMERIC(12, 2),
  year_built INTEGER,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_asset_profile (
  property_asset_id TEXT PRIMARY KEY REFERENCES property_asset(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES app_user(id),
  description TEXT,
  property_type TEXT NOT NULL CHECK (LOWER(BTRIM(property_type)) <> 'building'),
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
      'apartment_building',
      'commercial_building',
      'apartment_unit',
      'commercial_unit'
    )
  ),
  public_id TEXT NOT NULL UNIQUE,
  display_code TEXT NOT NULL UNIQUE,
  unit_label TEXT,
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
  asking_price_rwf BIGINT CHECK (asking_price_rwf IS NULL OR asking_price_rwf > 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
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
  storage_key TEXT,
  content_type TEXT,
  width INTEGER,
  height INTEGER,
  file_size_bytes INTEGER,
  uploaded_by_user_id TEXT REFERENCES app_user(id),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'processing', 'failed', 'pending_delete', 'delete_failed')),
  alt_text TEXT,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, sort_order)
);

CREATE TABLE IF NOT EXISTS listing_image_cleanup_job (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  listing_id TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by_user_id TEXT REFERENCES app_user(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'failed', 'completed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_property (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  property_route_id TEXT,
  legacy_property_ref TEXT,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_route_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS agency_application (
  id TEXT PRIMARY KEY,
  created_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  business_name TEXT NOT NULL,
  tin TEXT NOT NULL,
  website_url TEXT,
  google_maps_url TEXT,
  instagram_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_application (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  national_id_photo_url TEXT NOT NULL,
  selected_agency_id TEXT REFERENCES agency(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuator_application (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  irpv_registration_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_claim_request (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  request_kind TEXT NOT NULL DEFAULT 'claim' CHECK (request_kind IN ('claim', 'transfer')),
  property_id TEXT,
  property_internal_id TEXT REFERENCES property_asset(id),
  parcel_id TEXT NOT NULL,
  upi TEXT NOT NULL,
  claim_scope TEXT NOT NULL DEFAULT 'full_parcel' CHECK (claim_scope IN ('full_parcel', 'unit_partial')),
  unit_label TEXT,
  declared_property_type TEXT CHECK (declared_property_type IN (
    'house', 'apartment_building', 'land', 'apartment_unit', 'commercial_building', 'commercial_unit'
  )),
  tenure_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_type IN ('freehold', 'emphyteutic_lease', 'unspecified')),
  tenure_source TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_source IN ('user_provided', 'auto_populated', 'unspecified')),
  declared_asset_type TEXT CHECK (declared_asset_type IN (
    'house', 'land', 'apartment_building', 'commercial_building', 'apartment_unit', 'commercial_unit'
  )),
  representative_size NUMERIC(14,2),
  zoning TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(4,1),
  interior_area_sqm NUMERIC(14,2),
  year_built INTEGER,
  description TEXT,
  transfer_mode TEXT CHECK (transfer_mode IN ('sale', 'transfer')),
  transfer_from_user_id TEXT REFERENCES app_user(id),
  transfer_initiated_by_user_id TEXT REFERENCES app_user(id),
  buyer_confirmed_at TIMESTAMPTZ,
  buyer_declined_at TIMESTAMPTZ,
  transfer_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_ownership (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_user(id),
  property_id TEXT NOT NULL,
  property_internal_id TEXT NOT NULL REFERENCES property_asset(id),
  parcel_id TEXT NOT NULL,
  ownership_scope TEXT NOT NULL CHECK (ownership_scope IN ('full', 'unit')),
  created_from_claim_request_id TEXT REFERENCES property_claim_request(id),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS valuation_submission (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  property_asset_id TEXT REFERENCES property_asset(id),
  legacy_property_ref TEXT,
  submitted_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  effective_date DATE NOT NULL,
  estimated_value_rwf BIGINT NOT NULL CHECK (estimated_value_rwf > 0),
  currency TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_asset_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
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

CREATE INDEX IF NOT EXISTS saved_property_user_id_idx
  ON saved_property (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_route_id_idx
  ON saved_property (user_id, property_route_id)
  WHERE property_route_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_legacy_ref_idx
  ON saved_property (user_id, legacy_property_ref)
  WHERE legacy_property_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS agency_application_created_by_user_id_idx
  ON agency_application (created_by_user_id);

CREATE INDEX IF NOT EXISTS agency_application_status_idx
  ON agency_application (status);

CREATE INDEX IF NOT EXISTS agent_application_user_id_idx
  ON agent_application (user_id);

CREATE INDEX IF NOT EXISTS agent_application_status_idx
  ON agent_application (status);

CREATE INDEX IF NOT EXISTS valuator_application_user_id_idx
  ON valuator_application (user_id);

CREATE INDEX IF NOT EXISTS valuator_application_status_idx
  ON valuator_application (status);

CREATE INDEX IF NOT EXISTS property_claim_request_user_id_idx
  ON property_claim_request (user_id);

CREATE INDEX IF NOT EXISTS property_claim_request_status_idx
  ON property_claim_request (status);

CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_property_idx
  ON property_claim_request (user_id, property_internal_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_property_internal_id_idx
  ON property_ownership (property_internal_id);

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_user_property_internal_id_idx
  ON property_ownership (user_id, property_internal_id);

CREATE INDEX IF NOT EXISTS property_ownership_user_id_idx
  ON property_ownership (user_id);

CREATE INDEX IF NOT EXISTS property_ownership_parcel_id_idx
  ON property_ownership (parcel_id);

CREATE INDEX IF NOT EXISTS listing_image_listing_id_status_idx
  ON listing_image (listing_id, status);

CREATE INDEX IF NOT EXISTS listing_image_cleanup_job_status_run_after_idx
  ON listing_image_cleanup_job (status, run_after);

CREATE INDEX IF NOT EXISTS valuation_submission_property_asset_id_idx
  ON valuation_submission (property_asset_id);

CREATE INDEX IF NOT EXISTS valuation_submission_submitted_by_user_id_idx
  ON valuation_submission (submitted_by_user_id);

CREATE INDEX IF NOT EXISTS valuation_submission_status_idx
  ON valuation_submission (status);

CREATE INDEX IF NOT EXISTS valuation_submission_effective_date_idx
  ON valuation_submission (effective_date DESC);

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

CREATE INDEX IF NOT EXISTS property_asset_profile_property_type_idx
  ON property_asset_profile (property_type);

CREATE OR REPLACE FUNCTION validate_property_asset_topology()
RETURNS TRIGGER AS $$
DECLARE
  parent_parcel_id TEXT;
  parent_asset_type TEXT;
BEGIN
  IF NEW.parent_asset_id IS NULL THEN
    IF NEW.asset_type IN ('apartment_unit', 'commercial_unit') THEN
      RAISE EXCEPTION 'Unit assets must reference a parent building';
    END IF;

    IF NEW.is_primary_for_parcel IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Top-level property assets must be the primary asset for the parcel';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM property_asset sibling
      WHERE sibling.parcel_id = NEW.parcel_id
        AND sibling.parent_asset_id IS NULL
        AND sibling.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one top-level property asset is allowed per parcel';
    END IF;
  ELSE
    IF NEW.asset_type NOT IN ('apartment_unit', 'commercial_unit') THEN
      RAISE EXCEPTION 'Only unit assets may reference a parent asset';
    END IF;

    IF NEW.is_primary_for_parcel IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION 'Child unit assets cannot be marked as the parcel primary asset';
    END IF;

    SELECT pa.parcel_id, pa.asset_type
    INTO parent_parcel_id, parent_asset_type
    FROM property_asset pa
    WHERE pa.id = NEW.parent_asset_id;

    IF parent_parcel_id IS NULL THEN
      RAISE EXCEPTION 'Parent property asset % does not exist', NEW.parent_asset_id;
    END IF;

    IF parent_parcel_id <> NEW.parcel_id THEN
      RAISE EXCEPTION 'Child unit assets must belong to the same parcel as their parent';
    END IF;

    IF NEW.asset_type = 'apartment_unit' AND parent_asset_type <> 'apartment_building' THEN
      RAISE EXCEPTION 'Apartment units must have an apartment building parent';
    END IF;

    IF NEW.asset_type = 'commercial_unit' AND parent_asset_type <> 'commercial_building' THEN
      RAISE EXCEPTION 'Commercial units must have a commercial building parent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS property_asset_validate_topology ON property_asset;

CREATE TRIGGER property_asset_validate_topology
BEFORE INSERT OR UPDATE OF parcel_id, parent_asset_id, asset_type, is_primary_for_parcel
ON property_asset
FOR EACH ROW
EXECUTE FUNCTION validate_property_asset_topology();

CREATE OR REPLACE FUNCTION sync_legacy_property_profile_to_asset_profile()
RETURNS TRIGGER AS $$
DECLARE
  target_asset_id TEXT;
  default_property_type TEXT;
BEGIN
  SELECT pa.id
  INTO target_asset_id
  FROM property_asset pa
  WHERE pa.parcel_id = NEW.parcel_id
  ORDER BY
    CASE WHEN pa.is_primary_for_parcel THEN 0 ELSE 1 END,
    pa.created_at ASC,
    pa.id ASC
  LIMIT 1;

  IF target_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Land'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment unit'
      WHEN 'commercial_unit' THEN 'Commercial unit'
      ELSE 'Property'
    END
  INTO default_property_type
  FROM property_asset pa
  WHERE pa.id = target_asset_id;

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
  VALUES (
    target_asset_id,
    NEW.created_by_user_id,
    NEW.description,
    COALESCE(NULLIF(BTRIM(NEW.property_type), ''), default_property_type),
    NEW.bedrooms,
    NEW.bathrooms,
    NEW.interior_area_sqm,
    NEW.year_built,
    NEW.seed_source
  )
  ON CONFLICT (property_asset_id) DO UPDATE
  SET
    created_by_user_id = COALESCE(property_asset_profile.created_by_user_id, EXCLUDED.created_by_user_id),
    description = CASE
      WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.description), ''), NULL) IS NULL THEN EXCLUDED.description
      ELSE property_asset_profile.description
    END,
    property_type = CASE
      WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.property_type), ''), NULL) IS NULL THEN EXCLUDED.property_type
      ELSE property_asset_profile.property_type
    END,
    bedrooms = COALESCE(property_asset_profile.bedrooms, EXCLUDED.bedrooms),
    bathrooms = COALESCE(property_asset_profile.bathrooms, EXCLUDED.bathrooms),
    interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
    year_built = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS property_profile_sync_asset_profile ON property_profile;

CREATE TRIGGER property_profile_sync_asset_profile
AFTER INSERT OR UPDATE ON property_profile
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_property_profile_to_asset_profile();

CREATE OR REPLACE VIEW preview_property_asset_surface_v1 AS
SELECT
  pa.id AS property_asset_id,
  pa.parcel_id,
  pa.parent_asset_id,
  pa.public_id AS property_route_id,
  pa.display_code AS property_code,
  pa.asset_type AS property_kind,
  pa.unit_label AS property_unit_label,
  pa.description AS property_description_override,
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
  pap.description AS profile_description,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
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
  END AS property_title,
  COALESCE(pa.description, pap.description) AS resolved_description
FROM property_asset pa
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = pa.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id;

CREATE OR REPLACE VIEW preview_active_listing_surface_v1 AS
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
  pas.resolved_description AS property_description,
  pas.property_type,
  pas.bedrooms,
  pas.bathrooms,
  pas.interior_area_sqm,
  pas.year_built,
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
JOIN preview_property_asset_surface_v1 pas
  ON pas.property_asset_id = l.property_asset_id
JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

COMMENT ON TABLE property_profile IS
'Legacy parcel-scoped preview property enrichment retained for compatibility while asset-scoped profile data moves to property_asset_profile.';

COMMENT ON TABLE property_asset_profile IS
'App-owned asset-scoped property enrichment keyed by property_asset_id. Stores property facts for the specific marketable asset instead of the whole parcel.';

COMMENT ON TABLE property_asset IS
'App-owned marketable real estate object keyed to a parcel. Supports one parcel having many listable units over time.';

COMMENT ON COLUMN property_asset.public_id IS
'Public-safe property identifier for asset-level routes. This is the preferred user-facing property ID.';

COMMENT ON COLUMN property_asset.unit_label IS
'Optional sub-parcel unit label for apartment and commercial units, used to build stable canonical public slugs when a parcel has multiple marketable units.';

COMMENT ON COLUMN property_asset.is_primary_for_parcel IS
'Marks the default top-level asset for a parcel so legacy parcel-first records can be backfilled safely.';

COMMENT ON COLUMN listing.parcel_id IS
'Intended to join to parcel_app_ready_seed_preview.parcel_id. Deliberately not a hard FK yet because the parcel seed table is still a working preview contract.';

COMMENT ON COLUMN listing.property_asset_id IS
'App-owned asset reference for the specific house, unit, suite, or parcel-backed asset being listed.';

COMMENT ON VIEW preview_property_asset_surface_v1 IS
'Canonical preview join surface for parcel, asset, and asset-profile facts keyed by property_asset_id.';

COMMENT ON VIEW preview_active_listing_surface_v1 IS
'Preview join surface for future browse and property queries once mock data is removed.';
