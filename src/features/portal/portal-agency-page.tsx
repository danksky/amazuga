import Link from "next/link";

import type { PortalAgencyWorkspaceData } from "@/lib/server/portal-agency";
import { routes } from "@/lib/routes";

import styles from "./portal-agency-page.module.css";

export function PortalAgencyPage({
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
          <h1 className={styles.title}>Agency</h1>
          <div className={styles.body}>
            This area now shows the real Preview-backed agency profile, team roster, and current manager state for the
            agencies {currentUserFirstName} can access.
          </div>
        </div>

        {data.agencies.length > 0 ? (
          data.agencies.map((agency) => (
            <section className={styles.section} key={agency.agencyId}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleWrap}>
                  <h2 className={styles.sectionTitle}>{agency.businessName}</h2>
                  <div className={styles.sectionMeta}>
                    Agency slug `{agency.slug}` with {agency.totalMembers} active member
                    {agency.totalMembers === 1 ? "" : "s"} and {agency.totalListings} listing
                    {agency.totalListings === 1 ? "" : "s"}.
                  </div>
                </div>
                <div className={styles.roleBadge}>
                  {agency.membershipRole === "manager" ? "Manager access" : "Agent access"}
                </div>
              </div>

              <div className={styles.stats}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Members</div>
                  <div className={styles.statValue}>{agency.totalMembers}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Listings</div>
                  <div className={styles.statValue}>{agency.totalListings}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Assigned to you</div>
                  <div className={styles.statValue}>{agency.assignedToUserCount}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Sale / rent</div>
                  <div className={styles.statValue}>
                    {agency.saleListingsCount} / {agency.rentListingsCount}
                  </div>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <h3 className={styles.detailTitle}>Business details</h3>
                  <div className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>TIN</div>
                      <div className={styles.detailValue}>{agency.tin}</div>
                    </div>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>WhatsApp</div>
                      <div className={styles.detailValue}>{agency.whatsappPhone ?? "Not provided"}</div>
                    </div>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>Website</div>
                      <div className={styles.detailValue}>
                        {agency.websiteUrl ? (
                          <a className={styles.link} href={agency.websiteUrl} rel="noreferrer" target="_blank">
                            {agency.websiteUrl}
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    </div>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>Maps listing</div>
                      <div className={styles.detailValue}>
                        {agency.googleMapsUrl ? (
                          <a className={styles.link} href={agency.googleMapsUrl} rel="noreferrer" target="_blank">
                            Open map
                          </a>
                        ) : (
                          "Not provided"
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.detailCard}>
                  <h3 className={styles.detailTitle}>Manager state</h3>
                  <div className={styles.detailList}>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>Active manager</div>
                      <div className={styles.detailValue}>{agency.managerName ?? "No active manager"}</div>
                    </div>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>Pending manager candidate</div>
                      <div className={styles.detailValue}>{agency.pendingManagerName ?? "No pending transfer"}</div>
                    </div>
                    <div className={styles.detailRow}>
                      <div className={styles.detailLabel}>Current access</div>
                      <div className={styles.detailValue}>
                        {agency.membershipRole === "manager"
                          ? "You can review the roster and agency details."
                          : "You can view your agency profile and roster, but manager-only workflows are not built yet."}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={routes.app.portalListings}>
                  Open listings workspace
                </Link>
                <Link className={styles.secondaryAction} href={routes.app.portalAgents}>
                  View full roster
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
                        {member.appRoles.map((role) => (
                          <div className={styles.pill} key={`${member.userId}-${role}`}>
                            {role}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.memberStats}>
                      <div className={styles.memberStat}>
                        <div className={styles.detailLabel}>Listings assigned</div>
                        <div className={styles.detailValue}>{member.listingCount}</div>
                      </div>
                      <div className={styles.memberStat}>
                        <div className={styles.detailLabel}>Roster role</div>
                        <div className={styles.detailValue}>
                          {member.isAgencyManager ? "Manager" : "Agent"}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className={styles.note}>
                Join requests, invitations, and manager transfer actions still need real workflow tables. This page now
                grounds those future tools in actual Preview-backed agency and roster data instead of placeholder copy.
              </div>
            </section>
          ))
        ) : (
          <div className={styles.empty}>
            You do not have active agency access yet, so there is no agency workspace to show here. Return to{" "}
            <Link className={styles.secondaryAction} href={routes.onboarding.advertise}>
              Sell applications
            </Link>{" "}
            or the{" "}
            <Link className={styles.secondaryAction} href={routes.app.portal}>
              portal overview
            </Link>
            .
          </div>
        )}
      </div>
    </div>
  );
}
