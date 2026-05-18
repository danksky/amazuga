import { PrivateSalePage } from "@/features/sell/private-sale-page";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SellPrivatePage() {
  const currentUser = await getCurrentUser();

  return <PrivateSalePage isSignedIn={Boolean(currentUser)} />;
}
