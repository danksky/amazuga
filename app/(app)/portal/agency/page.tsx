import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default function PortalAgencyRoute() {
  redirect(routes.app.portalAgency);
}
