# R2 PMTiles Upload

This repo now provisions an R2 bucket for parcel tiles through Terraform.

## Current Bucket

- bucket name: `amazuga-parcel-tiles`
- current managed public base URL: `https://pub-afb059de506b40609943ce302b8ad951.r2.dev`

## Current Worker Endpoint

- Worker hostname: `tiles.amazuga.com`
- Worker PMTiles URL: `https://tiles.amazuga.com/catalog/base`

The app should read PMTiles through the Worker URL, not directly from `r2.dev`.

## Worker Origin Allowlist

The Worker allowlist is now split into explicit Terraform inputs:

- `cloudflare_tiles_worker_local_allowed_origins`
- `cloudflare_tiles_worker_public_allowed_origins`
- `cloudflare_tiles_worker_preview_allowed_origins`

Local and preview origins are intentionally empty by default and should be added
explicitly only when you want those hosted environments to read PMTiles through
the Worker.

## Worker Rate Limiting

The Worker now uses Cloudflare's built-in Rate Limiting binding with these
Terraform inputs:

- `cloudflare_tiles_worker_rate_limit_namespace_id`
- `cloudflare_tiles_worker_rate_limit_requests`
- `cloudflare_tiles_worker_rate_limit_period_seconds`

Current default:

- `240` requests per `60` seconds per IP/path key at each Cloudflare location

This is a lightweight abuse brake, not a substitute for signed access or
user/session authentication.

## App Configuration

The property parcel map now reads the PMTiles location from:

- `NEXT_PUBLIC_PARCEL_PMTILES_URL`

If that variable is not set, the app falls back to:

- `/tiles/approved-provisional-parcels.pmtiles` in local development
- `https://tiles.amazuga.com/catalog/base` outside local development

## Upload Credentials

Terraform uses a Cloudflare API token for control-plane resources.
That token is **not** the same thing as the S3-compatible credentials used for object upload.

For upload, you need R2 API credentials from Cloudflare:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

Optional:

- `R2_BUCKET_NAME`
  - defaults to `amazuga-parcel-tiles`
- `R2_PUBLIC_BASE_URL`
  - example: `https://pub-afb059de506b40609943ce302b8ad951.r2.dev`

## Upload Command

Use the helper script:

```bash
infra/scripts/upload-pmtiles-to-r2.sh \
  /absolute/path/to/approved-provisional-parcels.pmtiles \
  parcel-context-v1.pmtiles
```

That script uses the AWS CLI against the R2 S3-compatible endpoint:

- `https://<cloudflare-account-id>.r2.cloudflarestorage.com`

## Recommended Initial Object

Upload only:

- `parcel-context-v1.pmtiles`

The `huye-parcels.pmtiles` file is not used by the current app path.

## Suggested App Env

Once the upload is complete, set:

```env
NEXT_PUBLIC_PARCEL_PMTILES_URL=https://tiles.amazuga.com/catalog/base
```

For local development, the app now uses the local PMTiles file by default. You
can still override it manually with:

```env
NEXT_PUBLIC_PARCEL_PMTILES_URL=/tiles/approved-provisional-parcels.pmtiles
```
