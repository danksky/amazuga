#!/bin/zsh
# Build parcel outline PMTiles from a consolidated GeoJSON sequence export
# and upload to Cloudflare R2.
#
# Reads a single .geojsonseq.gz file (the consolidated app-ready parcel
# export produced by scrape-rwanda-parcels/scripts/export_refined_public_parcels.py).
# No database connection needed.
#
# Prerequisites:
#   - tippecanoe available (https://github.com/felt/tippecanoe)
#   - aws CLI available (brew install awscli) for R2 upload
#
# IMPORTANT — run the GeoJSONseq export first:
#   The GEOJSONSEQ_PATH file must be regenerated from the latest parquet before
#   running this script. The DB parcel seed and the tile build are independent
#   pipeline legs that both read from the same parquet source. If you rebuilt
#   the DB from a new parquet but skip the export step, the tiles will reflect
#   stale data even though the DB is current. Always re-run:
#
#     cd scrape-rwanda-parcels
#     python3 scripts/export_refined_public_parcels.py --reset-manifest
#
#   Then verify the manifest layer_counts look complete before proceeding here.
#
# Required env vars:
#   GEOJSONSEQ_PATH             path to approved-provisional-parcels.geojsonseq.gz
#   CLOUDFLARE_ACCOUNT_ID
#   CLOUDFLARE_R2_ACCESS_KEY_ID
#   CLOUDFLARE_R2_SECRET_ACCESS_KEY
#
# Optional env vars:
#   OBJECT_KEY      R2 object key (default: approved-provisional-parcels-v1.pmtiles)
#                   Increment the version suffix to bust the Cloudflare edge cache,
#                   then update var.cloudflare_tiles_worker_object_key in Terraform
#                   and redeploy so the worker serves the new key.
#   R2_BUCKET_NAME  (default: amazuga-parcel-tiles)
#
# Usage:
#   GEOJSONSEQ_PATH="/path/to/approved-provisional-parcels.geojsonseq.gz" \
#   CLOUDFLARE_ACCOUNT_ID="..." \
#   CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
#   CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
#   infra/scripts/build-parcel-tiles.sh

set -euo pipefail

# ---- Config ------------------------------------------------------------------

OBJECT_KEY="${OBJECT_KEY:-approved-provisional-parcels-v1.pmtiles}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-amazuga-parcel-tiles}"
LOCAL_PMTILES="/tmp/${OBJECT_KEY}"

# Zoom range: 16–17 preserves full parcel polygon detail at the parcel-focus
# zoom levels used by the property page map. Lower zooms are not needed because
# the parcel outline layer is only shown when zoomed in close to a specific
# parcel, not on the browse map.
TIPPECANOE_MINZOOM=16
TIPPECANOE_MAXZOOM=17

# ---- Dependency checks -------------------------------------------------------

for cmd in tippecanoe aws; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is required." >&2
    exit 1
  fi
done

if [ -z "${GEOJSONSEQ_PATH:-}" ]; then
  echo "Error: GEOJSONSEQ_PATH must be set to the approved-provisional-parcels.geojsonseq.gz file." >&2
  exit 1
fi

if [ ! -f "$GEOJSONSEQ_PATH" ]; then
  echo "Error: file not found: $GEOJSONSEQ_PATH" >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ] || [ -z "${CLOUDFLARE_R2_ACCESS_KEY_ID:-}" ] || [ -z "${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "Error: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY are required." >&2
  exit 1
fi

echo "Input:  $GEOJSONSEQ_PATH"
echo "Output: $LOCAL_PMTILES"
echo "Target: ${R2_BUCKET_NAME}/${OBJECT_KEY}"
echo ""

# ---- Build PMTiles -----------------------------------------------------------

echo "Building PMTiles with tippecanoe..."

tippecanoe \
  --read-parallel \
  --layer=parcels \
  --name=approved-provisional-parcels \
  --description="Sanitized app-ready parcel outlines for the Amazuga browse map" \
  --minimum-zoom="$TIPPECANOE_MINZOOM" \
  --maximum-zoom="$TIPPECANOE_MAXZOOM" \
  --full-detail=12 \
  --detect-shared-borders \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --include=parcel_key \
  --output="$LOCAL_PMTILES" \
  --force \
  "$GEOJSONSEQ_PATH"

echo "Built PMTiles at $LOCAL_PMTILES ($(du -sh "$LOCAL_PMTILES" | cut -f1))"
echo ""

# ---- Upload to R2 ------------------------------------------------------------

echo "Uploading to R2..."

R2_BUCKET_NAME="$R2_BUCKET_NAME" \
CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
CLOUDFLARE_R2_ACCESS_KEY_ID="$CLOUDFLARE_R2_ACCESS_KEY_ID" \
CLOUDFLARE_R2_SECRET_ACCESS_KEY="$CLOUDFLARE_R2_SECRET_ACCESS_KEY" \
  "$(dirname "$0")/upload-pmtiles-to-r2.sh" "$LOCAL_PMTILES" "$OBJECT_KEY"

echo ""
echo "Done. If you changed OBJECT_KEY from the previous version:"
echo "  1. Update var.cloudflare_tiles_worker_object_key in infra/terraform/variables.tf"
echo "  2. Run: terraform apply   (redeploys the worker with the new key)"
echo "  3. Update NEXT_PUBLIC_PARCEL_PMTILES_URL in Vercel if the URL changed"
