#!/usr/bin/env python3
"""
Import Rwanda administrative boundary polygons into admin_boundary_preview.

Reads the raw gzipped Esri FeatureServer JSON pages downloaded by
scrape-rwanda-parcels and loads them into the preview Neon DB.

Usage:
    DATABASE_URL=<url> python3 infra/scripts/import_admin_boundaries.py

Overrides:
    ADMIN_BOUNDARIES_ROOT=<path>   Path to scrape-rwanda-parcels/data/raw
                                   (default: sibling project)

Requires: psycopg2-binary (no pyarrow / pandas needed)
"""

from __future__ import annotations

import gzip
import io
import json
import os
import sys
from pathlib import Path

import psycopg2

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

_SCRIPT_DIR = Path(__file__).resolve().parent

ADMIN_BOUNDARIES_ROOT = Path(
    os.environ.get(
        "ADMIN_BOUNDARIES_ROOT",
        str(_SCRIPT_DIR / "../../../scrape-rwanda-parcels/data/raw"),
    )
).resolve()

DATABASE_URL = os.environ.get("DATABASE_URL", "")

# (level, raw-directory-slug, attribute-key-for-this-level's-name)
BOUNDARY_LAYERS: list[tuple[str, str, str]] = [
    ("district", "district-boundary-open-data",      "district"),
    ("sector",   "sector-boundary-open-data",        "sector"),
    ("cell",     "cell-boundary-2022-open-data",     "cell"),
    ("village",  "village-boundary-2022-open-data",  "village"),
]

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

DDL = """
DROP TABLE IF EXISTS admin_boundary_preview;
CREATE TABLE admin_boundary_preview (
    level        text   NOT NULL,
    name         text   NOT NULL,
    district     text,
    sector       text,
    cell         text,
    village      text,
    bbox_min_lon float8 NOT NULL,
    bbox_min_lat float8 NOT NULL,
    bbox_max_lon float8 NOT NULL,
    bbox_max_lat float8 NOT NULL,
    geometry     jsonb  NOT NULL
);
"""

INDEXES = """
CREATE INDEX admin_boundary_preview_lookup_idx
    ON admin_boundary_preview (
        level,
        lower(district),
        lower(sector),
        lower(cell),
        lower(village)
    );
"""

COPY_SQL = """
COPY admin_boundary_preview (
    level, name, district, sector, cell, village,
    bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat,
    geometry
)
FROM STDIN WITH (FORMAT TEXT, NULL '\\N', DELIMITER E'\\t')
"""

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def rings_to_geojson_polygon(rings: list) -> str:
    return json.dumps({"type": "Polygon", "coordinates": rings})


def rings_bbox(rings: list) -> tuple[float, float, float, float]:
    lons: list[float] = []
    lats: list[float] = []
    for ring in rings:
        for coord in ring:
            lons.append(coord[0])
            lats.append(coord[1])
    return min(lons), min(lats), max(lons), max(lats)


def normalise(s: str | None) -> str | None:
    if not s:
        return None
    cleaned = s.strip().title()
    return cleaned or None

# ---------------------------------------------------------------------------
# Read raw pages
# ---------------------------------------------------------------------------

def iter_features(slug: str) -> list[dict]:
    pages_dir = ADMIN_BOUNDARIES_ROOT / slug / "pages"
    if not pages_dir.exists():
        print(f"  WARNING: {pages_dir} not found, skipping", file=sys.stderr)
        return []
    features: list[dict] = []
    for page_file in sorted(pages_dir.iterdir()):
        if not page_file.name.endswith(".json.gz"):
            continue
        with gzip.open(page_file) as f:
            data = json.load(f)
        features.extend(data.get("features", []))
    return features


def build_rows() -> list[tuple]:
    rows: list[tuple] = []

    for level, slug, level_attr in BOUNDARY_LAYERS:
        print(f"Reading {slug} ...")
        features = iter_features(slug)
        print(f"  {len(features):,} features")

        for feat in features:
            attrs = feat["attributes"]
            rings = feat["geometry"]["rings"]

            name = normalise(attrs.get(level_attr))
            if not name:
                continue

            district = normalise(attrs.get("district"))
            sector   = normalise(attrs.get("sector"))  if level in ("sector", "cell", "village") else None
            cell     = normalise(attrs.get("cell"))    if level in ("cell", "village") else None
            village  = normalise(attrs.get("village")) if level == "village" else None

            min_lon, min_lat, max_lon, max_lat = rings_bbox(rings)
            geometry = rings_to_geojson_polygon(rings)

            rows.append((
                level,
                name,
                district,
                sector,
                cell,
                village,
                min_lon,
                min_lat,
                max_lon,
                max_lat,
                geometry,
            ))

    print(f"\nTotal: {len(rows):,} boundary rows")
    return rows

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def _tsv_value(v: object) -> str:
    if v is None:
        return "\\N"
    # Tab and newline are not valid inside TSV values; escape them just in case.
    return str(v).replace("\t", " ").replace("\n", " ")


def upload(rows: list[tuple]) -> None:
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    print("\nConnecting to Postgres ...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("Creating table ...")
    cur.execute(DDL)

    print("Uploading via COPY ...")
    buf = io.StringIO()
    for row in rows:
        buf.write("\t".join(_tsv_value(v) for v in row) + "\n")
    buf.seek(0)
    cur.copy_expert(COPY_SQL, buf)

    print("Building indexes ...")
    cur.execute(INDEXES)

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    rows = build_rows()
    upload(rows)
