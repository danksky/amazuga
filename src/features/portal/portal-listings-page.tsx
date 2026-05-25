import Link from "next/link";

import { setListingStatusAction } from "@/features/portal/actions";
import { ListingStatusButton } from "@/features/portal/listing-status-button";
import { formatAreaSqm, formatCurrency, formatDate } from "@/lib/format";
import type { PortalListingsWorkspaceData } from "@/lib/server/portal-listings";
import { routes } from "@/lib/routes";

import styles from "./portal-listings-page.module.css";

function buildListingFacts(listing: PortalListingsWorkspaceData["listings"][number]) {
  const facts: string[] = [listing.propertyType];

  if (listing.bedrooms) {
    facts.push(`${listing.bedrooms} bd`);
  }

  if (listing.bathrooms) {
    facts.push(`${listing.bathrooms} ba`);
  }

  if (listing.areaSqm) {
    facts.push(formatAreaSqm(listing.areaSqm));
  }

  return facts.join(" · ");
}

export function PortalListingsPage({
  canCreateListing,
  canEditListing,
  canManageListingLifecycle,
  currentUserFirstName,
  data,
  listingStatusFilter = "active",
}: {
  canCreateListing: boolean;
  canEditListing: boolean;
  canManageListingLifecycle: boolean;
  currentUserFirstName: string;
  data: PortalListingsWorkspaceData;
  listingStatusFilter?: "draft" | "active" | "inactive";
}) {
  const totalListings = data.listings.length;
  const assignedToUserCount = data.listings.filter((listing) => listing.isAssignedToCurrentUser).length;
  const saleCount = data.listings.filter((listing) => listing.marketingType === "sale").length;
  const rentCount = data.listings.filter((listing) => listing.marketingType === "rent").length;
  const allPrivateListerListings = data.listings.filter((listing) => !listing.agencyId);
  const privateListerListings = allPrivateListerListings.filter((l) => l.status === listingStatusFilter);
  const draftCount = allPrivateListerListings.filter((l) => l.status === "draft").length;
  const activeCount = allPrivateListerListings.filter((l) => l.status === "active").length;
  const inactiveCount = allPrivateListerListings.filter((l) => l.status === "inactive").length;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Listings</h1>
          <div className={styles.body}>
            This view shows the listings your current agency access can work with, including which owned properties have
            already been turned into listings, which ones are still drafts, and which listings are assigned directly to{" "}
            {currentUserFirstName}.
          </div>
          {canCreateListing ? (
            <div className={styles.headerActions}>
              <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
                View owned properties
              </Link>
              <Link className={styles.primaryAction} href={routes.app.portalListingNew}>
                Create draft
              </Link>
            </div>
          ) : null}
        </div>

        {data.agencies.length > 0 ? (
          <>
            <div className={styles.stats}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Accessible agencies</div>
                <div className={styles.statValue}>{data.agencies.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Agency listings</div>
                <div className={styles.statValue}>{totalListings}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Assigned to you</div>
                <div className={styles.statValue}>{assignedToUserCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Sale / rent</div>
                <div className={styles.statValue}>
                  {saleCount} / {rentCount}
                </div>
              </div>
            </div>

            {data.agencies.map((agency) => {
              const listings = data.listings.filter((listing) => listing.agencyId === agency.agencyId);

              return (
                <section className={styles.section} key={agency.agencyId}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitleWrap}>
                      <h2 className={styles.sectionTitle}>{agency.businessName}</h2>
                      <div className={styles.sectionMeta}>
                        {agency.totalListings} listing{agency.totalListings === 1 ? "" : "s"} visible here, with{" "}
                        {agency.assignedToUserCount} assigned directly to you.
                      </div>
                    </div>
                    <div className={styles.roleBadge}>{agency.membershipRole === "manager" ? "Manager access" : "Agent access"}</div>
                  </div>

                  {listings.length > 0 ? (
                    <div className={styles.listingGrid}>
                      {listings.map((listing) => (
                        <article className={styles.listingCard} key={listing.id}>
                          <div className={styles.listingTop}>
                            <div className={styles.listingPills}>
                              {listing.isAssignedToCurrentUser ? (
                                <div className={`${styles.pill} ${styles.assignedPill}`}>Assigned to you</div>
                              ) : null}
                              <div className={`${styles.pill} ${listing.marketingType === "rent" ? styles.rentPill : styles.salePill}`}>
                                {listing.marketingType === "rent" ? "For rent" : "For sale"}
                              </div>
                              <div className={`${styles.pill} ${styles.statusPill}`}>{listing.status}</div>
                              <div className={`${styles.pill} ${styles.visibilityPill}`}>{listing.visibility}</div>
                            </div>
                            <div className={styles.listingPrice}>{listing.askingPrice ? formatCurrency(listing.askingPrice, listing.currency) : "—"}</div>
                          </div>

                          <div className={styles.listingBody}>
                            {listing.firstImageUrl ? (
                              <img alt={listing.propertyTitle} className={styles.listingThumb} src={listing.firstImageUrl} />
                            ) : (
                              <div className={styles.listingThumbPlaceholder} />
                            )}
                            <div className={styles.listingBodyContent}>
                              <h3 className={styles.listingTitle}>{listing.propertyTitle}</h3>
                              <div className={styles.listingAddress}>
                                {listing.sector ? `${listing.sector}, ` : ""}{listing.district}
                              </div>
                              <div className={styles.listingFacts}>{buildListingFacts(listing)}</div>
                            </div>
                          </div>

                          <div className={styles.detailGrid}>
                            <div className={styles.detailCard}>
                              <div className={styles.detailLabel}>Location</div>
                              <div className={styles.detailValue}>
                                {listing.sector ? `${listing.sector}, ` : ""}
                                {listing.district}
                              </div>
                            </div>
                            <div className={styles.detailCard}>
                              <div className={styles.detailLabel}>Assigned agent</div>
                              <div className={styles.detailValue}>{listing.agentFullName}</div>
                            </div>
                            <div className={styles.detailCard}>
                              <div className={styles.detailLabel}>Property ID</div>
                              <div className={styles.detailValue}>{listing.propertyId}</div>
                            </div>
                            <div className={styles.detailCard}>
                              <div className={styles.detailLabel}>Last updated</div>
                              <div className={styles.detailValue}>{formatDate(listing.updatedAt)}</div>
                            </div>
                          </div>

                          <div className={styles.listingActions}>
                            <Link
                              className={styles.primaryAction}
                              href={routes.public.property(listing.propertyId, listing.propertyTitle)}
                            >
                              Open property page
                            </Link>
                            {canEditListing ? (
                              <Link className={styles.secondaryAction} href={routes.app.portalListingEdit(listing.id)}>
                                {listing.status === "draft" ? "Continue draft" : "Edit listing"}
                              </Link>
                            ) : null}
                            {canManageListingLifecycle ? (
                              <>
                                {listing.status === "draft" ? null : (
                                  <form action={setListingStatusAction} className={styles.inlineForm}>
                                    <input name="listingId" type="hidden" value={listing.id} />
                                    <input
                                      name="status"
                                      type="hidden"
                                      value={listing.status === "active" ? "inactive" : "active"}
                                    />
                                    <ListingStatusButton
                                      className={styles.secondaryAction}
                                      currentStatus={listing.status}
                                      disabled={listing.status === "inactive" && !listing.firstImageUrl}
                                      nextStatus={listing.status === "active" ? "inactive" : "active"}
                                    />
                                  </form>
                                )}
                              </>
                            ) : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.empty}>This agency does not have any seeded listings attached yet.</div>
                  )}
                </section>
              );
            })}
          </>
        ) : null}

        {allPrivateListerListings.length > 0 ? (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleWrap}>
                <h2 className={styles.sectionTitle}>Your listings</h2>
                <div className={styles.sectionMeta}>
                  {draftCount} draft · {activeCount} active · {inactiveCount} inactive
                </div>
              </div>
              <div className={styles.filterTabs}>
                <Link
                  className={`${styles.filterTab} ${listingStatusFilter === "draft" ? styles.filterTabActive : ""}`}
                  href={`${routes.app.portalListings}?status=draft`}
                >
                  Drafts
                </Link>
                <Link
                  className={`${styles.filterTab} ${listingStatusFilter === "active" ? styles.filterTabActive : ""}`}
                  href={routes.app.portalListings}
                >
                  Active
                </Link>
                <Link
                  className={`${styles.filterTab} ${listingStatusFilter === "inactive" ? styles.filterTabActive : ""}`}
                  href={`${routes.app.portalListings}?status=inactive`}
                >
                  Inactive
                </Link>
              </div>
            </div>
            {privateListerListings.length === 0 ? (
              <div className={styles.empty}>No {listingStatusFilter} listings.</div>
            ) : null}
            <div className={styles.listingGrid}>
              {privateListerListings.map((listing) => (
                <article className={styles.listingCard} key={listing.id}>
                  <div className={styles.listingTop}>
                    <div className={styles.listingPills}>
                      <div className={`${styles.pill} ${listing.marketingType === "rent" ? styles.rentPill : styles.salePill}`}>
                        {listing.marketingType === "rent" ? "For rent" : "For sale"}
                      </div>
                    <div className={`${styles.pill} ${styles.statusPill}`}>{listing.status}</div>
                    <div className={`${styles.pill} ${styles.visibilityPill}`}>{listing.visibility}</div>
                    </div>
                    <div className={styles.listingPrice}>{listing.askingPrice ? formatCurrency(listing.askingPrice, listing.currency) : "—"}</div>
                  </div>

                  <div className={styles.listingBody}>
                    {listing.firstImageUrl ? (
                      <img alt={listing.propertyTitle} className={styles.listingThumb} src={listing.firstImageUrl} />
                    ) : (
                      <div className={styles.listingThumbPlaceholder} />
                    )}
                    <div className={styles.listingBodyContent}>
                      <h3 className={styles.listingTitle}>{listing.propertyTitle}</h3>
                      <div className={styles.listingAddress}>
                        {listing.sector ? `${listing.sector}, ` : ""}{listing.district}
                      </div>
                      <div className={styles.listingFacts}>{buildListingFacts(listing)}</div>
                    </div>
                  </div>

                  <div className={styles.detailGrid}>
                    <div className={styles.detailCard}>
                      <div className={styles.detailLabel}>Location</div>
                      <div className={styles.detailValue}>
                        {listing.sector ? `${listing.sector}, ` : ""}
                        {listing.district}
                      </div>
                    </div>
                    <div className={styles.detailCard}>
                      <div className={styles.detailLabel}>Property ID</div>
                      <div className={styles.detailValue}>{listing.propertyId}</div>
                    </div>
                    <div className={styles.detailCard}>
                      <div className={styles.detailLabel}>Last updated</div>
                      <div className={styles.detailValue}>{formatDate(listing.updatedAt)}</div>
                    </div>
                  </div>

                  <div className={styles.listingActions}>
                    <Link
                      className={styles.primaryAction}
                      href={routes.public.property(listing.propertyId, listing.propertyTitle)}
                    >
                      Open property page
                    </Link>
                    {canEditListing ? (
                      <Link className={styles.secondaryAction} href={routes.app.portalListingEdit(listing.id)}>
                        {listing.status === "draft" ? "Continue draft" : "Edit listing"}
                      </Link>
                    ) : null}
                    {canManageListingLifecycle ? (
                      <>
                        {listing.status === "draft" ? null : (
                          <form action={setListingStatusAction} className={styles.inlineForm}>
                            <input name="listingId" type="hidden" value={listing.id} />
                            <input
                              name="status"
                              type="hidden"
                              value={listing.status === "active" ? "inactive" : "active"}
                            />
                            <ListingStatusButton
                              className={styles.secondaryAction}
                              currentStatus={listing.status}
                              disabled={listing.status === "inactive" && !listing.firstImageUrl}
                              nextStatus={listing.status === "active" ? "inactive" : "active"}
                            />
                          </form>
                        )}
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : data.agencies.length === 0 ? (
          <div className={styles.empty}>
            You do not have any active listings yet.{" "}
            {canCreateListing ? (
              <>
                <Link className={styles.secondaryAction} href={routes.app.portalListingNew}>
                  Create your first listing
                </Link>{" "}
                from one of your owned properties.
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
