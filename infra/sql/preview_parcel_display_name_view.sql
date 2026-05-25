-- Materialised view that derives the human-readable parcel display name
-- entirely from first principles, with no dependency on the stored display_id
-- column in parcel_app_ready_seed_preview.
--
-- Format: "<parcel_number>[- <letter>] <village>, <sector>"
--   e.g.  "3996-A Kabeza, Gatenga"   (sibling parcels)
--         "1 Nyanza, Kagarama"        (unique parcel)
--
-- Derivation of the letter suffix
-- --------------------------------
-- Some parcel numbers appear more than once in the same village+sector because
-- the Rwandan UPI encodes Province/District/Sector/Cell/ParcelNumber and two
-- parcels can share the same number while sitting in different cells.  When
-- that happens they are disambiguated by ranking the cell codes (4th UPI
-- segment) ascending within the group and assigning A, B, C, … via CHR(64+rank).
-- Parcels whose number is unique within their village+sector get no suffix.

CREATE MATERIALIZED VIEW IF NOT EXISTS parcel_display_name AS
SELECT
  parcel_id,
  public_id,
  parcel_number::text
    || CASE
         WHEN COUNT(*) OVER (PARTITION BY parcel_number, village, sector) > 1
         THEN '-' || CHR(64 + RANK() OVER (
                PARTITION BY parcel_number, village, sector
                ORDER BY split_part(upi, '/', 4)::int
              )::int)
         ELSE ''
       END
    || ' ' || village
    || ', ' || sector
  AS display_name
FROM parcel_app_ready_seed_preview
WHERE parcel_number IS NOT NULL
  AND village IS NOT NULL
  AND sector IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parcel_display_name_parcel_id_idx
  ON parcel_display_name (parcel_id);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_display_name_public_id_idx
  ON parcel_display_name (public_id);

-- To apply:
--   psql ... -f preview_parcel_display_name_view.sql
--
-- To refresh after a parcel data reload:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY parcel_display_name;
--   (CONCURRENTLY requires the unique index above and keeps the view queryable during refresh)
--
-- To drop entirely when migrating to a new system:
--   DROP MATERIALIZED VIEW parcel_display_name;
