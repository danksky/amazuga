import { redirect } from "next/navigation";

import { PortalShell } from "@/features/portal/portal-shell";
import { submitListingCreateAction } from "@/features/portal/actions";
import { ListingForm } from "@/features/portal/listing-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";
import { getPortalListingEditorData } from "@/lib/server/portal-listing-editor";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

export default async function SellPortalListingCreateRoute({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const currentUser = await requireCurrentUser(routes.app.portalListingNew);
  const access = await getPortalAccessState(currentUser.id);
  const { property } = await searchParams;

  if (!hasCapability(currentUser.roles, "create_listing")) {
    redirect(getPortalEntryHref(access));
  }

  const data = await getPortalListingEditorData(currentUser.id);

  return (
    <PortalShell access={access}>
      <ListingForm
        agencies={data.agencies}
        mode="create"
        propertyOptions={data.propertyOptions}
        selectedPropertyRouteId={typeof property === "string" ? property : undefined}
        submitAction={submitListingCreateAction}
      />
    </PortalShell>
  );
}
