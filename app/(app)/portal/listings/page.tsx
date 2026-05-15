import { PortalListingsPage } from "@/features/portal/portal-listings-page";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalListingsWorkspaceData } from "@/lib/server/portal-listings";

export const dynamic = "force-dynamic";

export default async function PortalListingsRoute() {
  const currentUser = await requireCurrentUser();
  const data = await getPortalListingsWorkspaceData(currentUser.id);

  return (
    <PortalListingsPage
      currentUserFirstName={currentUser.fullName.split(" ")[0] ?? currentUser.fullName}
      data={data}
    />
  );
}
