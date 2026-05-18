import { redirect } from "next/navigation";

import { PrivateSalePage } from "@/features/sell/private-sale-page";
import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function SellPrivatePage() {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect(routes.app.portalProperties);
  }

  return <PrivateSalePage isSignedIn={false} />;
}
