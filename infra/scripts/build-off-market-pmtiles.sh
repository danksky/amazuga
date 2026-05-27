#!/bin/zsh
# Build off-market parcel discoverability point tiles from the preview DB.
#
# Prerequisites:
#   - psql available
#   - tippecanoe available (https://github.com/felt/tippecanoe)
#   - AWS CLI available (for upload to R2)
#   - DATABASE_URL_PREVIEW or DATABASE_URL set in environment
#
# Reads: preview_public_off_market_discoverability_surface_v1
# Outputs: off-market-preview-v1.pmtiles (local) and uploads to R2
#
# Usage:
#   DATABASE_URL_PREVIEW="postgres://..." \
#   CLOUDFLARE_ACCOUNT_ID="..." \
#   CLOUDFLARE_R2_ACCESS_KEY_ID="..." \
#   CLOUDFLARE_R2_SECRET_ACCESS_KEY="..." \
#   infra/scripts/build-off-market-pmtiles.sh
#
# Preview and prod tile artifacts use separate R2 object keys so they never
# overwrite each other. Pass TILE_ENV=prod to build the prod artifact.

set -euo pipefail

# ---- Config --------------------------------------------------------------

TILE_ENV="${TILE_ENV:-preview}"
OBJECT_KEY="off-market-${TILE_ENV}-v1.pmtiles"
LOCAL_GEOJSON="/tmp/off-market-${TILE_ENV}.geojson"
LOCAL_PMTILES="/tmp/${OBJECT_KEY}"

# Off-market dots are meaningful at neighbourhood and closer zooms only.
# minzoom=10 keeps the file small; maxzoom=14 is enough for parcel density.
TIPPECANOE_MINZOOM=10
TIPPECANOE_MAXZOOM=14

# ---- Dependency checks ---------------------------------------------------

for cmd in psql tippecanoe; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is required." >&2
    exit 1
  fi
done

DB_URL="${DATABASE_URL_PREVIEW:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "Error: DATABASE_URL_PREVIEW or DATABASE_URL must be set." >&2
  exit 1
fi

# ---- Export GeoJSON from DB ---------------------------------------------

echo "Exporting off-market discoverability surface from DB…"

psql "$DB_URL" -c "
  COPY (
    SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'geometry', json_build_object(
            'type', 'Point',
            'coordinates', json_build_array(anchor_lon, anchor_lat)
          ),
          'properties', json_build_object(
            'parcel_public_id', parcel_public_id,
            'route_id',         route_id,
            'display_id',       display_id,
            'district',         district,
            'sector',           sector,
            'anchor_source',    anchor_source,
            'entity_kind',      'parcel'
          )
        )
      ), '[]'::json)
    )
    FROM preview_public_off_market_discoverability_surface_v1
  ) TO STDOUT;
" > "$LOCAL_GEOJSON"

echo "Exported GeoJSON to $LOCAL_GEOJSON"

# ---- Build PMTiles -------------------------------------------------------

echo "Building PMTiles with tippecanoe…"

tippecanoe \
  --output="$LOCAL_PMTILES" \
  --layer=off_market_parcels \
  --minimum-zoom="$TIPPECANOE_MINZOOM" \
  --maximum-zoom="$TIPPECANOE_MAXZOOM" \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --no-tile-compression \
  --force \
  "$LOCAL_GEOJSON"

echo "Built PMTiles at $LOCAL_PMTILES"

# ---- Upload to R2 --------------------------------------------------------

if [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && \
   [ -n "${CLOUDFLARE_R2_ACCESS_KEY_ID:-}" ] && \
   [ -n "${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}" ]; then

  echo "Uploading $OBJECT_KEY to R2…"
  "$(dirname "$0")/upload-pmtiles-to-r2.sh" "$LOCAL_PMTILES" "$OBJECT_KEY"
  echo "Done."
else
  echo "R2 credentials not set — skipping upload."
  echo "Local file available at: $LOCAL_PMTILES"
  echo ""
  echo "To upload manually:"
  echo "  infra/scripts/upload-pmtiles-to-r2.sh $LOCAL_PMTILES $OBJECT_KEY"
fi
