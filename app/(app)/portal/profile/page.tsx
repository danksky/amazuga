import { redirect } from "next/navigation";

import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  if (!access.hasAnyPortalAccess) {
    redirect(getPortalEntryHref(access));
  }

  return (
    <PortalShell access={access}>
      <PlaceholderPage
        eyebrow="Portal"
        title="Profile"
        description="This area will manage public agent and valuator profile information."
      />
    </PortalShell>
  );
}
