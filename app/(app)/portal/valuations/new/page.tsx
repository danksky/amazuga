import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

interface PortalValuationSubmissionRouteProps {
  searchParams: Promise<{
    propertyId?: string;
  }>;
}

export default async function PortalValuationSubmissionRoute({ searchParams }: PortalValuationSubmissionRouteProps) {
  const { propertyId } = await searchParams;

  redirect(typeof propertyId === "string" ? `${routes.app.portalValuationNew}?propertyId=${encodeURIComponent(propertyId)}` : routes.app.portalValuationNew);
}
