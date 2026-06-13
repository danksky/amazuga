-- admin_boundary_preview — DDL reference only.
--
-- This table is populated by the Python import script, NOT by running this file.
-- To rebuild: DATABASE_URL=<url> python3 infra/scripts/import_admin_boundaries.py
--
-- Must be run BEFORE build_browse_locations.py (which joins this table for bboxes).
-- Schema kept here for reference.

CREATE TABLE admin_boundary_preview (
    level        text   NOT NULL,   -- 'district' | 'sector' | 'cell' | 'village'
    name         text   NOT NULL,   -- title-cased name for this level
    district     text,              -- always set
    sector       text,              -- NULL for districts
    cell         text,              -- NULL for districts + sectors
    village      text,              -- NULL for districts + sectors + cells
    bbox_min_lon float8 NOT NULL,
    bbox_min_lat float8 NOT NULL,
    bbox_max_lon float8 NOT NULL,
    bbox_max_lat float8 NOT NULL,
    geometry     jsonb  NOT NULL    -- GeoJSON Polygon (WGS-84)
);

CREATE INDEX admin_boundary_preview_lookup_idx
    ON admin_boundary_preview (
        level,
        lower(district),
        lower(sector),
        lower(cell),
        lower(village)
    );
