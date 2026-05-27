#!/bin/zsh
# Build off-market parcel discoverability point tiles from anchor point CSVs.
#
# Reads deduped anchor point CSVs directly — no database connection needed.
#
# Prerequisites:
#   - tippecanoe available (https://github.com/felt/tippecanoe)
#   - python3 available
#   - npx wrangler available (for R2 upload)
#
# Usage:
#   ANCHOR_POINTS_DIR="/path/to/anchor-point-csv-batches-deduped" \
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

if [ -z "${ANCHOR_POINTS_DIR:-}" ]; then
  echo "Error: ANCHOR_POINTS_DIR must be set to the deduped anchor point CSV directory." >&2
  exit 1
fi

if [ ! -d "$ANCHOR_POINTS_DIR" ]; then
  echo "Error: directory not found: $ANCHOR_POINTS_DIR" >&2
  exit 1
fi

# ---- Convert CSVs to GeoJSON --------------------------------------------

echo "Converting anchor point CSVs to GeoJSON…"

python3 - "$ANCHOR_POINTS_DIR" "$LOCAL_GEOJSON" <<'PYEOF'
import csv, json, sys, glob, os

src_dir = sys.argv[1]
out_path = sys.argv[2]

files = sorted(glob.glob(os.path.join(src_dir, "*.csv")))
if not files:
    print(f"Error: no CSV files found in {src_dir}", file=sys.stderr)
    sys.exit(1)

print(f"  Found {len(files)} CSV files…")

with open(out_path, "w") as out:
    out.write('{"type":"FeatureCollection","features":[\n')
    first = True
    total = 0
    for path in files:
        with open(path, newline="") as f:
            for row in csv.DictReader(f):
                try:
                    lon = float(row["anchor_lon"])
                    lat = float(row["anchor_lat"])
                except (ValueError, KeyError):
                    continue
                feature = json.dumps({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "parcel_public_id": row["public_id"],
                        "route_id": row["public_id"],
                        "display_id": row.get("display_id", ""),
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

print(f"  Done — {total:,} features → {out_path}")
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
