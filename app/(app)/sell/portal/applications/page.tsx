import { ApplicationsHub } from "@/features/auth/applications-hub";
import { PortalShell } from "@/features/portal/portal-shell";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPortalAccessState } from "@/lib/server/portal-access";
import {
  listAgenciesFromDb,
  listAgencyApplicationsFromDb,
  listAgentApplicationsFromDb,
  listValuatorApplicationsFromDb,
} from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function SellPortalApplicationsPage() {
  const currentUser = await requireCurrentUser(routes.app.portalApplications);
  const access = await getPortalAccessState(currentUser.id);
  const [agencyApplications, agentApplications, valuatorApplications, agencies] = await Promise.all([
    listAgencyApplicationsFromDb(),
    listAgentApplicationsFromDb(),
    listValuatorApplicationsFromDb(),
    listAgenciesFromDb(),
  ]);
  const latestAgencyApplication = [...agencyApplications]
    .reverse()
    .find((application) => application.createdByUserId === currentUser.id);
  const latestAgentApplication = [...agentApplications].reverse().find((application) => application.userId === currentUser.id);
  const latestValuatorApplication = [...valuatorApplications]
    .reverse()
    .find((application) => application.userId === currentUser.id);

  const canManageAgency = agencies.some((agency) => agency.managerUserId === currentUser.id);
  const hasAgencyMembership = agencies.some((agency) => agency.memberUserIds.includes(currentUser.id));
  const canSubmitValuations = latestValuatorApplication?.status === "approved";

  return (
    <PortalShell access={access}>
      <ApplicationsHub
        agencyApplication={latestAgencyApplication}
        agentApplication={latestAgentApplication}
        canManageAgency={canManageAgency}
        canSubmitValuations={Boolean(canSubmitValuations)}
        hasAgencyMembership={hasAgencyMembership}
        valuatorApplication={latestValuatorApplication}
      />
    </PortalShell>
  );
}
