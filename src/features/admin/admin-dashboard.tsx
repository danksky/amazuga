import Link from "next/link";

import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
  listAgencyApplicationsFromDb,
  listAgentApplicationsFromDb,
  listValuatorApplicationsFromDb,
} from "@/lib/server/workflows";

import styles from "./admin.module.css";

export async function AdminDashboard() {
  const [agencyApplications, agentApplications, valuatorApplications] = await Promise.all([
    listAgencyApplicationsFromDb(),
    listAgentApplicationsFromDb(),
    listValuatorApplicationsFromDb(),
  ]);
  const pendingAgencies = agencyApplications.filter((application) => application.status === "pending");
  const pendingAgents = agentApplications.filter((application) => application.status === "pending");
  const pendingValuators = valuatorApplications.filter((application) => application.status === "pending");

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Admin</div>
          <h1 className={styles.title}>Dashboard</h1>
          <div className={styles.body}>Review pending submissions and move directly into the first moderation queues.</div>
        </div>

        <div className={styles.nav}>
          <Link className={`${styles.navLink} ${styles.active}`} href={routes.admin.dashboard}>
            Dashboard
          </Link>
          <Link className={styles.navLink} href={routes.admin.agencies}>
            Agencies
          </Link>
          <Link className={styles.navLink} href={routes.admin.agents}>
            Agents
          </Link>
          <Link className={styles.navLink} href={routes.admin.valuators}>
            Valuators
          </Link>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending agencies</div>
            <div className={styles.statValue}>{pendingAgencies.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending agents</div>
            <div className={styles.statValue}>{pendingAgents.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending valuators</div>
            <div className={styles.statValue}>{pendingValuators.length}</div>
          </div>
        </div>

        <div className={styles.queues}>
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Agency queue</h2>
            <div className={styles.list}>
              {pendingAgencies.length > 0 ? (
                pendingAgencies.map((application) => (
                  <div className={styles.item} key={application.id}>
                    <div className={styles.itemTitle}>{application.businessName}</div>
                    <div className={styles.itemMeta}>TIN {application.tin}</div>
                    <div className={styles.itemMeta}>Submitted {formatDate(application.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>No pending agency submissions.</div>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Agent queue</h2>
            <div className={styles.list}>
              {pendingAgents.length > 0 ? (
                pendingAgents.map((application) => (
                  <div className={styles.item} key={application.id}>
                    <div className={styles.itemTitle}>{application.userId}</div>
                    <div className={styles.itemMeta}>National ID photo received</div>
                    <div className={styles.itemMeta}>Submitted {formatDate(application.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>No pending agent applications.</div>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Valuator queue</h2>
            <div className={styles.list}>
              {pendingValuators.length > 0 ? (
                pendingValuators.map((application) => (
                  <div className={styles.item} key={application.id}>
                    <div className={styles.itemTitle}>{application.irpvRegistrationNumber}</div>
                    <div className={styles.itemMeta}>Applicant {application.userId}</div>
                    <div className={styles.itemMeta}>Submitted {formatDate(application.createdAt)}</div>
                  </div>
                ))
              ) : (
                <div className={styles.empty}>No pending valuator applications.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
