import type { PropsWithChildren } from "react";

import { TopNav } from "@/components/navigation/top-nav";

import styles from "./shell.module.css";

interface PublicShellProps {
  currentPath?: string;
}

export function PublicShell({ children, currentPath }: PropsWithChildren<PublicShellProps>) {
  return (
    <>
      <TopNav currentPath={currentPath} />
      <main className={styles.main}>{children}</main>
    </>
  );
}
