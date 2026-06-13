import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { submitListingEditAction } from "@/features/portal/actions";
import { ListingForm } from "@/features/portal/listing-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { isCloudflareStreamConfigured } from "@/lib/server/cloudflare-stream";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getEditablePortalListingData } from "@/lib/server/portal-listing-editor";
import { isListingImageUploadConfigured } from "@/lib/server/listing-image-storage";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function PortalListingEditRoute({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);
  const access = await getPortalAccessState(currentUser.id);
  const { listingId } = await params;

  if ((!access.hasAgencyPortalAccess && !access.hasPropertyOwnerListingAccess) || !hasCapability(currentUser.roles, "edit_listing")) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getEditablePortalListingData(currentUser.id, listingId);

  if (!data) {
    redirect(routes.app.portalListings);
  }

  return (
    <PortalShell access={access}>
      <ListingForm
        agencies={data.agencies}
        listing={data.listing}
        mode="edit"
        submitAction={submitListingEditAction}
        uploadEnabled={isListingImageUploadConfigured()}
        videoUploadEnabled={isCloudflareStreamConfigured()}
      />
    </PortalShell>
  );
}
