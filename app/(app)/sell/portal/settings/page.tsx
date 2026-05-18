import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function SellPortalSettingsPage() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  return (
    <PortalShell access={access}>
      <PlaceholderPage eyebrow="Sell Portal" title="Settings" description="Workspace settings will live here." />
    </PortalShell>
  );
}
