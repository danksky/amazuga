import type { PropsWithChildren } from "react";

import { TopNav } from "@/components/navigation/top-nav";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

import styles from "./shell.module.css";

interface PublicShellProps {
  currentPath?: string;
}

export async function PublicShell({ children, currentPath }: PropsWithChildren<PublicShellProps>) {
  const currentUser = await getCurrentUser();

  return (
    <>
      <TopNav currentPath={currentPath} currentUser={currentUser} isAdmin={isAdminUser(currentUser)} />
      <main className={styles.main}>{children}</main>
    </>
  );
}
