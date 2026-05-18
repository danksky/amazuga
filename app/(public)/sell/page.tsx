import { redirect } from "next/navigation";

import { SellEntryPage } from "@/features/sell/sell-entry-page";
import { getCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    const access = await getPortalAccessState(currentUser.id);

    if (access.primaryPortalHref || access.hasPendingManagerActivation || access.hasApplicationAttention) {
      redirect(getPortalEntryHref(access));
    }
  }

  return <SellEntryPage isSignedIn={Boolean(currentUser)} />;
}
