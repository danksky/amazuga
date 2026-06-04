BEGIN;

ALTER TABLE agency
ADD COLUMN IF NOT EXISTS created_from_application_id TEXT;

ALTER TABLE agency
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

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

ALTER TABLE agency_application
ADD COLUMN IF NOT EXISTS instagram_url TEXT;

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
  property_id TEXT,
  property_internal_id TEXT REFERENCES property_asset(id),
  parcel_id TEXT NOT NULL,
  upi TEXT NOT NULL,
  claim_scope TEXT NOT NULL DEFAULT 'full_parcel' CHECK (claim_scope IN ('full_parcel', 'unit_partial')),
  unit_label TEXT,
  tenure_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_type IN ('freehold', 'emphyteutic_lease', 'unspecified')),
  tenure_source TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_source IN ('user_provided', 'auto_populated', 'unspecified')),
  representative_size NUMERIC(14,2),
  zoning TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC(4,1),
  interior_area_sqm NUMERIC(14,2),
  year_built INTEGER,
  description TEXT,
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
  WHERE status = 'pending' AND property_internal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_parcel_scope_idx
  ON property_claim_request (user_id, parcel_id, claim_scope, COALESCE(unit_label, ''))
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_property_internal_id_idx
  ON property_ownership (property_internal_id);

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_user_property_internal_id_idx
  ON property_ownership (user_id, property_internal_id);

CREATE INDEX IF NOT EXISTS property_ownership_user_id_idx
  ON property_ownership (user_id);

CREATE INDEX IF NOT EXISTS property_ownership_parcel_id_idx
  ON property_ownership (parcel_id);

WITH seeded_agency_applications AS (
  SELECT *
  FROM (
    VALUES
      (
        'agency-application-1',
        'user-4',
        'Umurage Property Partners',
        '119000321',
        NULL::TEXT,
        NULL::TEXT,
        NULL::TEXT,
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
        NULL::TEXT,
        'https://www.instagram.com/kigalihomesgroup',
        'approved',
        'mock_import_listing_surface_v1',
        '2026-03-15T09:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-15T09:00:00.000Z'::TIMESTAMPTZ
      )
  ) AS t(
    id,
    created_by_user_id,
    business_name,
    tin,
    website_url,
    google_maps_url,
    instagram_url,
    status,
    seed_source,
    created_at,
    updated_at
  )
)
INSERT INTO agency_application (
  id,
  created_by_user_id,
  business_name,
  tin,
  website_url,
  google_maps_url,
  instagram_url,
  status,
  seed_source,
  created_at,
  updated_at
)
SELECT * FROM seeded_agency_applications
ON CONFLICT (id) DO UPDATE
SET
  created_by_user_id = EXCLUDED.created_by_user_id,
  business_name = EXCLUDED.business_name,
  tin = EXCLUDED.tin,
  website_url = EXCLUDED.website_url,
  google_maps_url = EXCLUDED.google_maps_url,
  instagram_url = EXCLUDED.instagram_url,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

WITH seeded_agent_applications AS (
  SELECT *
  FROM (
    VALUES
      (
        'agent-application-1',
        'user-5',
        '/placeholders/property-generic.svg',
        'agency-1',
        'approved',
        'mock_import_listing_surface_v1',
        '2026-03-16T09:00:00.000Z'::TIMESTAMPTZ,
        '2026-03-16T09:00:00.000Z'::TIMESTAMPTZ
      )
  ) AS t(
    id,
    user_id,
    national_id_photo_url,
    selected_agency_id,
    status,
    seed_source,
    created_at,
    updated_at
  )
)
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
SELECT * FROM seeded_agent_applications
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  national_id_photo_url = EXCLUDED.national_id_photo_url,
  selected_agency_id = EXCLUDED.selected_agency_id,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

WITH seeded_valuator_applications AS (
  SELECT *
  FROM (
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
  ) AS t(
    id,
    user_id,
    irpv_registration_number,
    status,
    seed_source,
    created_at,
    updated_at
  )
)
INSERT INTO valuator_application (
  id,
  user_id,
  irpv_registration_number,
  status,
  seed_source,
  created_at,
  updated_at
)
SELECT * FROM seeded_valuator_applications
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  irpv_registration_number = EXCLUDED.irpv_registration_number,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  created_at = EXCLUDED.created_at,
  updated_at = EXCLUDED.updated_at;

UPDATE agency
SET
  created_from_application_id = 'agency-application-2',
  updated_at = NOW()
WHERE id = 'agency-1';

COMMENT ON COLUMN agency.created_from_application_id IS
'Optional back-reference to the agency_application row that originated the agency.';

COMMENT ON TABLE agency_application IS
'Preview DB-backed agency registration workflow state.';

COMMENT ON TABLE agent_application IS
'Preview DB-backed agent approval workflow state.';

COMMENT ON TABLE valuator_application IS
'Preview DB-backed valuator recognition workflow state.';

COMMENT ON TABLE property_claim_request IS
'Preview DB-backed property claim workflow state.';

COMMIT;
