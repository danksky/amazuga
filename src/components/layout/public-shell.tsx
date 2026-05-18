import type { PropsWithChildren } from "react";

import { TopNav } from "@/components/navigation/top-nav";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { publicTopNav } from "@/lib/navigation";
import { routes } from "@/lib/routes";

import styles from "./shell.module.css";

export async function PublicShell({ children }: PropsWithChildren) {
  const currentUser = await getCurrentUser();
  const marketingLinks = [...publicTopNav];
  const signedInLinks = currentUser ? [{ label: "Saved", href: routes.app.saved }] : [];

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
