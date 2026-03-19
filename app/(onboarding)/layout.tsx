import type { PropsWithChildren } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { requireCurrentUser } from "@/lib/auth";

export default async function OnboardingLayout({ children }: PropsWithChildren) {
  await requireCurrentUser();
  return <PublicShell>{children}</PublicShell>;
}
