import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface PortalListingEditRouteProps {
  params: Promise<{
    listingId: string;
  }>;
}

export default async function PortalListingEditRoute({ params }: PortalListingEditRouteProps) {
  const { listingId } = await params;

  redirect(routes.app.portalListingEdit(listingId));
}
