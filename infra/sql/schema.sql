-- =============================================================================
-- Amazuga canonical schema
-- =============================================================================
--
-- This is the single authoritative schema for the Amazuga database.
-- Apply it to a fresh database to get a fully working state.
--
-- HISTORY
--   Previously maintained as ~40 incremental preview_* migration files.
--   Flattened at the preview DB rebuild (May 2026). Migration history is
--   preserved in git for archaeology; new changes go in numbered migrations
--   (0001_description.sql, 0002_description.sql, ...).
--
-- ARCHITECTURE — TWO-LAYER MODEL
--   Parcels are the geographic and legal unit of land in Rwanda, sourced from
--   the RNRA/DLUP registry and loaded from parquet. They exist independently
--   of the app and are never created or deleted by user actions.
--
--   property_asset rows are only created on demand — when a user claims a
--   parcel, when an agent creates a listing, or via bulk import. The vast
--   majority of parcels will never have a property_asset row, and that is
--   intentional. Parcel pages render from parcel data alone when no asset
--   exists yet.
--
--   Consequence: there is deliberately no hard foreign key from property_asset
--   to the parcel tables. Parcel tables are seed artifacts (rebuilt from
--   parquet); property_asset carries parcel_id as a soft reference so that
--   rebuilding the parcel tables does not cascade-delete real app data.
--
-- DEPENDENCY ORDER
--   parcel tables (seed, no app FKs)
--   └── app_user
--       └── agency
--           └── agency_membership
--               property_asset
--               └── property_asset_profile
--                   listing
--                   └── listing_image
--                       listing_image_cleanup_job
--                       listing_price_history
--                       listing_access_grant
--               saved_property
--               agency_application
--               agent_application
--               valuator_application
--               property_claim_request
--               property_ownership
--               valuation_submission
-- =============================================================================


-- =============================================================================
-- PARCEL TABLES
-- Populated entirely from parquet via scrape-rwanda-parcels/scripts/.
-- Never written to by app logic. Rebuilt from scratch on each parcel reload.
-- =============================================================================

-- Primary parcel dataset. Schema is inferred from the parquet at load time
-- (see scrape-rwanda-parcels/scripts/load_parcels_to_postgres.py), so the
-- actual table may have additional pipeline columns beyond those listed here.
-- The app only reads the columns defined below; all others are pipeline
-- metadata and can be ignored.
CREATE TABLE IF NOT EXISTS parcel_app_ready_seed_preview (
  -- Stable opaque internal identifier, consistent across reloads for the same
  -- real-world parcel. Used as the join key to property_asset and listing.
  parcel_id                TEXT,
  -- Public-safe parcel identifier used in URLs and map tile features.
  -- Falls back to this when no property_asset exists for the parcel.
  public_id                TEXT,
  -- Rwanda Parcel Identifier — the official RNRA registry string.
  -- Provided by the user at claim time to verify ownership.
  upi                      TEXT,
  province                 TEXT,
  district                 TEXT,
  sector                   TEXT,
  cell                     TEXT,
  village                  TEXT,
  -- Parcel area in square metres as stored in the source registry.
  representative_size      DOUBLE PRECISION,
  centroid_lon             DOUBLE PRECISION,
  centroid_lat             DOUBLE PRECISION,
  bbox_min_lon             DOUBLE PRECISION,
  bbox_min_lat             DOUBLE PRECISION,
  bbox_max_lon             DOUBLE PRECISION,
  bbox_max_lat             DOUBLE PRECISION,
  -- Zoning classification from the District Land Use Plan (DLUP).
  -- Not available for all districts; may be null. Not used as a filter
  -- for app-ready status — too many legitimate parcels lack zoning data.
  zoning                   TEXT,
  zone_code                TEXT,
  gen_lu                   TEXT,
  -- 'approved' or 'provisional' = app-ready (shown on map, claimable).
  -- Other values = blocked from the app surface.
  inventory_status         TEXT
  -- Additional parquet pipeline columns exist in the live table
  -- (e.g. dlup_match_status, is_listing_candidate, zoning flags).
  -- The app does not query them; they are pipeline diagnostics.
);

COMMENT ON TABLE parcel_app_ready_seed_preview IS
'Rwanda land registry parcel dataset loaded from parcel-app-ready.parquet.
Schema is inferred at load time; only app-relevant columns are declared here.
Rebuilt from scratch on each parcel reload — do not add app-owned data to this table.';

COMMENT ON COLUMN parcel_app_ready_seed_preview.parcel_id IS
'Opaque internal parcel identifier. Stable across reloads for the same real-world parcel.
Used as the soft join key to property_asset.parcel_id and listing.parcel_id.
No hard FK is defined from those tables to here — parcel tables are rebuilt from parquet,
and a FK would cascade-delete real app data on reload.';

COMMENT ON COLUMN parcel_app_ready_seed_preview.upi IS
'Official Rwanda Parcel Identifier from the RNRA registry.
Provided by the user when claiming a parcel to verify they own the underlying land title.';

COMMENT ON COLUMN parcel_app_ready_seed_preview.inventory_status IS
'App-readiness flag derived from the parcel processing pipeline.
Only approved and provisional parcels are shown on the public browse map and are claimable.
Zoning is NOT used as a filter — too many legitimate parcels lack DLUP zoning data.';

CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_upi_normalized_idx
  ON parcel_app_ready_seed_preview ((UPPER(REPLACE(upi, ' ', ''))));

-- Human-readable parcel label derived from the UPI parcel number, cell, and sector.
-- Format: "782 Bibare, Kimironko" — parcel number leads, cell and sector follow.
-- Agents report that buyers navigate by sector/cell, not village (June 2026).
-- Using a function rather than a stored column means the format can be changed
-- in one place; no stored data to reformat across 10M+ rows.
CREATE OR REPLACE FUNCTION parcel_label(upi TEXT, cell TEXT, sector TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN upi IS NOT NULL AND cell IS NOT NULL AND sector IS NOT NULL
    THEN split_part(upi, '/', 5) || ' ' || cell || ', ' || sector
    ELSE NULL
  END
$$;


-- Per-parcel anchor point for map rendering. A point-on-surface (not centroid)
-- is used so the dot always falls visually inside the parcel polygon.
CREATE TABLE IF NOT EXISTS parcel_anchor_point_preview (
  parcel_id    TEXT PRIMARY KEY,
  public_id    TEXT NOT NULL,
  upi          TEXT NOT NULL,
  -- 'point_on_surface' is preferred; 'centroid_fallback' is used when the
  -- geometry library cannot guarantee an interior point (rare edge cases).
  anchor_source TEXT NOT NULL CHECK (anchor_source IN ('point_on_surface', 'centroid_fallback')),
  anchor_lon   DOUBLE PRECISION NOT NULL,
  anchor_lat   DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION,
  centroid_lat DOUBLE PRECISION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parcel_anchor_point_preview IS
'Interior anchor points for parcel map dots. Loaded from parcel-anchor-points.parquet.
Uses point-on-surface geometry so dots always render inside the parcel polygon.
Also used by build-off-market-pmtiles.sh to bake route_id into the gray dot tile features.';

CREATE UNIQUE INDEX IF NOT EXISTS parcel_anchor_point_preview_public_id_idx
  ON parcel_anchor_point_preview (public_id);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_anchor_point_preview_upi_idx
  ON parcel_anchor_point_preview (upi);


-- Representative centroid points for Rwanda administrative villages.
-- Loaded from NISR boundary polygon data. Used as map anchor for direct
-- (no-parcel) listings and for reverse-geocoding user-dropped pins to their
-- containing village. Primary key is the full hierarchy because village names
-- are not globally unique across Rwanda.
CREATE TABLE IF NOT EXISTS admin_village_centroid (
  district_name  TEXT NOT NULL,
  sector_name    TEXT NOT NULL,
  cell_name      TEXT NOT NULL,
  village_name   TEXT NOT NULL,
  centroid_lat   DOUBLE PRECISION NOT NULL,
  centroid_lon   DOUBLE PRECISION NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (district_name, sector_name, cell_name, village_name)
);

CREATE INDEX IF NOT EXISTS admin_village_centroid_village_idx
  ON admin_village_centroid (village_name);

CREATE INDEX IF NOT EXISTS admin_village_centroid_sector_idx
  ON admin_village_centroid (district_name, sector_name);


-- =============================================================================
-- APP TABLES
-- Written to by app logic. Persist across parcel reloads.
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_user (
  -- UUID primary key matching auth.users.id in Supabase.
  -- Created from the Supabase auth UUID on first OTP sign-in.
  id                        UUID PRIMARY KEY,
  -- Nullable: phone-only OTP users may not have an email.
  email                     TEXT UNIQUE,
  full_name                 TEXT NOT NULL,
  -- Phone number in E.164 format (+250...).
  phone                     TEXT UNIQUE,
  -- 'user' is the default. Admins and valuators are promoted by role.
  roles                     TEXT[] NOT NULL DEFAULT ARRAY['user']::TEXT[],
  avatar_url                TEXT,
  -- Development/demo only. Identifies a named test persona (e.g. "agent_alice").
  -- Null in production.
  mock_persona_label        TEXT,
  mock_persona_description  TEXT,
  -- Rate-limiting counter for UPI lookups. Reset daily by a cron job.
  upi_lookup_count_today    INTEGER NOT NULL DEFAULT 0 CHECK (upi_lookup_count_today >= 0),
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  -- See seed_source note on property_asset below.
  seed_source               TEXT NOT NULL DEFAULT 'manual',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_sms_attempt (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                TEXT NOT NULL DEFAULT 'unknown'
                               CHECK (environment IN ('production', 'preview', 'development', 'unknown')),
  provider                   TEXT NOT NULL CHECK (provider IN ('africas_talking', 'telnyx')),
  purpose                    TEXT NOT NULL DEFAULT 'otp',
  phone_e164                 TEXT NOT NULL,
  phone_masked               TEXT NOT NULL,
  otp_fingerprint            TEXT,
  correlation_id             TEXT NOT NULL UNIQUE,
  provider_message_id        TEXT,
  initial_status             TEXT,
  initial_status_code        TEXT,
  delivery_status            TEXT,
  delivery_status_code       TEXT,
  delivery_error_code        TEXT,
  delivery_error_detail      TEXT,
  delivery_event_type        TEXT,
  provider_request_payload   JSONB NOT NULL DEFAULT '{}'::JSONB,
  provider_response_payload  JSONB NOT NULL DEFAULT '{}'::JSONB,
  delivery_payload           JSONB NOT NULL DEFAULT '{}'::JSONB,
  sent_at                    TIMESTAMPTZ,
  delivered_at               TIMESTAMPTZ,
  failed_at                  TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sms_attempt_provider_message_id_idx
  ON auth_sms_attempt (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_sms_attempt_phone_created_at_idx
  ON auth_sms_attempt (phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_sms_attempt_created_at_idx
  ON auth_sms_attempt (created_at DESC);

COMMENT ON TABLE auth_sms_attempt IS
'Provider-neutral audit trail for OTP SMS send attempts and delivery receipts.';


CREATE TABLE IF NOT EXISTS agency (
  id                          TEXT PRIMARY KEY,
  slug                        TEXT NOT NULL UNIQUE,
  -- Traces back to the agency_application that was approved to create this row.
  created_from_application_id TEXT,
  business_name               TEXT NOT NULL,
  -- Rwanda Tax Identification Number. Required for agency registration.
  tin                         TEXT NOT NULL,
  whatsapp_phone              TEXT,
  website_url                 TEXT,
  google_maps_url             TEXT,
  instagram_url               TEXT,
  status                      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  -- Temporary reference during the approval workflow before manager_user_id is set.
  pending_manager_user_id     UUID REFERENCES app_user(id),
  manager_user_id             UUID REFERENCES app_user(id),
  seed_source                 TEXT NOT NULL DEFAULT 'manual',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS agency_membership (
  id         TEXT PRIMARY KEY,
  agency_id  TEXT NOT NULL REFERENCES agency(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  -- 'manager' has admin rights within the agency; 'agent' can create listings.
  role       TEXT NOT NULL CHECK (role IN ('agent', 'manager')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency_id, user_id, role)
);


-- =============================================================================
-- PROPERTY ASSET
--
-- A property_asset row is the app's representation of a real-world property.
-- It is only created when someone actively manages the parcel:
--   - A user claims a parcel (created on claim approval)
--   - An agent creates a listing (created inline)
--   - A bulk import supplies the data
--
-- One parcel can have multiple property_asset rows over time to support
-- multi-unit buildings (apartment_building + apartment_unit children) and
-- successive ownership changes.
--
-- The topology is enforced by the validate_property_asset_topology trigger:
--   - Exactly one top-level (parent_asset_id IS NULL) asset per parcel,
--     flagged is_primary_for_parcel = TRUE.
--   - Unit assets (apartment_unit, commercial_unit) must reference a
--     parent building asset on the same parcel.
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_asset (
  id               TEXT PRIMARY KEY,
  -- Soft reference to parcel_app_ready_seed_preview.parcel_id.
  -- NULL for direct (no-UPI) listings. No hard FK — parcel tables are rebuilt
  -- from parquet; a FK would cascade-delete real property data on reload.
  parcel_id        TEXT,
  -- Non-null only for unit assets (apartment_unit, commercial_unit).
  -- References the parent building asset on the same parcel.
  parent_asset_id  TEXT REFERENCES property_asset(id) ON DELETE CASCADE,
  asset_type       TEXT NOT NULL CHECK (
    asset_type IN (
      'house',
      'land',
      'apartment_building',
      'commercial_building',
      'apartment_unit',
      'commercial_unit'
    )
  ),
  -- Stable public-facing property identifier used in URLs and map features.
  -- For top-level assets this is the preferred user-facing property ID.
  -- Parcel pages also resolve via parcel.public_id when no asset exists.
  public_id        TEXT NOT NULL UNIQUE,
  display_code     TEXT NOT NULL UNIQUE,
  -- Optional sub-parcel label for unit assets (e.g. "Unit 4B").
  -- Used to build stable canonical slugs when a parcel has multiple
  -- marketable units.
  unit_label       TEXT,
  description      TEXT,
  -- TRUE for the single canonical top-level asset for a parcel.
  -- Enforced by partial unique index (parcel_id IS NOT NULL only).
  -- Allows parcel-first lookups to resolve to the correct asset without
  -- scanning all children.
  is_primary_for_parcel BOOLEAN NOT NULL DEFAULT FALSE,
  -- Location columns — populated for all assets regardless of path.
  -- For parcel-linked assets, denormalized from parcel at claim approval.
  -- For direct listings, supplied by user or derived from pin reverse-geocode.
  location_source  TEXT CHECK (location_source IN ('parcel', 'admin_unit', 'pin_derived')),
  display_name     TEXT,   -- used in all UI title expressions
  admin_district   TEXT,
  admin_sector     TEXT,
  admin_cell       TEXT,
  admin_village    TEXT,
  anchor_lat       DOUBLE PRECISION,  -- map pin; parcel anchor or village centroid
  anchor_lon       DOUBLE PRECISION,
  private_pin_lat  DOUBLE PRECISION,  -- raw dropped pin — never exposed publicly
  private_pin_lon  DOUBLE PRECISION,
  -- Tracks the origin of this row. Values used in app query filters:
  --   'manual'                        real user / agent action
  --   'claim_approval_v1'             created by admin approving a claim
  --   'preview_property_page_*'       dev seed data — excluded from prod queries
  --   'mock_import_listing_surface_*' dev seed data — excluded from prod queries
  seed_source      TEXT NOT NULL DEFAULT 'manual',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_asset IS
'App-owned marketable real estate object keyed to a parcel.
Created on demand (claim approval, listing creation, bulk import) — never pre-populated
from the parcel set. One parcel can have multiple assets to support multi-unit buildings.';

COMMENT ON COLUMN property_asset.parcel_id IS
'Soft reference to parcel_app_ready_seed_preview.parcel_id. No hard FK by design:
parcel tables are rebuilt from parquet on each reload, and a FK would cascade-delete
real property_asset rows. The app resolves the parcel at query time via a LEFT JOIN.';

COMMENT ON COLUMN property_asset.is_primary_for_parcel IS
'Marks the canonical top-level asset for a parcel. Enforced by partial unique index.
Allows parcel-first URL routes (/property/{parcel_public_id}) to resolve to the right
asset without scanning all children. Only one primary asset per parcel is allowed.';

COMMENT ON COLUMN property_asset.seed_source IS
'Tracks the origin of this row. Preview/mock seed values are excluded from production
queries using NOT IN filters. Real origins: manual, claim_approval_v1.';

-- NULL parcel_id rows (direct listings) are excluded — no uniqueness constraint
-- applies across direct listings since they have no parcel to collide on.
CREATE UNIQUE INDEX IF NOT EXISTS property_asset_one_primary_per_parcel_idx
  ON property_asset (parcel_id)
  WHERE is_primary_for_parcel AND parcel_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_asset_parcel_id_idx
  ON property_asset (parcel_id);

CREATE INDEX IF NOT EXISTS property_asset_parent_asset_id_idx
  ON property_asset (parent_asset_id);

CREATE INDEX IF NOT EXISTS property_asset_asset_type_idx
  ON property_asset (asset_type);


-- Physical facts about a property_asset. Kept in a separate table from
-- property_asset so that the asset identity row (ownership, FKs, stable IDs)
-- can be created before all physical facts are known, and to avoid bloating
-- the ownership/claim FK chain with mutable enrichment data.
CREATE TABLE IF NOT EXISTS property_asset_profile (
  -- 1-to-1 with property_asset. Cascade-deleted when the asset is deleted.
  property_asset_id   TEXT PRIMARY KEY REFERENCES property_asset(id) ON DELETE CASCADE,
  created_by_user_id  UUID REFERENCES app_user(id),
  description         TEXT,
  -- Human-readable property type label (e.g. "House", "Land"). Must not be
  -- the bare string "building" — use apartment_building or commercial_building.
  property_type       TEXT NOT NULL CHECK (LOWER(BTRIM(property_type)) <> 'building'),
  bedrooms            INTEGER,
  bathrooms           NUMERIC(4, 1),
  interior_area_sqm   NUMERIC(12, 2),
  year_built          INTEGER,
  seed_source         TEXT NOT NULL DEFAULT 'manual',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_asset_profile IS
'Physical facts for a property_asset (bedrooms, area, type, etc.).
Separated from property_asset so the identity row can exist before facts are known,
and to avoid coupling mutable enrichment data to the ownership/FK chain.';

CREATE INDEX IF NOT EXISTS property_asset_profile_property_type_idx
  ON property_asset_profile (property_type);


-- =============================================================================
-- LISTING
--
-- A listing is an active market advertisement for a property_asset.
-- One property_asset can only have one active listing at a time (partial unique
-- index). Status lifecycle: draft → active → inactive / archived.
--
-- Visibility controls discoverability:
--   public   → appears on browse map and search results
--   unlisted → hidden from browse; accessible via direct property page link
--   private  → hidden everywhere; accessible only to the listing agent and
--              users with an explicit listing_access_grant row
--
-- listing carries both parcel_id (for efficient map bbox queries that don't
-- need to join through property_asset) and property_asset_id (the canonical
-- asset reference for listing details and ownership queries).
-- =============================================================================

CREATE TABLE IF NOT EXISTS listing (
  id                  TEXT PRIMARY KEY,
  -- Soft reference to parcel_app_ready_seed_preview.parcel_id.
  -- Duplicated here from property_asset so map bbox queries can filter on
  -- parcel location without a join through property_asset.
  -- NULL for direct (no-UPI) listings.
  parcel_id           TEXT,
  property_asset_id   TEXT NOT NULL REFERENCES property_asset(id),
  agency_id           TEXT REFERENCES agency(id),
  agent_user_id       UUID NOT NULL REFERENCES app_user(id),
  status              TEXT NOT NULL CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  marketing_type      TEXT NOT NULL CHECK (marketing_type IN ('sale', 'rent')),
  -- Nullable: draft listings and some rent listings may not have a price yet.
  asking_price_rwf    BIGINT CHECK (asking_price_rwf IS NULL OR asking_price_rwf > 0),
  currency            TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
  -- Visibility controls browse map and search discoverability. See table comment.
  visibility          TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  -- Monotonically increasing counter per asset. Incremented each time a listing
  -- is re-activated after being inactive/archived, so price history rows from
  -- different campaigns can be distinguished.
  campaign_index      INTEGER NOT NULL DEFAULT 1,
  description         TEXT,
  seed_source         TEXT NOT NULL DEFAULT 'manual',
  published_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE listing IS
'Active market advertisement for a property_asset. One active listing per asset
at a time (enforced by partial unique index). Status: draft → active → inactive/archived.
Visibility: public (browse map), unlisted (direct link only), private (access grant required).';

COMMENT ON COLUMN listing.parcel_id IS
'Soft reference to parcel_app_ready_seed_preview.parcel_id. Deliberately duplicated
from property_asset so browse map bbox queries can filter on parcel location without
joining through property_asset. No hard FK for the same reason as property_asset.parcel_id.';

COMMENT ON COLUMN listing.campaign_index IS
'Monotonically increasing counter per asset. Incremented when a listing is re-activated
after being inactive or archived. Allows listing_price_history rows from separate
listing campaigns to be grouped and distinguished.';

-- Only one active listing per asset at a time.
CREATE UNIQUE INDEX IF NOT EXISTS listing_one_active_per_asset_idx
  ON listing (property_asset_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS listing_status_marketing_type_idx
  ON listing (status, marketing_type);

CREATE INDEX IF NOT EXISTS listing_visibility_idx
  ON listing (visibility);

CREATE INDEX IF NOT EXISTS listing_parcel_id_idx
  ON listing (parcel_id);

CREATE INDEX IF NOT EXISTS listing_property_asset_id_idx
  ON listing (property_asset_id);

CREATE INDEX IF NOT EXISTS listing_agency_id_idx
  ON listing (agency_id);

CREATE INDEX IF NOT EXISTS listing_agent_user_id_idx
  ON listing (agent_user_id);


CREATE TABLE IF NOT EXISTS listing_image (
  id                   TEXT PRIMARY KEY,
  listing_id           TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  sort_order           INTEGER NOT NULL CHECK (sort_order >= 0),
  image_url            TEXT NOT NULL,
  storage_key          TEXT,
  content_type         TEXT,
  width                INTEGER,
  height               INTEGER,
  file_size_bytes      INTEGER,
  uploaded_by_user_id  UUID REFERENCES app_user(id),
  -- 'pending_delete' / 'delete_failed' are set by the cleanup job when the
  -- R2 object needs to be removed but the deletion has not yet succeeded.
  status               TEXT NOT NULL DEFAULT 'ready' CHECK (
    status IN ('ready', 'processing', 'failed', 'pending_delete', 'delete_failed')
  ),
  alt_text             TEXT,
  seed_source          TEXT NOT NULL DEFAULT 'manual',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, sort_order)
);

CREATE INDEX IF NOT EXISTS listing_image_listing_id_status_idx
  ON listing_image (listing_id, status);


-- Async queue for deleting orphaned R2 objects after listing images are removed.
-- A row is enqueued when a listing_image is deleted or replaced; a background
-- job processes it and marks it completed or failed.
CREATE TABLE IF NOT EXISTS listing_image_cleanup_job (
  id                   TEXT PRIMARY KEY,
  image_id             TEXT NOT NULL,
  listing_id           TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  storage_key          TEXT NOT NULL UNIQUE,
  uploaded_by_user_id  UUID REFERENCES app_user(id),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'failed', 'completed')
  ),
  attempt_count        INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error           TEXT,
  run_after            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at            TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_image_cleanup_job_status_run_after_idx
  ON listing_image_cleanup_job (status, run_after);


-- Append-only price history for listings. A row is inserted at listing
-- creation (opening price) and whenever asking_price_rwf changes on an
-- active listing. Never updated or deleted.
CREATE TABLE IF NOT EXISTS listing_price_history (
  id                  TEXT PRIMARY KEY,
  listing_id          TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  price_rwf           BIGINT NOT NULL CHECK (price_rwf > 0),
  -- campaign_index copied from the listing at the time of the price change,
  -- allowing price history to be grouped per listing campaign.
  campaign_index      INTEGER NOT NULL DEFAULT 1,
  changed_by_user_id  UUID REFERENCES app_user(id),
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS listing_price_history_listing_idx
  ON listing_price_history (listing_id, changed_at DESC);


-- Per-listing access grants for private visibility listings.
-- When a listing's visibility = 'private', only the listing agent and users
-- with a row here can view the listing on the property page.
CREATE TABLE IF NOT EXISTS listing_access_grant (
  id                  TEXT PRIMARY KEY,
  listing_id          TEXT NOT NULL REFERENCES listing(id) ON DELETE CASCADE,
  granted_to_user_id  UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  granted_by_user_id  UUID NOT NULL REFERENCES app_user(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, granted_to_user_id)
);

CREATE INDEX IF NOT EXISTS listing_access_grant_listing_idx
  ON listing_access_grant (listing_id);

CREATE INDEX IF NOT EXISTS listing_access_grant_user_idx
  ON listing_access_grant (granted_to_user_id);


-- User-saved properties. property_route_id is the public_id of either a
-- parcel (when no asset exists) or a property_asset. legacy_property_ref
-- is kept for rows saved before the asset model was introduced.
CREATE TABLE IF NOT EXISTS saved_property (
  id                  TEXT PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  property_route_id   TEXT,
  legacy_property_ref TEXT,
  seed_source         TEXT NOT NULL DEFAULT 'manual',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_route_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS saved_property_user_id_idx
  ON saved_property (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_route_id_idx
  ON saved_property (user_id, property_route_id)
  WHERE property_route_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS saved_property_user_legacy_ref_idx
  ON saved_property (user_id, legacy_property_ref)
  WHERE legacy_property_ref IS NOT NULL;


-- =============================================================================
-- APPLICATION WORKFLOWS
-- Agency, agent, and valuator onboarding applications.
-- =============================================================================

CREATE TABLE IF NOT EXISTS agency_application (
  id                   TEXT PRIMARY KEY,
  created_by_user_id   UUID NOT NULL REFERENCES app_user(id),
  business_name        TEXT NOT NULL,
  tin                  TEXT NOT NULL,
  website_url          TEXT,
  google_maps_url      TEXT,
  instagram_url        TEXT,
  status               TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source          TEXT NOT NULL DEFAULT 'manual',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agency_application_created_by_user_id_idx
  ON agency_application (created_by_user_id);

CREATE INDEX IF NOT EXISTS agency_application_status_idx
  ON agency_application (status);


CREATE TABLE IF NOT EXISTS agent_application (
  id                     TEXT PRIMARY KEY,
  user_id                UUID NOT NULL REFERENCES app_user(id),
  national_id_photo_url  TEXT NOT NULL,
  selected_agency_id     TEXT REFERENCES agency(id),
  status                 TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source            TEXT NOT NULL DEFAULT 'manual',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_application_user_id_idx
  ON agent_application (user_id);

CREATE INDEX IF NOT EXISTS agent_application_status_idx
  ON agent_application (status);


CREATE TABLE IF NOT EXISTS valuator_application (
  id                       TEXT PRIMARY KEY,
  user_id                  UUID NOT NULL REFERENCES app_user(id),
  -- Rwanda Institute of Professional Valuers registration number.
  irpv_registration_number TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source              TEXT NOT NULL DEFAULT 'manual',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS valuator_application_user_id_idx
  ON valuator_application (user_id);

CREATE INDEX IF NOT EXISTS valuator_application_status_idx
  ON valuator_application (status);


-- =============================================================================
-- CLAIM AND OWNERSHIP
--
-- WORKFLOW:
--   1. User submits a claim request (property_claim_request, status=pending).
--      No property_asset is created yet — pending claims are lightweight.
--   2. Admin approves:
--      a. A property_asset row is created (if one doesn't exist for the parcel).
--      b. A property_ownership row is created linking user → property_asset.
--      c. The claim request is updated with property_internal_id.
--   3. Transfers reuse the same table with request_kind='transfer', adding
--      transfer_from_user_id and the buyer confirmation timestamps.
--
-- This two-phase design means the DB does not accumulate orphan property_asset
-- rows from claims that are never approved or are denied.
-- =============================================================================

CREATE TABLE IF NOT EXISTS property_claim_request (
  id                          TEXT PRIMARY KEY,
  user_id                     UUID NOT NULL REFERENCES app_user(id),
  -- 'claim'    = new ownership claim on an unclaimed parcel
  -- 'transfer' = ownership transfer from an existing owner to this user
  request_kind                TEXT NOT NULL DEFAULT 'claim' CHECK (request_kind IN ('claim', 'transfer')),
  -- Set once the claim is approved and a property_asset row is created.
  -- Null while the claim is pending or denied.
  property_id                 TEXT,
  property_internal_id        TEXT REFERENCES property_asset(id),
  -- Soft reference to parcel_app_ready_seed_preview.parcel_id.
  parcel_id                   TEXT NOT NULL,
  -- The official RNRA UPI provided by the claimant to prove land title.
  upi                         TEXT NOT NULL,
  -- 'full_parcel' = claiming the entire parcel as one property
  -- 'unit_partial' = claiming a specific unit within a multi-unit parcel
  claim_scope                 TEXT NOT NULL DEFAULT 'full_parcel' CHECK (
    claim_scope IN ('full_parcel', 'unit_partial')
  ),
  unit_label                  TEXT,
  -- Property type declared by the user at claim time. Becomes the seed for
  -- the property_asset_profile on approval.
  declared_property_type      TEXT CHECK (declared_property_type IN (
    'house', 'apartment_building', 'land', 'apartment_unit',
    'commercial_building', 'commercial_unit'
  )),
  declared_asset_type         TEXT CHECK (declared_asset_type IN (
    'house', 'land', 'apartment_building', 'commercial_building',
    'apartment_unit', 'commercial_unit'
  )),
  -- Land tenure type declared by the user. Rwanda has freehold and emphyteutic
  -- (long-term lease) tenure. 'unspecified' when not yet determined.
  tenure_type                 TEXT NOT NULL DEFAULT 'unspecified' CHECK (
    tenure_type IN ('freehold', 'emphyteutic_lease', 'unspecified')
  ),
  tenure_source               TEXT NOT NULL DEFAULT 'unspecified' CHECK (
    tenure_source IN ('user_provided', 'auto_populated', 'unspecified')
  ),
  -- Physical facts snapshotted from the parcel at claim time, used to seed
  -- the property_asset_profile on approval.
  representative_size         NUMERIC(14, 2),
  zoning                      TEXT,
  bedrooms                    INTEGER,
  bathrooms                   NUMERIC(4, 1),
  interior_area_sqm           NUMERIC(14, 2),
  year_built                  INTEGER,
  description                 TEXT,
  -- Transfer-specific fields (null for request_kind = 'claim').
  transfer_mode               TEXT CHECK (transfer_mode IN ('sale', 'transfer')),
  transfer_from_user_id       UUID REFERENCES app_user(id),
  transfer_initiated_by_user_id UUID REFERENCES app_user(id),
  buyer_confirmed_at          TIMESTAMPTZ,
  buyer_declined_at           TIMESTAMPTZ,
  transfer_note               TEXT,
  status                      TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source                 TEXT NOT NULL DEFAULT 'manual',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_claim_request IS
'Two-phase claim/transfer workflow. A pending request creates no property_asset row —
the asset is only created on admin approval. This avoids orphan asset rows from
denied or abandoned claims. Transfer requests reuse the same table with request_kind=transfer.';

CREATE INDEX IF NOT EXISTS property_claim_request_user_id_idx
  ON property_claim_request (user_id);

CREATE INDEX IF NOT EXISTS property_claim_request_status_idx
  ON property_claim_request (status);

CREATE INDEX IF NOT EXISTS property_claim_request_request_kind_idx
  ON property_claim_request (request_kind);

-- One pending claim per user per property_asset.
CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_property_idx
  ON property_claim_request (user_id, property_internal_id)
  WHERE status = 'pending';

-- One pending claim per user per parcel+scope (covers the case where no
-- property_asset exists yet at claim submission time).
CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_parcel_scope_idx
  ON property_claim_request (user_id, parcel_id, claim_scope)
  WHERE status = 'pending';


-- Records confirmed ownership of a property_asset by a user.
-- Created from an approved property_claim_request.
-- One owner per property_asset at a time (enforced by unique index).
CREATE TABLE IF NOT EXISTS property_ownership (
  id                           TEXT PRIMARY KEY,
  user_id                      UUID NOT NULL REFERENCES app_user(id),
  -- Stable public property ID at the time of ownership creation.
  property_id                  TEXT NOT NULL,
  property_internal_id         TEXT NOT NULL REFERENCES property_asset(id),
  -- Soft reference to parcel_app_ready_seed_preview.parcel_id.
  -- NULL for direct (no-UPI) listings where no parcel was claimed.
  parcel_id                    TEXT,
  -- 'full' = owns the entire parcel; 'unit' = owns a specific unit within it.
  ownership_scope              TEXT NOT NULL CHECK (ownership_scope IN ('full', 'unit')),
  created_from_claim_request_id TEXT REFERENCES property_claim_request(id),
  seed_source                  TEXT NOT NULL DEFAULT 'manual',
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE property_ownership IS
'Confirmed ownership of a property_asset. Created from an approved claim request.
One owner per property_asset enforced by unique index — ownership transfer
replaces the existing row via a new claim request with request_kind=transfer.';

-- One owner per property_asset.
CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_property_internal_id_idx
  ON property_ownership (property_internal_id);

CREATE UNIQUE INDEX IF NOT EXISTS property_ownership_user_property_internal_id_idx
  ON property_ownership (user_id, property_internal_id);

CREATE INDEX IF NOT EXISTS property_ownership_user_id_idx
  ON property_ownership (user_id);

CREATE INDEX IF NOT EXISTS property_ownership_parcel_id_idx
  ON property_ownership (parcel_id);


-- =============================================================================
-- VALUATIONS
-- =============================================================================

-- Professional valuation submissions. Submitted by approved valuators,
-- reviewed and approved by admins before surfacing on property pages.
CREATE TABLE IF NOT EXISTS valuation_submission (
  id                     TEXT PRIMARY KEY,
  -- Prefer property_asset_id. property_id and legacy_property_ref are
  -- retained for rows created before the asset model was introduced.
  property_id            TEXT,
  property_asset_id      TEXT REFERENCES property_asset(id),
  legacy_property_ref    TEXT,
  submitted_by_user_id   UUID NOT NULL REFERENCES app_user(id),
  is_anonymous           BOOLEAN NOT NULL DEFAULT FALSE,
  effective_date         DATE NOT NULL,
  estimated_value_rwf    BIGINT NOT NULL CHECK (estimated_value_rwf > 0),
  currency               TEXT NOT NULL DEFAULT 'RWF' CHECK (currency = 'RWF'),
  status                 TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  seed_source            TEXT NOT NULL DEFAULT 'manual',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (property_asset_id IS NOT NULL OR legacy_property_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS valuation_submission_property_asset_id_idx
  ON valuation_submission (property_asset_id);

CREATE INDEX IF NOT EXISTS valuation_submission_submitted_by_user_id_idx
  ON valuation_submission (submitted_by_user_id);

CREATE INDEX IF NOT EXISTS valuation_submission_status_idx
  ON valuation_submission (status);

CREATE INDEX IF NOT EXISTS valuation_submission_effective_date_idx
  ON valuation_submission (effective_date DESC);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Enforces the property_asset topology rules:
--   - Top-level assets (no parent): must be primary for parcel; only one per parcel.
--   - Unit assets (apartment_unit, commercial_unit): must have a parent building
--     of the matching type on the same parcel; cannot be primary for parcel.
CREATE OR REPLACE FUNCTION validate_property_asset_topology()
RETURNS TRIGGER AS $$
DECLARE
  parent_parcel_id TEXT;
  parent_asset_type TEXT;
BEGIN
  -- Direct listings have no parcel; parcel topology rules do not apply.
  IF NEW.parcel_id IS NULL THEN
    RETURN NEW;
  END IF;

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


-- =============================================================================
-- VIEWS
--
-- These are plain (non-materialized) views — they auto-reflect the current
-- table state and add zero storage overhead. Not cached; computed on each query.
-- The app queries the base tables directly for performance-critical paths
-- and uses these views for convenience joins in less frequent reads.
-- =============================================================================

-- Canonical join surface: parcel + asset + asset profile facts.
-- The preferred way to get full property context for a known property_asset_id.
CREATE OR REPLACE VIEW property_asset_surface AS
SELECT
  pa.id                               AS property_asset_id,
  pa.parcel_id,
  pa.parent_asset_id,
  pa.public_id                        AS property_route_id,
  pa.display_code                     AS property_code,
  pa.asset_type                       AS property_kind,
  pa.unit_label                       AS property_unit_label,
  pa.description                      AS property_description_override,
  pa.is_primary_for_parcel,
  pa.location_source,
  pa.display_name,
  pa.admin_district,
  pa.admin_sector,
  pa.admin_cell,
  pa.admin_village,
  pa.anchor_lat,
  pa.anchor_lon,
  -- parcel-specific fields — NULL for direct listings
  p.public_id                         AS parcel_public_id,
  parcel_label(p.upi, p.cell, p.sector) AS parcel_display_id,
  p.upi,
  COALESCE(pa.admin_district, p.district)   AS district,
  COALESCE(pa.admin_sector,   p.sector)     AS sector,
  COALESCE(pa.admin_cell,     p.cell)       AS cell,
  COALESCE(pa.admin_village,  p.village)    AS village,
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
  pap.description                     AS profile_description,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house'               THEN 'House'
      WHEN 'land'                THEN 'Land'
      WHEN 'apartment_building'  THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit'      THEN 'Apartment unit'
      WHEN 'commercial_unit'     THEN 'Commercial unit'
      ELSE 'Property'
    END
  )                                   AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  pap.year_built,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(parcel_label(p.upi, p.cell, p.sector), pa.display_name, pa.public_id), ' · ', pa.unit_label)
    ELSE COALESCE(parcel_label(p.upi, p.cell, p.sector), pa.display_name, pa.public_id)
  END                                 AS property_title,
  COALESCE(pa.description, pap.description) AS resolved_description
FROM property_asset pa
LEFT JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = pa.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id;

COMMENT ON VIEW property_asset_surface IS
'Canonical join surface for parcel + asset + profile facts keyed by property_asset_id.
Use for property detail pages and admin views. For browse map performance, query base tables directly.';


-- Active public listing surface for browse and property page queries.
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

COMMENT ON VIEW active_listing_surface IS
'Full join surface for active listings with parcel, asset, agency, and agent context.
Includes all visibility values (public, unlisted, private) — callers must filter by
visibility as appropriate for the request context.';


-- Browse map data surface: active public listing pins and cards.
-- One row per active public listing. Includes anchor point for map placement.
-- For performance, the app queries this pattern inline with a bbox filter
-- rather than through this view — kept here for reference and ad-hoc queries.
CREATE OR REPLACE VIEW public_active_listing_map_surface AS
SELECT
  l.id                                AS listing_id,
  pa.parcel_id,
  p.public_id                         AS parcel_public_id,
  pa.id                               AS asset_id,
  pa.public_id                        AS asset_public_id,
  pa.unit_label                       AS asset_unit_label,
  pa.public_id                        AS route_id,
  pa.location_source,
  pa.display_name,
  pa.anchor_lon,
  pa.anchor_lat,
  pa.admin_district                   AS district,
  pa.admin_sector                     AS sector,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.published_at,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house'               THEN 'House'
      WHEN 'land'                THEN 'Land'
      WHEN 'apartment_building'  THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit'      THEN 'Apartment Unit'
      WHEN 'commercial_unit'     THEN 'Commercial Unit'
      ELSE NULL
    END
  )                                   AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  (
    SELECT li.image_url
    FROM listing_image li
    WHERE li.listing_id = l.id
      AND li.status = 'ready'
    ORDER BY li.sort_order ASC
    LIMIT 1
  )                                   AS hero_image_url
FROM listing l
JOIN property_asset pa
  ON pa.id = l.property_asset_id
LEFT JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = l.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id
WHERE l.status     = 'active'
  AND l.visibility = 'public'
  AND pa.anchor_lon IS NOT NULL
  AND pa.anchor_lat IS NOT NULL;

COMMENT ON VIEW public_active_listing_map_surface IS
'Browse map surface: active public listing pins with anchor coordinates.
Suppression keys (parcel_public_ids to hide from the off-market dot layer)
are derived at query time in browse-map.ts, not here.
NOTE: the live browse-map query applies a bbox filter for performance;
this view is for reference and ad-hoc use only.';


-- Off-market parcel discoverability surface.
-- One row per parcel with a valid anchor point.
-- Used as the logical definition of what the off-market PMTiles represent;
-- actual tile features are baked from parquet by build-off-market-pmtiles.sh.
-- NOTE: route_id here is always parcel_public_id — there is no property_asset
-- join. The gray dot always routes to the parcel URL; the property page resolves
-- the current state (unclaimed, claimed, under claim, etc.) at render time.
CREATE OR REPLACE VIEW off_market_discoverability_surface AS
SELECT
  p.parcel_id,
  p.public_id     AS parcel_public_id,
  p.public_id     AS route_id,
  parcel_label(p.upi, p.cell, p.sector) AS display_id,
  p.district,
  p.sector,
  parcel_anchor.anchor_lon,
  parcel_anchor.anchor_lat,
  parcel_anchor.anchor_source
FROM parcel_app_ready_seed_preview p
JOIN parcel_anchor_point_preview parcel_anchor
  ON parcel_anchor.parcel_id = p.parcel_id
WHERE p.parcel_id       IS NOT NULL
  AND p.public_id       IS NOT NULL
  AND parcel_anchor.anchor_lon IS NOT NULL
  AND parcel_anchor.anchor_lat IS NOT NULL;

COMMENT ON VIEW off_market_discoverability_surface IS
'Logical definition of the off-market gray dot layer.
Actual PMTiles features are built from parquet (not this view) by
infra/scripts/build-off-market-pmtiles.sh. This view documents the intended
shape and is useful for DB-side validation and ad-hoc queries.
route_id is always parcel_public_id — no property_asset join by design.';
