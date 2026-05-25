import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getListingImageUploadConfig } from "@/lib/server/listing-image-storage";
import { addListingImageToDb, getEditablePortalListingSummary } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

function isAllowedImageUrl(url: string, publicBaseUrl: string) {
  return url.startsWith(`${publicBaseUrl.replace(/\/+$/, "")}/`);
}

function isAllowedStorageKey(storageKey: string, listingId: string) {
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

  const body = await request.json().catch(() => null);
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
  const storageKey = typeof body?.storageKey === "string" ? body.storageKey.trim() : "";

  if (!imageUrl || !storageKey) {
    return NextResponse.json({ error: "Missing image metadata." }, { status: 400 });
  }

  const config = getListingImageUploadConfig();
  if (!config.publicBaseUrl) {
    return NextResponse.json({ error: "Listing image public base URL is not configured." }, { status: 503 });
  }

  if (!isAllowedImageUrl(imageUrl, config.publicBaseUrl) || !isAllowedStorageKey(storageKey, listingId)) {
    return NextResponse.json({ error: "Image metadata did not pass validation." }, { status: 400 });
  }

  let image;
  try {
    image = await addListingImageToDb({
      userId: currentUser.id,
      listingId,
      imageUrl,
      storageKey,
      width: typeof body?.width === "number" ? body.width : undefined,
      height: typeof body?.height === "number" ? body.height : undefined,
      contentType: typeof body?.contentType === "string" ? body.contentType : undefined,
      fileSizeBytes: typeof body?.fileSizeBytes === "number" ? body.fileSizeBytes : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not attach the uploaded image." },
      { status: 400 },
    );
  }

  if (listing.propertyRouteId) {
    revalidatePath(routes.public.property(listing.propertyRouteId));
  }
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalListingEdit(listingId));

  return NextResponse.json({ image });
}
