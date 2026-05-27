#!/bin/zsh

set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <source-pmtiles-file> [object-key]" >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required." >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required." >&2
  exit 1
fi

SOURCE_FILE="$1"
OBJECT_KEY="${2:-parcel-context-v1.pmtiles}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-amazuga-parcel-tiles}"

CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  npx wrangler r2 object put "${R2_BUCKET_NAME}/${OBJECT_KEY}" \
    --file "$SOURCE_FILE" \
    --content-type "application/octet-stream"

echo "Uploaded ${OBJECT_KEY} to ${R2_BUCKET_NAME}."
