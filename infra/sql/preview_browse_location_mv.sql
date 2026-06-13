-- browse_location_mv — DDL reference only.
--
-- This table is populated by the Python build script, NOT by running this file.
-- To rebuild: DATABASE_URL=<url> python3 infra/scripts/build_browse_locations.py
-- The seed pipeline (run_preview_seed.sh) runs this automatically after each parcel load.
--
-- Schema kept here for reference.

CREATE TABLE browse_location_mv (
    level        text    NOT NULL,  -- 'district' | 'sector' | 'cell' | 'village'
    name         text    NOT NULL,  -- title-cased display name (the matched level)
    parent_name  text,              -- one level up, for display: "Kimironko · Gasabo"
    district     text,              -- raw value for ILIKE filtering
    sector       text,
    cell         text,
    parcel_count integer NOT NULL,  -- used to rank suggestions (denser areas first)
    bbox_min_lon float8,            -- bounding box from admin_boundary_preview (nullable)
    bbox_min_lat float8,
    bbox_max_lon float8,
    bbox_max_lat float8
);

CREATE INDEX browse_location_mv_name_idx
    ON browse_location_mv (lower(name) text_pattern_ops);

CREATE INDEX browse_location_mv_level_idx
    ON browse_location_mv (level);
