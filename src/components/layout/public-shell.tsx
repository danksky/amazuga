import type { PropsWithChildren } from "react";

import { TopNav } from "@/components/navigation/top-nav";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { publicTopNav } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";

import styles from "./shell.module.css";

export async function PublicShell({ children }: PropsWithChildren) {
  const currentUser = await getCurrentUser();
  const portalAccess = currentUser ? await getPortalAccessState(currentUser.id) : null;
  const marketingLinks = currentUser
    ? publicTopNav.filter((item) => item.href !== routes.onboarding.advertise)
    : [...publicTopNav];
  const signedInLinks = currentUser
    ? [
        { label: "Saved", href: routes.app.saved },
        ...(portalAccess?.shouldShowApplicationsNav ? [{ label: "Applications", href: routes.onboarding.advertise }] : []),
        ...(portalAccess?.primaryPortalHref && portalAccess.primaryPortalLabel
          ? [{ label: portalAccess.primaryPortalLabel, href: portalAccess.primaryPortalHref }]
          : []),
      ]
    : [];

  return (
    <>
      <TopNav
        currentUser={currentUser}
        isAdmin={isAdminUser(currentUser)}
        marketingLinks={marketingLinks}
        signedInLinks={signedInLinks}
      />
      <main className={styles.main}>{children}</main>
    </>
  );
}
