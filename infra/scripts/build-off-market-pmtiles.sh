#!/bin/zsh
# Build off-market parcel discoverability point tiles from app-ready anchor points.
#
# Reads parcel-anchor-points.parquet directly, filtering to inventory_status
# 'approved' or 'provisional' (the app-ready set, ~8.16M parcels).
# No database connection needed.
#
# Prerequisites:
#   - tippecanoe available (https://github.com/felt/tippecanoe)
#   - python3 + pyarrow available
#   - npx wrangler available (for R2 upload)
#
# Usage:
#   ANCHOR_POINTS_PARQUET="/path/to/parcel-anchor-points.parquet" \
#   CLOUDFLARE_API_TOKEN="..." \
#   CLOUDFLARE_ACCOUNT_ID="..." \
#   infra/scripts/build-off-market-pmtiles.sh

set -euo pipefail

# ---- Config --------------------------------------------------------------

OBJECT_KEY="off-market-v1.pmtiles"
LOCAL_GEOJSON="/tmp/off-market.geojson"
LOCAL_PMTILES="/tmp/${OBJECT_KEY}"
R2_BUCKET_NAME="amazuga-off-market-tiles"

TIPPECANOE_MINZOOM=10
TIPPECANOE_MAXZOOM=14

# ---- Dependency checks ---------------------------------------------------

for cmd in tippecanoe python3; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd is required." >&2
    exit 1
  fi

done

if [ -z "${ANCHOR_POINTS_PARQUET:-}" ]; then
  echo "Error: ANCHOR_POINTS_PARQUET must be set to the parcel-anchor-points.parquet file." >&2
  exit 1
fi

if [ ! -f "$ANCHOR_POINTS_PARQUET" ]; then
  echo "Error: file not found: $ANCHOR_POINTS_PARQUET" >&2
  exit 1
fi

# ---- Convert parquet to GeoJSON (app-ready only) -------------------------

echo "Converting app-ready anchor points to GeoJSON…"

python3 - "$ANCHOR_POINTS_PARQUET" "$LOCAL_GEOJSON" <<'PYEOF'
import json, sys
import pyarrow.parquet as pq

src_path = sys.argv[1]
out_path = sys.argv[2]

APP_READY_STATUSES = {"approved", "provisional"}

pf = pq.ParquetFile(src_path)
total = 0
skipped = 0

with open(out_path, "w") as out:
    out.write('{"type":"FeatureCollection","features":[\n')
    first = True
    for batch in pf.iter_batches(
        columns=["public_id", "display_id", "inventory_status", "anchor_lon", "anchor_lat"],
        batch_size=100_000,
    ):
        tbl = batch.to_pydict()
        for i in range(len(tbl["public_id"])):
            if tbl["inventory_status"][i] not in APP_READY_STATUSES:
                skipped += 1
                continue
            try:
                lon = float(tbl["anchor_lon"][i])
                lat = float(tbl["anchor_lat"][i])
            except (TypeError, ValueError):
                skipped += 1
                continue
            feature = json.dumps({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": {
                    "parcel_public_id": tbl["public_id"][i],
                    "route_id": tbl["public_id"][i],
                    "display_id": tbl["display_id"][i] or "",
                },
            }, separators=(",", ":"))
            if not first:
                out.write(",\n")
            out.write(feature)
            first = False
            total += 1
            if total % 500_000 == 0:
                print(f"  {total:,} features written…")
    out.write("\n]}")

print(f"  Done — {total:,} app-ready features written, {skipped:,} blocked skipped → {out_path}")
PYEOF

echo "GeoJSON written to $LOCAL_GEOJSON"

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

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "Uploading $OBJECT_KEY to R2 bucket $R2_BUCKET_NAME…"
  R2_BUCKET_NAME="$R2_BUCKET_NAME" \
    "$(dirname "$0")/upload-pmtiles-to-r2.sh" "$LOCAL_PMTILES" "$OBJECT_KEY"
  echo "Done."
else
  echo "Cloudflare credentials not set — skipping upload."
  echo "Local file: $LOCAL_PMTILES"
  echo ""
  echo "To upload manually:"
  echo "  R2_BUCKET_NAME=$R2_BUCKET_NAME \\"
  echo "  infra/scripts/upload-pmtiles-to-r2.sh $LOCAL_PMTILES $OBJECT_KEY"
fi
