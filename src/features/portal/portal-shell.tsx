import type { PropsWithChildren } from "react";

import { PortalSectionNav } from "@/components/navigation/portal-section-nav";
import { getPortalNavItems, type PortalAccessState } from "@/lib/server/portal-access";

export function PortalShell({ access, children }: PropsWithChildren<{ access: PortalAccessState }>) {
  return (
    <>
      <PortalSectionNav items={getPortalNavItems(access)} />
      {children}
    </>
  );
}
