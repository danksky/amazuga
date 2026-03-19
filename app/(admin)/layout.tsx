import type { PropsWithChildren } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { requireAdminUser } from "@/lib/auth";

export default async function AdminLayout({ children }: PropsWithChildren) {
  await requireAdminUser();
  return <PublicShell>{children}</PublicShell>;
}
