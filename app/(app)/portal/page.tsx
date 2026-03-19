import { requireCurrentUser } from "@/lib/auth";
import { PortalOverview } from "@/features/portal/portal-overview";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const currentUser = await requireCurrentUser();
  return <PortalOverview currentUser={currentUser} />;
}
