import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getListingImageUploadConfig } from "@/lib/server/listing-image-storage";
import { generateAndStoreOgImage } from "@/lib/server/og-image";
import { deleteListingVideoFromStorage, getListingVideoUploadConfig } from "@/lib/server/listing-video-storage";
import { addListingVideoToDb, getEditablePortalListingSummary, removeListingVideoFromDb } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

function isAllowedVideoUrl(url: string, publicBaseUrl: string) {
  return url.startsWith(`${publicBaseUrl.replace(/\/+$/, "")}/`);
}

function isAllowedVideoStorageKey(storageKey: string, listingId: string) {
  return storageKey.startsWith(`listing-videos/${listingId}/`);
}

function isAllowedThumbnailUrl(url: string, publicBaseUrl: string) {
  return url.startsWith(`${publicBaseUrl.replace(/\/+$/, "")}/`);
}

function isAllowedThumbnailStorageKey(storageKey: string, listingId: string) {
  return storageKey.startsWith(`listing-images/${listingId}/`);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    return NextResponse.json({ error: "Current user cannot edit listings." }, { status: 403 });
  }

  const { listingId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  const videoConfig = getListingVideoUploadConfig();
  const imageConfig = getListingImageUploadConfig();

  if (!videoConfig.publicBaseUrl) {
    return NextResponse.json({ error: "Listing video public base URL is not configured." }, { status: 503 });
  }

  if (!imageConfig.publicBaseUrl) {
    return NextResponse.json({ error: "Listing image public base URL is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
  const videoStorageKey = typeof body?.videoStorageKey === "string" ? body.videoStorageKey.trim() : "";
  const thumbnailUrl = typeof body?.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : "";
  const thumbnailStorageKey = typeof body?.thumbnailStorageKey === "string" ? body.thumbnailStorageKey.trim() : "";

  if (!videoUrl || !videoStorageKey) {
    return NextResponse.json({ error: "Missing video metadata." }, { status: 400 });
  }

  if (!isAllowedVideoUrl(videoUrl, videoConfig.publicBaseUrl) || !isAllowedVideoStorageKey(videoStorageKey, listingId)) {
    return NextResponse.json({ error: "Video metadata did not pass validation." }, { status: 400 });
  }

  if (thumbnailUrl && thumbnailStorageKey) {
    if (!isAllowedThumbnailUrl(thumbnailUrl, imageConfig.publicBaseUrl) || !isAllowedThumbnailStorageKey(thumbnailStorageKey, listingId)) {
      return NextResponse.json({ error: "Thumbnail metadata did not pass validation." }, { status: 400 });
    }
  }

  let video;
  try {
    video = await addListingVideoToDb({
      userId: currentUser.id,
      listingId,
      videoUrl,
      videoStorageKey,
      thumbnailUrl: thumbnailUrl || undefined,
      thumbnailStorageKey: thumbnailStorageKey || undefined,
      durationSeconds: typeof body?.durationSeconds === "number" ? Math.round(body.durationSeconds) : undefined,
      contentType: typeof body?.contentType === "string" ? body.contentType : undefined,
      fileSizeBytes: typeof body?.fileSizeBytes === "number" ? body.fileSizeBytes : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not attach the uploaded video." },
      { status: 400 },
    );
  }

  generateAndStoreOgImage(listingId).catch(console.error);

  if (listing.propertyRouteId) {
    revalidatePath(routes.public.property(listing.propertyRouteId));
  }
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalListingEdit(listingId));

  return NextResponse.json({ video });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listingId: string }> },
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    return NextResponse.json({ error: "Current user cannot edit listings." }, { status: 403 });
  }

  const { listingId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  let removed;
  try {
    removed = await removeListingVideoFromDb({ userId: currentUser.id, listingId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove the listing video." },
      { status: 400 },
    );
  }

  if (!removed) {
    return NextResponse.json({ error: "No video found for this listing." }, { status: 404 });
  }

  // Best-effort storage deletion — don't block the response on failure.
  if (removed.video_storage_key) {
    deleteListingVideoFromStorage({
      listingId,
      videoId: removed.id,
      storageKey: removed.video_storage_key,
      userId: currentUser.id,
    }).catch(console.error);
  }

  generateAndStoreOgImage(listingId).catch(console.error);

  if (listing.propertyRouteId) {
    revalidatePath(routes.public.property(listing.propertyRouteId));
  }
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalListingEdit(listingId));

  return NextResponse.json({ deleted: true });
}
