import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { attemptListingImageCleanupNow } from "@/lib/server/listing-image-cleanup";
import { generateAndStoreOgImage } from "@/lib/server/og-image";
import { getEditablePortalListingSummary, queueListingImageDeletion, swapListingImageSortOrders } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ listingId: string; imageId: string }> },
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    return NextResponse.json({ error: "Current user cannot edit listings." }, { status: 403 });
  }

  const { listingId, imageId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.swapWithImageId !== "string" || !body.swapWithImageId) {
    return NextResponse.json({ error: "Invalid swapWithImageId." }, { status: 400 });
  }

  const swapped = await swapListingImageSortOrders({
    userId: currentUser.id,
    listingId,
    imageIdA: imageId,
    imageIdB: body.swapWithImageId,
  });

  if (!swapped) {
    return NextResponse.json({ error: "Listing images not found." }, { status: 404 });
  }

  generateAndStoreOgImage(listingId).catch(console.error);

  return NextResponse.json({ swapped: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ listingId: string; imageId: string }> },
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    return NextResponse.json({ error: "Current user cannot edit listings." }, { status: 403 });
  }

  const { listingId, imageId } = await context.params;
  const listing = await getEditablePortalListingSummary(currentUser.id, listingId);

  if (!listing) {
    return NextResponse.json({ error: "Listing not found or inaccessible." }, { status: 404 });
  }

  let removal;
  try {
    removal = await queueListingImageDeletion({
      userId: currentUser.id,
      listingId,
      imageId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove the listing image." },
      { status: 400 },
    );
  }

  if (!removal) {
    return NextResponse.json({ error: "Listing image not found." }, { status: 404 });
  }

  let cleanup = "not_needed";

  if (removal.queuedCleanupJobId) {
    cleanup = "queued";

    try {
      const attempt = await attemptListingImageCleanupNow(removal.queuedCleanupJobId);
      if (attempt.completed) {
        cleanup = "completed";
      }
    } catch {
      cleanup = "queued";
    }
  }

  if (listing.propertyRouteId) {
    revalidatePath(routes.public.property(listing.propertyRouteId));
  }
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalListingEdit(listingId));

  generateAndStoreOgImage(listingId).catch(console.error);

  return NextResponse.json({ deleted: true, cleanup });
}
