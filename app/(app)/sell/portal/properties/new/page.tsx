import { NewListingForkPage } from "@/features/portal/new-listing-fork-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function SellPortalPropertyNewPage() {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyNew);
  const access = await getPortalAccessState(currentUser.id);

  return (
    <PortalShell access={access}>
      <NewListingForkPage />
    </PortalShell>
  );
}
