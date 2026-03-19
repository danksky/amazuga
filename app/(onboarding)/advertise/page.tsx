import { redirect } from "next/navigation";

import { AdvertiseChooser } from "@/features/auth/advertise-chooser";
import { readAgencies, readAgencyApplications, readAgentApplications } from "@/lib/data-store";
import { currentUser } from "@/lib/mock-data";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function AdvertisePage() {
  const [agencyApplications, agentApplications, agencies] = await Promise.all([
    readAgencyApplications(),
    readAgentApplications(),
    readAgencies(),
  ]);
  const latestAgencyApplication = [...agencyApplications]
    .reverse()
    .find((application) => application.createdByUserId === currentUser.id);
  const latestAgentApplication = [...agentApplications].reverse().find((application) => application.userId === currentUser.id);

  if (latestAgencyApplication) {
    const linkedAgency = agencies.find((agency) => agency.createdFromApplicationId === latestAgencyApplication.id);
    const canManageAgency =
      latestAgencyApplication.status === "approved" &&
      latestAgentApplication?.status === "approved" &&
      linkedAgency?.managerUserId === currentUser.id;

    if (canManageAgency) {
      redirect(routes.app.portal);
    }

    redirect(routes.onboarding.agencyRegistration(latestAgencyApplication.id));
  }

  return <AdvertiseChooser />;
}
