import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  createStreamDirectUpload,
  isCloudflareStreamConfigured,
  MAX_STREAM_VIDEO_BYTES,
} from "@/lib/server/cloudflare-stream";
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

  if (!isCloudflareStreamConfigured()) {
    return NextResponse.json({ error: "Listing video upload is not configured." }, { status: 503 });
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
  const fileSizeBytes = typeof body?.fileSizeBytes === "number" ? body.fileSizeBytes : 0;

  if (!fileName || !contentType || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return NextResponse.json(
      { error: "fileName, contentType, and fileSizeBytes are required." },
      { status: 400 },
    );
  }

  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `Unsupported video type: ${contentType}. Allowed types are MP4, MOV, and WebM.` },
      { status: 400 },
    );
  }

  if (fileSizeBytes > MAX_STREAM_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video exceeds the 30 MB upload limit." }, { status: 400 });
  }

  try {
    const { uid, uploadURL } = await createStreamDirectUpload(listingId);
    return NextResponse.json({
      streamUid: uid,
      uploadURL,
      maxVideoBytes: MAX_STREAM_VIDEO_BYTES,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not create a video upload URL." }, { status: 502 });
  }
}
