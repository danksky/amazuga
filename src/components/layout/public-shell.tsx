import type { PropsWithChildren } from "react";

import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/navigation/top-nav";
import { getCurrentUser, isAdminUser, isOtpMode } from "@/lib/auth";
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
        otpMode={isOtpMode()}
        signedInLinks={signedInLinks}
      />
      <main className={styles.main}>{children}</main>
      <Footer />
    </>
  );
}
