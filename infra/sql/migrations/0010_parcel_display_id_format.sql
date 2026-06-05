-- 0010_parcel_display_id_format.sql
--
-- Reformats the human-readable parcel label from the original UPI-derived
-- "District · Village · ParcelNumber" form (e.g. "Gasabo · Imanzi · 782")
-- to the more client-friendly "ParcelNumber Village, Sector" form
-- (e.g. "782 Imanzi, Kimironko").
--
-- Background / prior art
-- ──────────────────────
-- This migration is modelled on infra/sql/preview_update_display_id_format.sql,
-- written when the preview database was still on an older schema.  That script
-- was never promoted to a numbered migration before the preview DB was wiped and
-- rebuilt from the current schema, so its change was lost.  This migration
-- re-applies the same transformation under the numbered migration scheme so it
-- runs cleanly against the current schema.
--
-- Why the new format is better
-- ────────────────────────────
-- Agents report that buyers in Rwanda navigate by sector and cell, not by
-- village name (feedback: Amie Nicolas, Nicolas Real Estate, June 2026).
-- The old format buried the parcel number at the end and led with the district,
-- which adds no disambiguation value when the site already filters by area.
-- Putting the parcel number first makes the label scannable in list views;
-- cell and sector at the end mirror how locals describe a location.
--
-- What is NOT in this migration (vs. the earlier draft)
-- ──────────────────────────────────────────────────────
-- The earlier draft also updated a display_id_base column, which no longer
-- exists in the current schema.  It also referenced a separate materialized
-- view (parcel_display_name) that added A/B deduplication suffixes for parcels
-- sharing the same number within a village+sector.  Neither of those artefacts
-- is present in the current schema, so this migration omits them.
--
-- Summary of changes
-- ──────────────────
--   1. parcel_app_ready_seed_preview.display_id   — reformat in place
--   2. property_asset.display_name                — re-sync from parcel for
--      all parcel-linked assets (backfilled in 0008 from the old display_id)


-- ── 1. Reformat parcel display_id ──────────────────────────────────────────
-- Only touches rows that still have the old "A · B · C" format (sector IS NOT
-- NULL guards against rows that were already in a different format or have
-- incomplete admin data).

UPDATE parcel_app_ready_seed_preview
SET display_id = CONCAT(
  split_part(display_id, ' · ', 3),  -- parcel number (3rd segment)
  ' ', cell, ', ', sector
)
WHERE sector  IS NOT NULL
  AND cell    IS NOT NULL
  AND display_id IS NOT NULL
  AND display_id LIKE '% · %';       -- only rows still in old format


-- ── 2. Re-sync property_asset.display_name from updated parcel ─────────────
-- Migration 0008 backfilled display_name from p.display_id at that time.
-- Now that the parcel table has been updated above, we re-join to propagate
-- the new format to every parcel-linked property asset.

UPDATE property_asset pa
SET display_name = p.display_id
FROM parcel_app_ready_seed_preview p
WHERE pa.parcel_id    = p.parcel_id
  AND p.display_id   IS NOT NULL;
