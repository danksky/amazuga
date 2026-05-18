import Link from "next/link";

import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";

import styles from "./portal-properties-page.module.css";

function getScopeLabel(scope: PortalPropertiesWorkspaceData["ownedProperties"][number]["ownershipScope"]) {
  return scope === "unit" ? "Unit ownership" : "Full property ownership";
}

export function PortalPropertiesPage({
  canCreateListing,
  data,
}: {
  canCreateListing: boolean;
  data: PortalPropertiesWorkspaceData;
}) {
  const listableCount = data.ownedProperties.filter((property) => !property.listingId).length;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Properties</h1>
          <div className={styles.body}>
            Claiming is now the first step. Once a property claim is approved, it appears here as something your account
            owns, whether you decide to list it or keep it off-market.
          </div>
          {canCreateListing ? (
            <div className={styles.actions}>
              <Link className={styles.secondaryAction} href={routes.app.portalListings}>
                View listings
              </Link>
            </div>
          ) : null}
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Owned properties</div>
            <div className={styles.statValue}>{data.ownedProperties.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Listable now</div>
            <div className={styles.statValue}>{listableCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending claims</div>
            <div className={styles.statValue}>{data.claimRequests.filter((claim) => claim.status === "pending").length}</div>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Portfolio</h2>
            <div className={styles.sectionMeta}>
              These are the properties your account can treat as owned in Amazuga right now.
            </div>
          </div>
          {data.ownedProperties.length > 0 ? (
            <div className={styles.cardGrid}>
              {data.ownedProperties.map((property) => (
                <article className={styles.card} key={property.ownershipId}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3 className={styles.cardTitle}>{property.propertyTitle}</h3>
                      <div className={styles.cardMeta}>
                        {property.sector ? `${property.sector}, ` : ""}
                        {property.district}
                      </div>
                    </div>
                    <div className={styles.badges}>
                      <div className={styles.badge}>{getScopeLabel(property.ownershipScope)}</div>
                      <div className={styles.badge}>{property.listingId ? `Listing ${property.listingStatus}` : "Off-market"}</div>
                    </div>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Claim activated</span>
                    <span>{formatDate(property.createdAt)}</span>
                  </div>
                  {property.listingAgencyName ? (
                    <div className={styles.detailRow}>
                      <span>Current listing agency</span>
                      <span>{property.listingAgencyName}</span>
                    </div>
                  ) : null}
                  <div className={styles.actions}>
                    <Link className={styles.primaryAction} href={routes.public.property(property.propertyRouteId, property.propertyTitle)}>
                      Open property page
                    </Link>
                    {canCreateListing && !property.listingId ? (
                      <Link
                        className={styles.secondaryAction}
                        href={`${routes.app.portalListingNew}?property=${encodeURIComponent(property.propertyRouteId)}`}
                      >
                        Create listing
                      </Link>
                    ) : null}
                    {property.listingId ? (
                      <Link className={styles.secondaryAction} href={routes.app.portalListings}>
                        Open listings workspace
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              No owned properties yet. Start by claiming a property from its public page, then come back here after the
              claim is approved.
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Claim status</h2>
            <div className={styles.sectionMeta}>Pending and denied claim requests stay visible here.</div>
          </div>
          {data.claimRequests.length > 0 ? (
            <div className={styles.cardGrid}>
              {data.claimRequests.map((claim) => (
                <article className={styles.card} key={claim.id}>
                  <div className={styles.cardTop}>
                    <div>
                      <h3 className={styles.cardTitle}>{claim.propertyTitle}</h3>
                      <div className={styles.cardMeta}>
                        {claim.sector ? `${claim.sector}, ` : ""}
                        {claim.district}
                      </div>
                    </div>
                    <div className={styles.badges}>
                      <div className={styles.badge}>{claim.status}</div>
                    </div>
                  </div>
                  <div className={styles.detailRow}>
                    <span>Submitted</span>
                    <span>{formatDate(claim.createdAt)}</span>
                  </div>
                  <div className={styles.actions}>
                    <Link className={styles.primaryAction} href={routes.public.property(claim.propertyRouteId, claim.propertyTitle)}>
                      Open property page
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>No open claim requests right now.</div>
          )}
        </section>
      </div>
    </div>
  );
}
