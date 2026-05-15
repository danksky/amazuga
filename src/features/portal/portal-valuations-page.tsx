import Link from "next/link";

import { formatCurrency, formatDate } from "@/lib/format";
import type { PortalValuationsWorkspaceData } from "@/lib/server/portal-valuations";
import { routes } from "@/lib/routes";

import styles from "./portal-valuations-page.module.css";

function getPropertyKindLabel(kind: PortalValuationsWorkspaceData["properties"][number]["propertyKind"]) {
  switch (kind) {
    case "house":
      return "House";
    case "land":
      return "Parcel";
    case "building":
      return "Building";
    case "apartment_unit":
      return "Apartment";
    case "commercial_unit":
      return "Commercial";
    case "mixed_use":
      return "Mixed use";
    case "other":
      return "Other";
    default:
      return "Property";
  }
}

function getStatusClassName(status: PortalValuationsWorkspaceData["submissions"][number]["status"]) {
  switch (status) {
    case "approved":
      return styles.approvedPill;
    case "pending":
      return styles.pendingPill;
    case "denied":
      return styles.deniedPill;
    default:
      return "";
  }
}

export function PortalValuationsPage({ data }: { data: PortalValuationsWorkspaceData }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>Portal</div>
          <h1 className={styles.title}>Valuations workspace</h1>
          <div className={styles.body}>
            This workspace shows the Preview-backed valuation history attached to your account, grouped by property so it is
            easier to review estimates, visibility, and the public pages those records support.
          </div>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href={routes.app.portalValuationNew}>
              Submit valuation
            </Link>
            <Link className={styles.secondaryAction} href={routes.public.buy}>
              Browse properties
            </Link>
          </div>
        </section>

        <section className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Submissions</div>
            <div className={styles.statValue}>{data.totalSubmissions}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Properties valued</div>
            <div className={styles.statValue}>{data.properties.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approved</div>
            <div className={styles.statValue}>{data.approvedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending / denied</div>
            <div className={styles.statValue}>
              {data.pendingCount} / {data.deniedCount}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Anonymous</div>
            <div className={styles.statValue}>{data.anonymousCount}</div>
          </div>
        </section>

        {data.properties.length > 0 ? (
          data.properties.map((property) => (
            <section className={styles.section} key={property.propertyId}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleWrap}>
                  <h2 className={styles.sectionTitle}>{property.propertyTitle}</h2>
                  <div className={styles.sectionMeta}>
                    {property.sector ? `${property.sector}, ` : ""}
                    {property.district}. {property.submissions.length} valuation{submissionsSuffix(property.submissions.length)} recorded
                    for this property.
                  </div>
                </div>
                <div className={styles.propertyPills}>
                  <div className={styles.pill}>{getPropertyKindLabel(property.propertyKind)}</div>
                  <div className={styles.pill}>
                    {property.listingId
                      ? property.listingMarketingType === "rent"
                        ? "Currently listed for rent"
                        : "Currently listed for sale"
                      : "No active listing"}
                  </div>
                </div>
              </div>

              <div className={styles.detailGrid}>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Latest estimate</div>
                  <div className={styles.detailValue}>{formatCurrency(property.latestEstimatedValue, property.currency)}</div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Effective date</div>
                  <div className={styles.detailValue}>{formatDate(property.latestEffectiveDate)}</div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Current ask</div>
                  <div className={styles.detailValue}>
                    {property.askingPrice ? formatCurrency(property.askingPrice, property.currency) : "No active listing"}
                  </div>
                </div>
                <div className={styles.detailCard}>
                  <div className={styles.detailLabel}>Public page</div>
                  <div className={styles.detailValue}>{property.propertyId}</div>
                </div>
              </div>

              <div className={styles.submissions}>
                {property.submissions.map((submission) => (
                  <article className={styles.submissionCard} key={submission.id}>
                    <div className={styles.submissionTop}>
                      <div className={styles.submissionTopLeft}>
                        <div className={styles.submissionEstimate}>
                          {formatCurrency(submission.estimatedValue, submission.currency)}
                        </div>
                        <div className={styles.submissionMeta}>
                          Effective {formatDate(submission.effectiveDate)}. Recorded {formatDate(submission.createdAt)}.
                        </div>
                      </div>
                      <div className={styles.submissionPills}>
                        <div className={`${styles.pill} ${getStatusClassName(submission.status)}`}>{submission.status}</div>
                        <div className={styles.pill}>{submission.isAnonymous ? "Anonymous" : "Named valuator"}</div>
                        <div className={styles.pill}>{submission.id}</div>
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <Link
                        className={styles.primaryAction}
                        href={`${routes.app.portalValuationNew}?propertyId=${encodeURIComponent(submission.propertyId)}`}
                      >
                        Value this property
                      </Link>
                      <Link className={styles.secondaryAction} href={routes.public.property(submission.propertyId)}>
                        Open property page
                      </Link>
                      <Link className={styles.secondaryAction} href={routes.public.buy}>
                        Browse more properties
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>No valuation history yet</h2>
            <div className={styles.emptyBody}>
              Your valuator recognition is active, but there are no Preview-backed valuation submissions attached to this
              account yet. Once records exist, they will appear here with property links and approval status.
            </div>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href={routes.app.portalValuationNew}>
                Submit first valuation
              </Link>
              <Link className={styles.secondaryAction} href={routes.public.buy}>
                Browse properties
              </Link>
            </div>
          </section>
        )}

        <div className={styles.note}>
          Admin review is still the next layer to build. This page now makes the Preview-backed valuator persona testable as
          both a history workspace and a live submission entry point.
        </div>
      </div>
    </div>
  );
}

function submissionsSuffix(count: number) {
  return count === 1 ? "" : "s";
}
