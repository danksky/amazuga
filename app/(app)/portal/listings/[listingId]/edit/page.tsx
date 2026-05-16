import { notFound, redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { submitListingUpdateAction } from "@/features/portal/actions";
import { ListingForm } from "@/features/portal/listing-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getEditablePortalListingData } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

interface PortalListingEditRouteProps {
  params: Promise<{
    listingId: string;
  }>;
}

export default async function PortalListingEditRoute({ params }: PortalListingEditRouteProps) {
  const [currentUser, { listingId }] = await Promise.all([requireCurrentUser(), params]);
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasAgencyPortalAccess || !hasCapability(currentUser.roles, "edit_listing")) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getEditablePortalListingData(currentUser.id, listingId);

  if (!data) {
    notFound();
  }

  return (
    <PortalShell access={access}>
      <ListingForm agencies={data.agencies} listing={data.listing} mode="edit" submitAction={submitListingUpdateAction} />
    </PortalShell>
  );
}
