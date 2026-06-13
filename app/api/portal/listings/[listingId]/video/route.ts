import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  deleteStreamVideo,
  getStreamVideo,
  streamHlsUrl,
  streamThumbnailUrl,
} from "@/lib/server/cloudflare-stream";
import { generateAndStoreOgImage } from "@/lib/server/og-image";
import { deleteListingVideoFromStorage } from "@/lib/server/listing-video-storage";
import { addListingVideoToDb, getEditablePortalListingSummary, removeListingVideoFromDb } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

const STREAM_UID_PATTERN = /^[a-f0-9]{32}$/i;

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

  const body = await request.json().catch(() => null);
  const streamUid = typeof body?.streamUid === "string" ? body.streamUid.trim() : "";

  if (!STREAM_UID_PATTERN.test(streamUid)) {
    return NextResponse.json({ error: "A valid Stream video identifier is required." }, { status: 400 });
  }

  try {
    const streamVideo = await getStreamVideo(streamUid);
    if (streamVideo.listingId !== listingId) {
      return NextResponse.json({ error: "Stream video did not pass listing validation." }, { status: 400 });
    }
    if (streamVideo.status === "error") {
      return NextResponse.json(
        { error: streamVideo.errorReason || "Cloudflare could not process this video." },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not verify the uploaded Stream video." }, { status: 502 });
  }

  let video;
  try {
    video = await addListingVideoToDb({
      userId: currentUser.id,
      listingId,
      streamUid,
      videoUrl: streamHlsUrl(streamUid),
      thumbnailUrl: streamThumbnailUrl(streamUid),
    });
  } catch (error) {
    deleteStreamVideo(streamUid).catch(console.error);
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

  // Best-effort media deletion; legacy R2 rows keep their original path.
  if (removed.stream_uid) {
    deleteStreamVideo(removed.stream_uid).catch(console.error);
  } else if (removed.video_storage_key) {
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
