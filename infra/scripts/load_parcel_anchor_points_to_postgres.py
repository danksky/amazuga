#!/usr/bin/env python3
"""Load derived parcel anchor points from Parquet into a Postgres companion table.

Moved from scrape-rwanda-parcels/scripts/ — consumes parcel-anchor-points.parquet
produced by that pipeline. Pass --root /path/to/scrape-rwanda-parcels to use
default data paths, or supply --anchor-path explicitly.

Preferred over load_parcel_anchor_points_with_psql.py: reads parquet directly via
DuckDB rather than relying on pre-generated CSV batches that can go stale.
"""

from __future__ import annotations

import argparse
import os
import time
import traceback
from pathlib import Path

import duckdb


# DEFAULT_ROOT is intentionally None here — this script lives in amazuga/infra/scripts/,
# not in scrape-rwanda-parcels. Pass --root /path/to/scrape-rwanda-parcels to derive
# default data paths, or supply --anchor-path explicitly.
DEFAULT_ROOT = None
DEFAULT_TABLE_NAME = "parcel_anchor_point_preview"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="path to scrape-rwanda-parcels repo root (used to derive default data paths)",
    )
    parser.add_argument(
        "--anchor-path",
        type=Path,
        help="input anchor-point parquet (default: <root>/data/working/parcels/parcel-anchor-points.parquet)",
    )
    parser.add_argument(
        "--database-url",
        help="target Postgres connection string (defaults to DATABASE_URL_PREVIEW or DATABASE_URL)",
    )
    parser.add_argument(
        "--table-name",
        default=DEFAULT_TABLE_NAME,
        help=f"target table name (default: {DEFAULT_TABLE_NAME})",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        help="progress log path (default: <root>/logs/load-parcel-anchor-points-to-postgres.log)",
    )
    parser.add_argument(
        "--batch-column",
        default="district",
        help="column used to split the load into smaller transactions (default: district)",
    )
    return parser.parse_args()


def _root_or_error(root: Path | None, flag: str) -> Path:
    if root is None:
        raise ValueError(
            f"{flag} is required when --root is not set.\n"
            "Pass --root /path/to/scrape-rwanda-parcels or provide the path explicitly."
        )
    return root


def append_log(log_path: Path, message: str) -> None:
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    line = f"{timestamp} {message}"
    print(line, flush=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(line + "\n")


def duckdb_connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("PRAGMA threads=2")
    con.execute("PRAGMA memory_limit='3GB'")
    con.execute("SET preserve_insertion_order=false")
    con.execute("INSTALL postgres")
    con.execute("LOAD postgres")
    return con


def resolve_database_url(explicit: str | None) -> str:
    return explicit or os.environ.get("DATABASE_URL_PREVIEW") or os.environ.get("DATABASE_URL") or ""


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> int:
    args = parse_args()
    anchor_path = args.anchor_path or (_root_or_error(args.root, "--anchor-path") / "data" / "working" / "parcels" / "parcel-anchor-points.parquet")
    database_url = resolve_database_url(args.database_url)
    log_path = args.log_path or (_root_or_error(args.root, "--log-path") / "logs" / "load-parcel-anchor-points-to-postgres.log")

    if not anchor_path.exists():
        raise FileNotFoundError(f"missing anchor parquet: {anchor_path}")
    if not database_url:
        raise ValueError("missing database url; set --database-url or DATABASE_URL_PREVIEW")

    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.write_text("", encoding="utf-8")

    append_log(log_path, f"[anchor-load-start] parquet={anchor_path} table={args.table_name}")
    try:
        con = duckdb_connect()
        try:
            con.execute(f"ATTACH {sql_quote(database_url)} AS pgdb (TYPE postgres)")
            append_log(log_path, "[anchor-load-attach-done]")

            con.execute(f"TRUNCATE TABLE pgdb.public.{args.table_name}")
            append_log(log_path, "[anchor-load-truncate-done]")

            batch_values = [
                row[0]
                for row in con.execute(
                    f"""
                    SELECT DISTINCT {args.batch_column}
                    FROM read_parquet('{anchor_path}')
                    WHERE {args.batch_column} IS NOT NULL
                    ORDER BY {args.batch_column}
                    """
                ).fetchall()
            ]
            append_log(log_path, f"[anchor-load-batches] count={len(batch_values)} column={args.batch_column}")

            for batch_value in batch_values:
                append_log(log_path, f"[anchor-load-batch-start] {args.batch_column}={batch_value}")
                con.execute(
                    f"""
                    INSERT INTO pgdb.public.{args.table_name} (
                      parcel_id,
                      public_id,
                      upi,
                      display_id,
                      anchor_source,
                      anchor_lon,
                      anchor_lat,
                      centroid_lon,
                      centroid_lat
                    )
                    SELECT
                      parcel_id,
                      public_id,
                      upi,
                      display_id,
                      anchor_source,
                      anchor_lon,
                      anchor_lat,
                      centroid_lon,
                      centroid_lat
                    FROM (
                      SELECT *,
                        ROW_NUMBER() OVER (PARTITION BY parcel_id ORDER BY anchor_source) AS rn
                      FROM read_parquet('{anchor_path}')
                      WHERE {args.batch_column} = {sql_quote(str(batch_value))}
                        AND anchor_lon IS NOT NULL
                        AND anchor_lat IS NOT NULL
                    ) sub
                    WHERE rn = 1
                    """
                )
                append_log(log_path, f"[anchor-load-batch-done] {args.batch_column}={batch_value}")

            inserted_count = con.execute(f"SELECT COUNT(*) FROM pgdb.public.{args.table_name}").fetchone()[0]
            append_log(log_path, f"[anchor-load-done] inserted={inserted_count}")
            print(f"inserted {inserted_count} rows into {args.table_name}")
        finally:
            con.close()
        return 0
    except Exception:
        append_log(log_path, f"[anchor-load-fatal-error]\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
