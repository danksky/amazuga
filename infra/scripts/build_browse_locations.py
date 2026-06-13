#!/usr/bin/env python3
"""
Build the browse_location_mv table from parcel-app-ready.parquet.

Reads only the 4 location columns from the parquet file locally (fast),
deduplicates into a ~23k-row hierarchy, then uploads via COPY in one shot.

Usage:
    DATABASE_URL=<url> python3 infra/scripts/build_browse_locations.py

The parquet path defaults to the sibling scrape-rwanda-parcels project.
Override with: PARCEL_PARQUET=<path> python3 ...

Requires: pyarrow, pandas, psycopg2-binary
"""

import io
import os
import sys

import pandas as pd
import psycopg2
import pyarrow.parquet as pq

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PARQUET_PATH = os.environ.get(
    "PARCEL_PARQUET",
    os.path.join(
        os.path.dirname(__file__),
        "../../..",
        "scrape-rwanda-parcels/data/working/parcels/parcel-app-ready.parquet",
    ),
)

DATABASE_URL = os.environ.get("DATABASE_URL", "")

PROVINCE_MAP: dict[str, str] = {
    # Kigali City
    "Gasabo":     "Kigali City",
    "Kicukiro":   "Kigali City",
    "Nyarugenge": "Kigali City",
    # Eastern Province
    "Bugesera":   "Eastern Province",
    "Gatsibo":    "Eastern Province",
    "Kayonza":    "Eastern Province",
    "Kirehe":     "Eastern Province",
    "Ngoma":      "Eastern Province",
    "Nyagatare":  "Eastern Province",
    "Rwamagana":  "Eastern Province",
    # Northern Province
    "Burera":     "Northern Province",
    "Gakenke":    "Northern Province",
    "Gicumbi":    "Northern Province",
    "Musanze":    "Northern Province",
    "Rulindo":    "Northern Province",
    # Southern Province
    "Gisagara":   "Southern Province",
    "Huye":       "Southern Province",
    "Kamonyi":    "Southern Province",
    "Muhanga":    "Southern Province",
    "Nyamagabe":  "Southern Province",
    "Nyanza":     "Southern Province",
    "Nyaruguru":  "Southern Province",
    "Ruhango":    "Southern Province",
    # Western Province
    "Karongi":    "Western Province",
    "Ngororero":  "Western Province",
    "Nyabihu":    "Western Province",
    "Nyamasheke": "Western Province",
    "Rubavu":     "Western Province",
    "Rusizi":     "Western Province",
    "Rutsiro":    "Western Province",
}

# ---------------------------------------------------------------------------
# Read + build
# ---------------------------------------------------------------------------

def build_rows() -> pd.DataFrame:
    print(f"Reading {PARQUET_PATH} ...")
    table = pq.read_table(PARQUET_PATH, columns=["district", "sector", "cell", "village"])
    df = table.to_pandas()
    print(f"  {len(df):,} parcels loaded")

    # Normalise: strip whitespace, title-case
    for col in ["district", "sector", "cell", "village"]:
        df[col] = df[col].str.strip().str.title()
        df.loc[df[col] == "", col] = None  # blank → NULL

    rows: list[dict] = []

    # L1 Districts
    grp = df.groupby("district", dropna=True).size().reset_index(name="parcel_count")
    for _, r in grp.iterrows():
        rows.append({
            "level": "district",
            "name": r["district"],
            "parent_name": PROVINCE_MAP.get(r["district"]),
            "district": r["district"],
            "sector": None,
            "cell": None,
            "parcel_count": int(r["parcel_count"]),
        })

    # L2 Sectors
    grp = (
        df[df["sector"].notna()]
        .groupby(["district", "sector"], dropna=True)
        .size()
        .reset_index(name="parcel_count")
    )
    for _, r in grp.iterrows():
        rows.append({
            "level": "sector",
            "name": r["sector"],
            "parent_name": r["district"],
            "district": r["district"],
            "sector": r["sector"],
            "cell": None,
            "parcel_count": int(r["parcel_count"]),
        })

    # L3 Cells
    grp = (
        df[df["cell"].notna()]
        .groupby(["district", "sector", "cell"], dropna=True)
        .size()
        .reset_index(name="parcel_count")
    )
    for _, r in grp.iterrows():
        rows.append({
            "level": "cell",
            "name": r["cell"],
            "parent_name": r["sector"],
            "district": r["district"],
            "sector": r["sector"],
            "cell": r["cell"],
            "parcel_count": int(r["parcel_count"]),
        })

    # L4 Villages
    grp = (
        df[df["village"].notna()]
        .groupby(["district", "sector", "cell", "village"], dropna=True)
        .size()
        .reset_index(name="parcel_count")
    )
    for _, r in grp.iterrows():
        rows.append({
            "level": "village",
            "name": r["village"],
            "parent_name": r["cell"],
            "district": r["district"],
            "sector": r["sector"],
            "cell": r["cell"],
            "parcel_count": int(r["parcel_count"]),
        })

    result = pd.DataFrame(rows, columns=["level","name","parent_name","district","sector","cell","parcel_count"])
    print(f"  {len(result):,} location rows built "
          f"({sum(result.level=='district')} districts, "
          f"{sum(result.level=='sector')} sectors, "
          f"{sum(result.level=='cell')} cells, "
          f"{sum(result.level=='village')} villages)")
    return result

# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

DDL = """
DROP MATERIALIZED VIEW IF EXISTS browse_location_mv;
DROP TABLE IF EXISTS browse_location_mv;
CREATE TABLE browse_location_mv (
    level        text    NOT NULL,
    name         text    NOT NULL,
    parent_name  text,
    district     text,
    sector       text,
    cell         text,
    parcel_count integer NOT NULL,
    bbox_min_lon float8,
    bbox_min_lat float8,
    bbox_max_lon float8,
    bbox_max_lat float8
);
"""

INDEXES = """
CREATE INDEX browse_location_mv_name_idx
    ON browse_location_mv (lower(name) text_pattern_ops);
CREATE INDEX browse_location_mv_level_idx
    ON browse_location_mv (level);
"""

COPY_SQL = """
COPY browse_location_mv (level, name, parent_name, district, sector, cell, parcel_count)
FROM STDIN WITH (FORMAT TEXT, NULL '\\N', DELIMITER E'\\t')
"""

# After COPY, join admin_boundary_preview to fill bbox columns.
# Four separate UPDATEs because the join condition differs per level.
BBOX_UPDATE_SQL = """
UPDATE browse_location_mv blm
SET bbox_min_lon = ab.bbox_min_lon,
    bbox_min_lat = ab.bbox_min_lat,
    bbox_max_lon = ab.bbox_max_lon,
    bbox_max_lat = ab.bbox_max_lat
FROM admin_boundary_preview ab
WHERE blm.level = 'district'
  AND ab.level  = 'district'
  AND lower(blm.name) = lower(ab.district);

UPDATE browse_location_mv blm
SET bbox_min_lon = ab.bbox_min_lon,
    bbox_min_lat = ab.bbox_min_lat,
    bbox_max_lon = ab.bbox_max_lon,
    bbox_max_lat = ab.bbox_max_lat
FROM admin_boundary_preview ab
WHERE blm.level     = 'sector'
  AND ab.level      = 'sector'
  AND lower(blm.district) = lower(ab.district)
  AND lower(blm.name)     = lower(ab.sector);

UPDATE browse_location_mv blm
SET bbox_min_lon = ab.bbox_min_lon,
    bbox_min_lat = ab.bbox_min_lat,
    bbox_max_lon = ab.bbox_max_lon,
    bbox_max_lat = ab.bbox_max_lat
FROM admin_boundary_preview ab
WHERE blm.level     = 'cell'
  AND ab.level      = 'cell'
  AND lower(blm.district) = lower(ab.district)
  AND lower(blm.sector)   = lower(ab.sector)
  AND lower(blm.name)     = lower(ab.cell);

UPDATE browse_location_mv blm
SET bbox_min_lon = ab.bbox_min_lon,
    bbox_min_lat = ab.bbox_min_lat,
    bbox_max_lon = ab.bbox_max_lon,
    bbox_max_lat = ab.bbox_max_lat
FROM admin_boundary_preview ab
WHERE blm.level     = 'village'
  AND ab.level      = 'village'
  AND lower(blm.district) = lower(ab.district)
  AND lower(blm.sector)   = lower(ab.sector)
  AND lower(blm.cell)     = lower(ab.cell)
  AND lower(blm.name)     = lower(ab.village);
"""


def upload(df: pd.DataFrame) -> None:
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    print("Connecting to Postgres ...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("Creating table ...")
    cur.execute(DDL)

    print("Uploading via COPY ...")
    buf = io.StringIO()
    df.to_csv(buf, index=False, header=False, sep="\t", na_rep="\\N")
    buf.seek(0)
    cur.copy_expert(COPY_SQL, buf)

    print("Building indexes ...")
    cur.execute(INDEXES)

    print("Joining bboxes from admin_boundary_preview ...")
    try:
        for statement in BBOX_UPDATE_SQL.strip().split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)
        matched = cur.rowcount  # rowcount of the last UPDATE
        print(f"  bbox update done (last UPDATE affected {matched} rows)")
    except Exception as e:
        # admin_boundary_preview may not exist on a fresh environment — non-fatal.
        print(f"  WARNING: bbox update skipped ({e})", file=sys.stderr)
        conn.rollback()
        conn.autocommit = True

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    rows = build_rows()
    upload(rows)
