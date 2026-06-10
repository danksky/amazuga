import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createListingImageUploadIntent, getListingImageUploadConfig, isListingImageUploadConfigured } from "@/lib/server/listing-image-storage";
import { getEditablePortalListingSummary } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export const dynamic = "force-dynamic";

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

  if (!isListingImageUploadConfigured()) {
    return NextResponse.json({ error: "Listing image upload is not configured." }, { status: 503 });
  }

  const { listingId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const files = Array.isArray(body?.files) ? body.files : [];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files requested." }, { status: 400 });
  }

  const config = getListingImageUploadConfig();
  const remainingSlots = Math.max(0, config.maxImageCount - listing.images.length);

  if (files.length > remainingSlots) {
    return NextResponse.json(
      { error: `This listing can only accept ${remainingSlots} more photo${remainingSlots === 1 ? "" : "s"}.` },
      { status: 400 },
    );
  }

  let intents;
  try {
    intents = files.map((file: unknown) => {
      const fileName = typeof (file as { fileName?: unknown })?.fileName === "string" ? (file as { fileName: string }).fileName : "";
      const contentType =
        typeof (file as { contentType?: unknown })?.contentType === "string"
          ? (file as { contentType: string }).contentType
          : "";

      if (!fileName || !contentType) {
        throw new Error("Each file must include fileName and contentType.");
      }

      if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
        throw new Error(`Unsupported file type: ${contentType}. Allowed types are JPEG, PNG, WebP, and HEIC.`);
      }

      return createListingImageUploadIntent({
        listingId,
        userId: currentUser.id,
        fileName,
        contentType,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create upload intents." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    intents,
    existingCount: listing.images.length,
    maxImageCount: config.maxImageCount,
  });
}
