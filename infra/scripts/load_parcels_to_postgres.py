#!/usr/bin/env python3
"""Load filtered parcel rows into Postgres in resumable CSV chunks.

Moved from scrape-rwanda-parcels/scripts/ — consumes parquet produced by that
pipeline. Pass --root /path/to/scrape-rwanda-parcels to use default data paths,
or provide each path explicitly via --input-path, --staging-dir, etc.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import shutil
import subprocess
import time
import traceback
from pathlib import Path
from typing import Any

import duckdb


# DEFAULT_ROOT is intentionally None here — this script lives in amazuga/infra/scripts/,
# not in scrape-rwanda-parcels. Pass --root /path/to/scrape-rwanda-parcels to derive
# default data paths, or supply each path explicitly.
DEFAULT_ROOT = None

TYPE_MAP = {
    "VARCHAR": "TEXT",
    "BIGINT": "BIGINT",
    "DOUBLE": "DOUBLE PRECISION",
    "BOOLEAN": "BOOLEAN",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=DEFAULT_ROOT,
        help="path to scrape-rwanda-parcels repo root (used to derive default data paths)",
    )
    parser.add_argument(
        "--input-path",
        type=Path,
        help="input parquet (default: <root>/data/working/parcels/parcel-app-ready.parquet)",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL", ""),
        help="Postgres connection string (default: $DATABASE_URL)",
    )
    parser.add_argument("--table-name", default="parcel_app_ready_seed", help="target table name")
    parser.add_argument(
        "--status-filter",
        nargs="+",
        default=["approved", "provisional"],
        help="inventory_status values to include (default: approved provisional)",
    )
    parser.add_argument("--chunk-size", type=int, default=100_000, help="rows per chunk")
    parser.add_argument(
        "--staging-dir",
        type=Path,
        help="temporary CSV chunk directory (default: <root>/data/working/parcels/postgres-load-staging)",
    )
    parser.add_argument(
        "--log-path",
        type=Path,
        help="progress log path (default: <root>/logs/load-parcels-to-postgres.log)",
    )
    parser.add_argument(
        "--manifest-path",
        type=Path,
        help="manifest path (default: <root>/data/working/parcels/load-parcels-to-postgres-manifest.json)",
    )
    parser.add_argument("--reset-manifest", action="store_true", help="start over from scratch")
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


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    temp_path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    temp_path.replace(path)


def duckdb_connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("PRAGMA threads=2")
    con.execute("PRAGMA memory_limit='3GB'")
    con.execute("SET preserve_insertion_order=false")
    return con


def shell_quote_literal(value: str) -> str:
    return value.replace("'", "''")


def psql_exec(database_url: str, sql: str) -> str:
    result = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def existing_table_columns(database_url: str, table_name: str) -> dict[str, str]:
    out = psql_exec(
        database_url,
        f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{shell_quote_literal(table_name)}'
        ORDER BY ordinal_position;
        """,
    )
    if not out:
        return {}

    columns: dict[str, str] = {}
    for line in out.splitlines():
        name, data_type = line.split("|", 1)
        columns[name] = data_type
    return columns


def ensure_table(database_url: str, table_name: str, columns: list[tuple[str, str]]) -> None:
    existing = existing_table_columns(database_url, table_name)
    if not existing:
        column_sql = ",\n".join(f'    "{name}" {pg_type}' for name, pg_type in columns)
        # UNLOGGED skips WAL writes — ~4-5x faster for bulk seed loads.
        # Safe for parcel tables: they are fully reproducible from parquet.
        sql = f"""
        CREATE UNLOGGED TABLE IF NOT EXISTS "{table_name}" (
{column_sql}
        );
        """
        psql_exec(database_url, sql)
        return

    missing = [(name, pg_type) for name, pg_type in columns if name not in existing]
    if not missing:
        return

    alter_sql = "\n".join(f'ALTER TABLE "{table_name}" ADD COLUMN IF NOT EXISTS "{name}" {pg_type};' for name, pg_type in missing)
    psql_exec(database_url, alter_sql)


def truncate_table(database_url: str, table_name: str) -> None:
    psql_exec(database_url, f'TRUNCATE TABLE "{table_name}";')


def copy_chunk(database_url: str, table_name: str, columns: list[str], csv_path: Path) -> None:
    column_sql = ", ".join(f'"{col}"' for col in columns)
    sql = f'\\copy "{table_name}" ({column_sql}) FROM \'{csv_path}\' WITH (FORMAT csv, HEADER true, NULL \'\')'
    subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=True,
        capture_output=True,
        text=True,
    )


def current_db_size(database_url: str) -> tuple[str, str]:
    out = psql_exec(
        database_url,
        "SELECT pg_size_pretty(pg_database_size(current_database())), pg_database_size(current_database());",
    )
    pretty, raw = out.split("|", 1)
    return pretty, raw


def main() -> int:
    args = parse_args()
    input_path = args.input_path or (_root_or_error(args.root, "--input-path") / "data" / "working" / "parcels" / "parcel-app-ready.parquet")
    staging_dir = args.staging_dir or (_root_or_error(args.root, "--staging-dir") / "data" / "working" / "parcels" / "postgres-load-staging")
    log_path = args.log_path or (_root_or_error(args.root, "--log-path") / "logs" / "load-parcels-to-postgres.log")
    manifest_path = args.manifest_path or (
        _root_or_error(args.root, "--manifest-path") / "data" / "working" / "parcels" / "load-parcels-to-postgres-manifest.json"
    )

    if not args.database_url:
        raise ValueError("database URL is required via --database-url or DATABASE_URL")
    if not input_path.exists():
        raise FileNotFoundError(f"missing parquet input: {input_path}")

    if args.reset_manifest:
        manifest_path.unlink(missing_ok=True)
        if staging_dir.exists():
            shutil.rmtree(staging_dir)

    staging_dir.mkdir(parents=True, exist_ok=True)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_path.exists():
        log_path.write_text("", encoding="utf-8")

    run_config = {
        "input_path": str(input_path.resolve()),
        "table_name": args.table_name,
        "status_filter": args.status_filter,
        "chunk_size": args.chunk_size,
    }
    manifest = load_manifest(manifest_path)
    if manifest.get("run_config") != run_config:
        manifest = {
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "run_config": run_config,
            "status": "running",
            "completed_chunks": [],
        }
        write_manifest(manifest_path, manifest)

    status_filter_sql = ", ".join(f"'{shell_quote_literal(value)}'" for value in args.status_filter)
    append_log(log_path, f"[pg-load-start] input={input_path} table={args.table_name} statuses={args.status_filter}")

    try:
        con = duckdb_connect()
        try:
            describe_rows = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{input_path}')").fetchall()
            columns = [(name, TYPE_MAP[col_type]) for name, col_type, *_ in describe_rows]
            column_names = [name for name, _ in columns]
            total_rows = con.execute(
                f"""
                SELECT COUNT(*)
                FROM read_parquet('{input_path}')
                WHERE inventory_status IN ({status_filter_sql})
                """
            ).fetchone()[0]
            total_chunks = math.ceil(total_rows / args.chunk_size)
        finally:
            con.close()

        ensure_table(args.database_url, args.table_name, columns)

        if args.reset_manifest:
            append_log(log_path, f"[pg-load-truncate-start] table={args.table_name}")
            truncate_table(args.database_url, args.table_name)
            append_log(log_path, f"[pg-load-truncate-done] table={args.table_name}")

        completed_chunks = set(manifest.get("completed_chunks", []))
        append_log(log_path, f"[pg-load-plan] rows={total_rows} chunk_size={args.chunk_size} total_chunks={total_chunks}")

        for chunk_index in range(total_chunks):
            if chunk_index in completed_chunks:
                append_log(log_path, f"[pg-load-skip] chunk={chunk_index + 1}/{total_chunks}")
                continue

            offset = chunk_index * args.chunk_size
            chunk_path = staging_dir / f"chunk-{chunk_index:05d}.csv"
            append_log(log_path, f"[pg-load-chunk-start] chunk={chunk_index + 1}/{total_chunks} offset={offset}")

            con = duckdb_connect()
            try:
                con.execute(
                    f"""
                    COPY (
                        SELECT *
                        FROM read_parquet('{input_path}')
                        WHERE inventory_status IN ({status_filter_sql})
                        ORDER BY upi
                        LIMIT {args.chunk_size} OFFSET {offset}
                    )
                    TO '{chunk_path}'
                    (FORMAT CSV, HEADER)
                    """
                )
            finally:
                con.close()

            row_count = 0
            with chunk_path.open("r", encoding="utf-8", newline="") as fh:
                reader = csv.reader(fh)
                next(reader, None)
                for row_count, _ in enumerate(reader, start=1):
                    pass

            copy_chunk(args.database_url, args.table_name, column_names, chunk_path)
            pretty_size, raw_size = current_db_size(args.database_url)
            append_log(
                log_path,
                f"[pg-load-chunk-done] chunk={chunk_index + 1}/{total_chunks} rows={row_count} db_size={pretty_size} db_size_bytes={raw_size}",
            )

            chunk_path.unlink(missing_ok=True)
            manifest = load_manifest(manifest_path)
            manifest["status"] = "running"
            manifest.setdefault("completed_chunks", []).append(chunk_index)
            manifest["last_completed_chunk"] = chunk_index
            manifest["loaded_rows_estimate"] = min((chunk_index + 1) * args.chunk_size, total_rows)
            manifest["table_name"] = args.table_name
            manifest["total_rows"] = total_rows
            manifest["total_chunks"] = total_chunks
            manifest["last_db_size_pretty"] = pretty_size
            manifest["last_db_size_bytes"] = raw_size
            write_manifest(manifest_path, manifest)

        manifest = load_manifest(manifest_path)
        manifest["status"] = "done"
        manifest["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        write_manifest(manifest_path, manifest)
        append_log(log_path, f"[pg-load-done] table={args.table_name} rows={total_rows}")
        print(f"log={log_path}")
        print(f"manifest={manifest_path}")
        return 0
    except Exception:
        manifest = load_manifest(manifest_path)
        if manifest:
            manifest["status"] = "failed"
            manifest["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            write_manifest(manifest_path, manifest)
        append_log(log_path, f"[pg-load-fatal-error]\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    raise SystemExit(main())
