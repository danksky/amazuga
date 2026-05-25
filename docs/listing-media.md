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

Public images are served from:

- `https://media.amazuga.com/<storage_key>`

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

## Required App Environment

- `LISTING_IMAGE_UPLOAD_URL`
- `LISTING_IMAGES_PUBLIC_BASE_URL`
- `LISTING_IMAGE_UPLOAD_SECRET`
- `CRON_SECRET`

Optional:

- `LISTING_IMAGE_CLEANUP_BATCH_SIZE`

## Current Limitations

- Removing a photo from the UI does not yet support manual reordering of the remaining images.
- The cleanup queue only handles R2-backed uploads with a `storage_key`.
- Legacy seeded image URLs without a `storage_key` are removed from the DB immediately because there is no managed R2 object to clean up.
