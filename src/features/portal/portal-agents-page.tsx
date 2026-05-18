import Link from "next/link";

import type { PortalAgencyWorkspaceData } from "@/lib/server/portal-agency";
import { routes } from "@/lib/routes";

import styles from "./portal-agency-page.module.css";

export function PortalAgentsPage({
  currentUserFirstName,
  data,
}: {
  currentUserFirstName: string;
  data: PortalAgencyWorkspaceData;
}) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Team</h1>
          <div className={styles.body}>
            This roster view makes it clear which members belong to each accessible agency, what role they hold, and how
            current listing assignments are distributed across the team.
          </div>
        </div>

        {data.agencies.length > 0 ? (
          data.agencies.map((agency) => (
            <section className={styles.section} key={agency.agencyId}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleWrap}>
                  <h2 className={styles.sectionTitle}>{agency.businessName}</h2>
                  <div className={styles.sectionMeta}>
                    {agency.totalMembers} active member{agency.totalMembers === 1 ? "" : "s"} visible for {currentUserFirstName}.
                  </div>
                </div>
                <div className={styles.roleBadge}>
                  {agency.membershipRole === "manager" ? "Manager access" : "Agent access"}
                </div>
              </div>

              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={routes.app.portalAgency}>
                  Agency overview
                </Link>
                <Link className={styles.secondaryAction} href={routes.app.portalListings}>
                  Listings workspace
                </Link>
              </div>

              <div className={styles.memberList}>
                {agency.members.map((member) => (
                  <article className={styles.memberCard} key={`${agency.agencyId}-${member.userId}-${member.membershipRole}`}>
                    <div className={styles.memberHeader}>
                      <div className={styles.memberIdentity}>
                        <div className={styles.memberName}>{member.fullName}</div>
                        <div className={styles.memberEmail}>{member.email}</div>
                      </div>
                      <div className={styles.memberPills}>
                        {member.isCurrentUser ? (
                          <div className={`${styles.pill} ${styles.currentUserPill}`}>You</div>
                        ) : null}
                        <div className={styles.pill}>{member.membershipRole}</div>
                      </div>
                    </div>

                    <div className={styles.memberStats}>
                      <div className={styles.memberStat}>
                        <div className={styles.detailLabel}>Assigned listings</div>
                        <div className={styles.detailValue}>{member.listingCount}</div>
                      </div>
                      <div className={styles.memberStat}>
                        <div className={styles.detailLabel}>App roles</div>
                        <div className={styles.detailValue}>{member.appRoles.join(", ")}</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.note}>
                Invite, join-request, and manager-transfer actions are still pending data-model work, but the roster itself
                is now grounded in live Preview membership rows.
              </div>
            </section>
          ))
        ) : (
          <div className={styles.empty}>
            There is no active agency roster to display for this account yet.
          </div>
        )}
      </div>
    </div>
  );
}
