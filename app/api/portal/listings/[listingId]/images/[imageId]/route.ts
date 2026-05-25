import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getEditablePortalListingSummary, removeListingImageFromDb } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

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

  let deleted;
  try {
    deleted = await removeListingImageFromDb({
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

  if (!deleted) {
    return NextResponse.json({ error: "Listing image not found." }, { status: 404 });
  }

  if (listing.propertyRouteId) {
    revalidatePath(routes.public.property(listing.propertyRouteId));
  }
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalListingEdit(listingId));

  return NextResponse.json({ deleted: true });
}
