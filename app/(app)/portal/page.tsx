import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { getPortalAccessState, getPortalEntryHref } from "@/lib/server/portal-access";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const currentUser = await requireCurrentUser();
  const access = await getPortalAccessState(currentUser.id);

  redirect(getPortalEntryHref(access));
}
