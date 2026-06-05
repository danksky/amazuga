-- 0008_direct_listing_support.sql
--
-- Enables no-UPI (direct) listing creation for agents and private lessors.
-- Decouples property_asset, listing, and property_ownership from the parcel
-- table so that listings can exist without a UPI-verified parcel reference.
--
-- Summary of changes:
--   1. property_asset.parcel_id  — drop NOT NULL; add location columns
--   2. listing.parcel_id         — drop NOT NULL
--   3. property_ownership.parcel_id — drop NOT NULL
--   4. Rebuild partial unique index with parcel_id IS NOT NULL guard
--   5. Create admin_village_centroid lookup table
--   6. Backfill location columns for all existing property_asset rows


-- ── 1. New location columns on property_asset ──────────────────────────────

ALTER TABLE property_asset
  ALTER COLUMN parcel_id DROP NOT NULL;

ALTER TABLE property_asset
  ADD COLUMN IF NOT EXISTS location_source  TEXT
    CHECK (location_source IN ('parcel', 'admin_unit', 'pin_derived')),
  ADD COLUMN IF NOT EXISTS display_name     TEXT,
  ADD COLUMN IF NOT EXISTS admin_district   TEXT,
  ADD COLUMN IF NOT EXISTS admin_sector     TEXT,
  ADD COLUMN IF NOT EXISTS admin_cell       TEXT,
  ADD COLUMN IF NOT EXISTS admin_village    TEXT,
  ADD COLUMN IF NOT EXISTS anchor_lat       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS anchor_lon       DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS private_pin_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS private_pin_lon  DOUBLE PRECISION;

COMMENT ON COLUMN property_asset.location_source IS
'How the location was established. ''parcel'' = UPI-verified parcel; ''admin_unit'' = user-selected village; ''pin_derived'' = user-dropped pin reverse-geocoded to village.';

COMMENT ON COLUMN property_asset.display_name IS
'Human-readable property label used in all UI title expressions. For parcel-linked assets this is populated from parcel.display_id at claim approval time. For direct listings it is user-supplied or auto-generated from property type and village.';

COMMENT ON COLUMN property_asset.admin_district IS
'Administrative district. For parcel-linked assets, denormalized from parcel at creation. For direct listings, user-supplied.';

COMMENT ON COLUMN property_asset.anchor_lat IS
'Map anchor latitude. For parcel-linked assets, copied from parcel_anchor_point_preview at creation. For direct listings, the village centroid from admin_village_centroid.';

COMMENT ON COLUMN property_asset.anchor_lon IS
'Map anchor longitude. See anchor_lat.';

COMMENT ON COLUMN property_asset.private_pin_lat IS
'Raw latitude of a user-dropped pin. Never exposed publicly. Used only to reverse-geocode to admin_village at creation time. Retained for future approximate-location features.';

COMMENT ON COLUMN property_asset.private_pin_lon IS
'Raw longitude of a user-dropped pin. Never exposed publicly. See private_pin_lat.';


-- ── 2. listing.parcel_id — drop NOT NULL ───────────────────────────────────
-- Direct listings have no parcel; the column is NULL for them.
-- The existing listing_parcel_id_idx partial index is unaffected (NULLs are
-- not indexed by default in Postgres B-tree indexes).

ALTER TABLE listing
  ALTER COLUMN parcel_id DROP NOT NULL;


-- ── 3. property_ownership.parcel_id — drop NOT NULL ────────────────────────
-- FSBO direct listings create an ownership row so the listing surfaces in the
-- property workspace, but there is no parcel to reference.

ALTER TABLE property_ownership
  ALTER COLUMN parcel_id DROP NOT NULL;


-- ── 4. Rebuild partial unique index with null guard ─────────────────────────
-- The old index enforced one is_primary_for_parcel row per parcel_id value,
-- but did not account for NULL parcel_id. Multiple direct listings with a NULL
-- parcel_id would all match each other under the old definition and trigger a
-- unique violation. The new condition excludes NULL parcel_id rows entirely.

DROP INDEX IF EXISTS property_asset_one_primary_per_parcel_idx;

CREATE UNIQUE INDEX property_asset_one_primary_per_parcel_idx
  ON property_asset (parcel_id)
  WHERE is_primary_for_parcel AND parcel_id IS NOT NULL;


-- ── 5. Admin village centroid lookup ───────────────────────────────────────
-- Provides anchor points for direct listings and supports pin reverse-geocoding.
-- Populated separately from NISR administrative boundary data (village polygons).
-- Primary key is the full administrative hierarchy to guarantee uniqueness —
-- village names are not globally unique across Rwanda.

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

COMMENT ON TABLE admin_village_centroid IS
'Representative centroid points for Rwanda administrative villages. Loaded from
NISR boundary polygon data. Used as map anchor for direct (no-parcel) listings
and for reverse-geocoding user-dropped pins to their containing village.
Primary key is the full hierarchy because village names are not globally unique.';

CREATE INDEX IF NOT EXISTS admin_village_centroid_village_idx
  ON admin_village_centroid (village_name);

CREATE INDEX IF NOT EXISTS admin_village_centroid_sector_idx
  ON admin_village_centroid (district_name, sector_name);


-- ── 6. Backfill location columns for all existing property_asset rows ───────
-- Populates the new columns from parcel data for all existing (parcel-linked)
-- assets. Anchor prefers the interior point from parcel_anchor_point_preview;
-- falls back to centroid from parcel_app_ready_seed_preview when no anchor row
-- exists for a parcel (rare edge case).

UPDATE property_asset pa
SET
  location_source = 'parcel',
  display_name    = COALESCE(p.display_id, p.public_id, pa.public_id),
  admin_district  = p.district,
  admin_sector    = p.sector,
  admin_cell      = p.cell,
  admin_village   = p.village,
  anchor_lat      = COALESCE(a.anchor_lat,  p.centroid_lat),
  anchor_lon      = COALESCE(a.anchor_lon,  p.centroid_lon)
FROM parcel_app_ready_seed_preview p
LEFT JOIN parcel_anchor_point_preview a
  ON a.parcel_id = p.parcel_id
WHERE pa.parcel_id = p.parcel_id;
