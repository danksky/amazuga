#!/bin/zsh

set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required." >&2
  exit 1
fi

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <source-pmtiles-file> [object-key]" >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
  echo "CLOUDFLARE_ACCOUNT_ID is required." >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_R2_ACCESS_KEY_ID:-}" ]; then
  echo "CLOUDFLARE_R2_ACCESS_KEY_ID is required." >&2
  exit 1
fi

if [ -z "${CLOUDFLARE_R2_SECRET_ACCESS_KEY:-}" ]; then
  echo "CLOUDFLARE_R2_SECRET_ACCESS_KEY is required." >&2
  exit 1
fi

SOURCE_FILE="$1"
OBJECT_KEY="${2:-parcel-context-v1.pmtiles}"
R2_BUCKET_NAME="${R2_BUCKET_NAME:-amazuga-parcel-tiles}"
R2_ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"

AWS_ACCESS_KEY_ID="$CLOUDFLARE_R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$CLOUDFLARE_R2_SECRET_ACCESS_KEY" \
AWS_DEFAULT_REGION="auto" \
aws s3 cp \
  "$SOURCE_FILE" \
  "s3://${R2_BUCKET_NAME}/${OBJECT_KEY}" \
  --endpoint-url "$R2_ENDPOINT" \
  --content-type "application/octet-stream"

echo "Uploaded ${OBJECT_KEY} to ${R2_BUCKET_NAME}."

if [ -n "${R2_PUBLIC_BASE_URL:-}" ]; then
  echo "Public URL: ${R2_PUBLIC_BASE_URL%/}/${OBJECT_KEY}"
fi
