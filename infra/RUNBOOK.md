# Amazuga Infrastructure Runbook

Operational reference for rebuilding the preview database, tiles, and R2 assets.

---

## Prerequisites

- `amazuga/.env.infra.local` — contains `DATABASE_URL_PREVIEW`, `CLOUDFLARE_*`, R2 credentials
- `scrape-rwanda-parcels` checked out locally — provides parquet inputs
- `tippecanoe` installed (`brew install tippecanoe`)
- `awscli` installed (`brew install awscli`)
- Python venv in `scrape-rwanda-parcels/.venv` with `duckdb`, `pyarrow`, `shapely`
- `psql` v17+ (`/usr/local/Cellar/libpq/17.4/bin/psql`)

---

## Full rebuild sequence

For the complete data pipeline that produces the parquet inputs, see
[scrape-rwanda-parcels/docs/pipeline-data-flow.md](../../scrape-rwanda-parcels/docs/pipeline-data-flow.md).

The steps below assume the parquet files are already up to date.

### 1. Wipe and re-apply schema

```bash
psql "$DATABASE_URL_PREVIEW" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql "$DATABASE_URL_PREVIEW" -v ON_ERROR_STOP=1 -f infra/sql/schema.sql
```

### 2. Load parcel tables

```bash
# Main parcel dataset (~10-12 min with UNLOGGED table)
python infra/scripts/load_parcels_to_postgres.py \
  --root /path/to/scrape-rwanda-parcels \
  --database-url "$DATABASE_URL_PREVIEW" \
  --table-name parcel_app_ready_seed_preview \
  --reset-manifest

# Anchor points
python infra/scripts/load_parcel_anchor_points_to_postgres.py \
  --root /path/to/scrape-rwanda-parcels \
  --database-url "$DATABASE_URL_PREVIEW"

# Indexes + ANALYZE
psql "$DATABASE_URL_PREVIEW" -f infra/sql/parcel_app_ready_seed_indexes.sql
```

### 3. Build and upload tiles (can run in parallel after step 2)

```bash
# Off-market gray dot PMTiles
ANCHOR_POINTS_PARQUET=/path/to/scrape-rwanda-parcels/data/working/parcels/parcel-anchor-points.parquet \
  infra/scripts/build-off-market-pmtiles.sh

# Parcel outline PMTiles (run from scrape-rwanda-parcels)
python /path/to/scrape-rwanda-parcels/scripts/build_public_parcel_tiles.py --force

# Upload parcel outline tiles (R2 credentials auto-sourced from .env.infra.local)
R2_BUCKET_NAME=amazuga-parcel-tiles \
  infra/scripts/upload-pmtiles-to-r2.sh \
  /path/to/scrape-rwanda-parcels/data/tiles/approved-provisional-parcels.pmtiles \
  approved-provisional-parcels-v3.pmtiles

# Purge Cloudflare cache (zone e0a3423f7288f6091247e2eedb35cd83)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/e0a3423f7288f6091247e2eedb35cd83/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

### 4. Update local dev symlinks

After rebuilding tiles, the local symlinks in `public/tiles/` point to
`scrape-rwanda-parcels/data/tiles/` and pick up changes automatically:
- `public/tiles/approved-provisional-parcels.pmtiles` → `scrape-rwanda-parcels/data/tiles/approved-provisional-parcels.pmtiles`
- `public/tiles/off-market-preview-v1.pmtiles` → `scrape-rwanda-parcels/data/tiles/off-market-v1.pmtiles`

---

## Partial rebuilds

| What changed | Steps needed |
|---|---|
| Zone keep-list only | Pipeline steps 6–7 in scrape repo, then steps 2–3 above |
| New district added | Full pipeline in scrape repo, then steps 1–3 above |
| Schema change only | Step 1 above (wipe + re-apply schema) |
| App data reset only | Step 1 above (skip parcel load if parquet unchanged) |

---

## Infrastructure managed by Terraform

`infra/terraform/` manages:
- Cloudflare R2 buckets (`amazuga-parcel-tiles`, `amazuga-off-market-tiles`, `amazuga-listing-media`)
- Cloudflare Workers (tile servers, listing media upload/serve)
- Neon project + branches (production, preview)
- Vercel project + environment variables

Run `terraform plan` / `terraform apply` from `infra/terraform/` for infrastructure changes.
