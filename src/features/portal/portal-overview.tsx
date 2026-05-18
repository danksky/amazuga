import Link from "next/link";

import { routes } from "@/lib/routes";
import { listAgenciesFromDb, listAgentApplicationsFromDb, listValuatorApplicationsFromDb } from "@/lib/server/workflows";
import type { User } from "@/types/domain";

import styles from "./portal-overview.module.css";

function getLatestForUser<T extends { userId: string }>(items: T[], userId: string) {
  return [...items].reverse().find((item) => item.userId === userId);
}

export async function PortalOverview({ currentUser }: { currentUser: User }) {
  const [agencies, agentApplications, valuatorApplications] = await Promise.all([
    listAgenciesFromDb(),
    listAgentApplicationsFromDb(),
    listValuatorApplicationsFromDb(),
  ]);

  const activeManagedAgency = agencies.find((agency) => agency.managerUserId === currentUser.id);
  const activeMemberAgency = agencies.find((agency) => agency.memberUserIds.includes(currentUser.id));
  const pendingManagedAgency = agencies.find(
    (agency) => agency.pendingManagerUserId === currentUser.id && agency.managerUserId !== currentUser.id,
  );
  const latestAgentApplication = getLatestForUser(agentApplications, currentUser.id);
  const latestValuatorApplication = getLatestForUser(valuatorApplications, currentUser.id);
  const canManageAgency = Boolean(activeManagedAgency);
  const hasAgentMembership = Boolean(activeMemberAgency) && !canManageAgency;
  const managerBlocked = Boolean(pendingManagedAgency);
  const isApprovedAgent = latestAgentApplication?.status === "approved";
  const isApprovedValuator = latestValuatorApplication?.status === "approved";

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Portal</div>
          <h1 className={styles.title}>Business portal</h1>
          <div className={styles.body}>
            This workspace reflects your current business approvals, including agency management, agent approval, and
            valuator recognition.
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardLabel}>Agency access</div>
            <div className={styles.cardTitle}>
              {canManageAgency
                ? activeManagedAgency?.businessName
                : hasAgentMembership
                  ? activeMemberAgency?.businessName
                : managerBlocked
                  ? pendingManagedAgency?.businessName
                  : "No active agency access"}
            </div>
            <div className={styles.cardBody}>
              {canManageAgency
                ? "Your manager access is active. You can manage the agency in the portal."
                : hasAgentMembership
                  ? "Your agent membership is active. You can work with this agency and its listings in the portal."
                : managerBlocked
                  ? "Your agency has been approved, but manager access is still locked until your agent approval is complete."
                  : "You do not currently have an active agency management role."}
            </div>
            <div className={styles.statusRow}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Agency</span>
                <span className={styles.statusValue}>
                  {canManageAgency || managerBlocked ? "Approved" : "Not active"}
                </span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Access</span>
                <span className={styles.statusValue}>
                  {canManageAgency ? "Manager" : hasAgentMembership ? "Agent" : managerBlocked ? "Locked" : "Unavailable"}
                </span>
              </div>
            </div>
            <div className={styles.actions}>
              {canManageAgency ? (
                <Link className={styles.primaryAction} href={routes.app.portalAgency}>
                  Open agency
                </Link>
              ) : hasAgentMembership ? (
                <Link className={styles.primaryAction} href={routes.app.portalListings}>
                  Open listings
                </Link>
              ) : managerBlocked ? (
                <Link className={styles.primaryAction} href={routes.onboarding.agentApplicationNew}>
                  {isApprovedAgent ? "Back" : "Complete agent approval"}
                </Link>
              ) : (
                <Link className={styles.primaryAction} href={routes.onboarding.advertise}>
                  Open sell options
                </Link>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Agent approval</div>
            <div className={styles.cardTitle}>
              {latestAgentApplication ? `Application ${latestAgentApplication.status}` : "No agent application"}
            </div>
            <div className={styles.cardBody}>
              {latestAgentApplication
                ? latestAgentApplication.status === "approved"
                  ? "Your agent approval is active."
                  : latestAgentApplication.status === "pending"
                    ? "Your agent application is under review."
                    : "Your last agent application was denied."
                : "You have not submitted an agent application yet."}
            </div>
            <div className={styles.actions}>
              <Link
                className={styles.secondaryAction}
                href={
                  latestAgentApplication
                    ? routes.onboarding.agentApplication(latestAgentApplication.id)
                    : routes.onboarding.agentApplicationNew
                }
              >
                {latestAgentApplication ? "View agent application" : "Apply as agent"}
              </Link>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardLabel}>Valuator recognition</div>
            <div className={styles.cardTitle}>
              {latestValuatorApplication ? `Recognition ${latestValuatorApplication.status}` : "No valuator application"}
            </div>
            <div className={styles.cardBody}>
              {latestValuatorApplication
                ? isApprovedValuator
                  ? "You can submit valuations in the portal."
                  : latestValuatorApplication.status === "pending"
                    ? "Your valuator recognition request is under review."
                    : "Your last valuator recognition request was denied."
                : "You have not applied for valuator recognition yet."}
            </div>
            <div className={styles.actions}>
              <Link
                className={styles.secondaryAction}
                href={
                  latestValuatorApplication
                    ? routes.onboarding.valuatorApplication(latestValuatorApplication.id)
                    : routes.onboarding.valuatorApplicationNew
                }
              >
                {latestValuatorApplication ? "View valuator application" : "Apply as valuator"}
              </Link>
              {isApprovedValuator ? (
                <Link className={styles.primaryAction} href={routes.app.portalValuations}>
                  Open valuations
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
