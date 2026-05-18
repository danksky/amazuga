import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PortalListingCreateRoute({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const { property } = await searchParams;

  redirect(typeof property === "string" ? `${routes.app.portalListingNew}?property=${encodeURIComponent(property)}` : routes.app.portalListingNew);
}
