import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createListingImageUploadIntent, isListingImageUploadConfigured } from "@/lib/server/listing-image-storage";
import { createListingVideoUploadIntent, isListingVideoUploadConfigured } from "@/lib/server/listing-video-storage";
import { getEditablePortalListingSummary } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

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

  if (!isListingVideoUploadConfigured()) {
    return NextResponse.json({ error: "Listing video upload is not configured." }, { status: 503 });
  }

  if (!isListingImageUploadConfigured()) {
    return NextResponse.json({ error: "Listing image upload is not configured (needed for thumbnail)." }, { status: 503 });
  }

  const { listingId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  if (listing.hasVideo) {
    return NextResponse.json(
      { error: "This listing already has a video. Remove the existing video before uploading a new one." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const contentType = typeof body?.contentType === "string" ? body.contentType.trim() : "";

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "fileName and contentType are required." }, { status: 400 });
  }

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported video type: ${contentType}. Allowed types are MP4, MOV, and WebM.` },
      { status: 400 },
    );
  }

  const safeBaseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "listing-video";

  const videoIntent = createListingVideoUploadIntent({
    listingId,
    userId: currentUser.id,
    contentType,
    fileName: `${safeBaseName}.${contentType === "video/webm" ? "webm" : contentType === "video/quicktime" ? "mov" : "mp4"}`,
  });

  const thumbnailIntent = createListingImageUploadIntent({
    listingId,
    userId: currentUser.id,
    contentType: "image/jpeg",
    fileName: `${safeBaseName}-thumbnail.jpg`,
  });

  return NextResponse.json({ videoIntent, thumbnailIntent });
}
