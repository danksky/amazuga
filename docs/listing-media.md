# Listing Media

Listing photos are now stored in Cloudflare R2 and uploaded through the
Cloudflare Worker at `https://uploads.amazuga.com`.

## Current Flow

1. An approved agent or agency manager opens a listing edit page.
2. The browser compresses selected photos to standardized JPEG before upload.
3. The app issues a short-lived signed upload intent.
4. The browser uploads the file to the Worker.
5. The Worker validates the signed token and writes the photo into R2.
6. The app saves the returned metadata into `listing_image`.

Current storage path shape:

- `listing-images/<listingId>/<imageId>/gallery.jpg`

Public listing images are served from:

- `https://media.amazuga.com/<storage_key>`

Preview listing images use a separate bucket and public base URL:

- `https://preview-media.amazuga.com/<storage_key>`

Private agent ID photos are stored separately from public listing images and
have no public R2 domain. Production uses `amazuga-agent-id-photos`; preview
uses `amazuga-agent-id-photos-preview`.

## Photo Removal Lifecycle

Photo removal uses a safer queued deletion flow rather than hard-deleting the
R2 object inline with the user action.

### User-visible behavior

- The listing image is hidden immediately after removal is requested.
- If the R2 delete succeeds right away, the DB row is deleted immediately.
- If the R2 delete fails, the image stays hidden and a retry job is queued.

### Data model

`listing_image.status` now supports:

- `ready`
- `processing`
- `failed`
- `pending_delete`
- `delete_failed`

Queued cleanup jobs are tracked in `listing_image_cleanup_job`.

## Retry Worker

The app exposes an internal route:

- `/api/internal/listing-image-cleanup`

That route:

- requires `Authorization: Bearer <CRON_SECRET>`
- claims pending or failed cleanup jobs
- retries R2 deletes
- marks successful jobs as `completed`
- reschedules failures with backoff

## Scheduling

`vercel.json` registers a Vercel Cron job:

- `17 6 * * *` -> `/api/internal/listing-image-cleanup`

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when the
project environment defines `CRON_SECRET`.

The current Vercel plan only allows daily cron execution. If we need faster
retry cadence later, we should either upgrade the plan or move the same route
trigger to GitHub Actions or another external scheduler.

## Signed Token Format

Both upload and delete operations are gated by a short-lived HMAC-signed
token generated server-side in `src/lib/server/listing-image-storage.ts`.

### Structure

```
base64url(JSON payload) . base64url(HMAC-SHA-256 signature)
```

The payload is signed with `LISTING_IMAGE_UPLOAD_SECRET` using HMAC-SHA-256.
The Worker re-derives the signature and rejects any token where they differ.

### Upload token payload

| Field | Type | Description |
|---|---|---|
| `version` | `1` | Schema version |
| `intentId` | UUID | Unique per-intent nonce |
| `listingId` | string | Target listing |
| `userId` | string | User requesting the upload |
| `contentType` | string | Must be `image/jpeg` |
| `fileName` | string | Original filename (informational) |
| `maxBytes` | number | Maximum allowed file size in bytes |
| `exp` | ms timestamp | Expiry — 10 minutes from issuance |

### Delete token payload

| Field | Type | Description |
|---|---|---|
| `version` | `1` | Schema version |
| `op` | `"delete"` | Discriminator checked by the Worker |
| `intentId` | UUID | Unique per-intent nonce |
| `listingId` | string | Owning listing |
| `imageId` | string | DB image record ID |
| `storageKey` | string | R2 object key to delete |
| `userId` | string | User requesting the deletion |
| `exp` | ms timestamp | Expiry — 10 minutes from issuance |

Both tokens expire after 10 minutes. The Worker validates `exp` against
`Date.now()` and rejects expired tokens with a 401.

## Worker Bindings

The listing media Cloudflare Workers require the following bindings, which are
managed by Terraform in `infra/terraform/main.tf`. Production uses
`amazuga-listing-media`; preview uses `amazuga-listing-media-preview`.

| Binding | Type | Value |
|---|---|---|
| `LISTING_MEDIA_BUCKET` | R2 bucket | `amazuga-listing-images` in production, `amazuga-listing-images-preview` in preview |
| `AGENT_ID_PHOTOS_BUCKET` | R2 bucket | `amazuga-agent-id-photos` in production, `amazuga-agent-id-photos-preview` in preview |
| `ADMIN_READ_SECRET` | secret text | Matches `AGENT_ID_PHOTO_ADMIN_READ_SECRET` in the app for the same Vercel target |
| `ALLOWED_ORIGINS` | plain text | JSON array of allowed CORS origins |
| `PUBLIC_BASE_URL` | plain text | `https://media.amazuga.com` in production, `https://preview-media.amazuga.com` in preview |
| `UPLOAD_SHARED_SECRET` | plain text | Matches `LISTING_IMAGE_UPLOAD_SECRET` in the app |
| `CLOUDFLARE_ZONE_ID` | plain text | Zone ID for the Cache Purge API call on deletion |
| `CLOUDFLARE_API_TOKEN` | secret text | CF token with **Cache Purge** permission |

`ALLOWED_ORIGINS` accepts exact origins (`https://amazuga.com`), wildcard
subdomain suffixes (`*.vercel.app`), or dot-prefixed suffixes
(`.vercel.app`). The Worker enforces this on `POST` uploads but not on
`DELETE` requests (which carry a signed token instead).

To deploy or update the Worker, source your Terraform variable env file
and run `terraform apply` from `infra/terraform/`.

## Required App Environment

- `LISTING_IMAGE_UPLOAD_URL`
- `LISTING_IMAGES_PUBLIC_BASE_URL`
- `LISTING_IMAGE_UPLOAD_SECRET`
- `AGENT_ID_PHOTO_ADMIN_READ_SECRET`
- `CRON_SECRET`

Optional:

- `LISTING_IMAGE_CLEANUP_BATCH_SIZE`

## Current Limitations

- Removing a photo from the UI does not yet support manual reordering of the remaining images.
- The cleanup queue only handles R2-backed uploads with a `storage_key`.
- Legacy seeded image URLs without a `storage_key` are removed from the DB immediately because there is no managed R2 object to clean up.
