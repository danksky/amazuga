import Link from "next/link";

import { formatCurrency, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";

import { setListingStatusAction } from "./actions";
import { ListingStatusButton } from "./listing-status-button";
import styles from "./portal-properties-page.module.css";

function getKindLabel(kind: PortalPropertiesWorkspaceData["ownedProperties"][number]["propertyKind"]) {
  if (!kind) return null;
  const labels: Record<NonNullable<typeof kind>, string> = {
    house: "House",
    land: "Land",
    building: "Apartment building",
    apartment_unit: "Apartment unit",
    commercial_unit: "Commercial unit",
    mixed_use: "Mixed use",
    other: "Property",
  };
  return labels[kind];
}

function getClaimScopeLabel(scope: PortalPropertiesWorkspaceData["claimRequests"][number]["claimScope"]) {
  return scope === "unit_partial" ? "Unit or apartment" : "Whole parcel";
}

function getTenureLabel(tenureType: PortalPropertiesWorkspaceData["claimRequests"][number]["tenureType"]) {
  if (tenureType === "freehold") {
    return "Freehold";
  }

  if (tenureType === "emphyteutic_lease") {
    return "Emphyteutic lease";
  }

  return "Unspecified";
}

export function PortalPropertiesPage({
  canCreateListing,
  canManageListingLifecycle,
  claimFeedback,
  claimStatusFilter = "pending",
  data,
}: {
  canCreateListing: boolean;
  canManageListingLifecycle: boolean;
  claimFeedback?: {
    status: "created" | "pending" | "owned" | "no_match" | "unit_required";
    upi?: string;
    claimScope?: "full_parcel" | "unit_partial";
    unitLabel?: string;
    propertyRouteId?: string;
  };
  claimStatusFilter?: "all" | "pending" | "denied";
  data: PortalPropertiesWorkspaceData;
}) {
  const listableCount = data.ownedProperties.filter((property) => !property.listingId).length;
  const pendingCount = data.claimRequests.filter((c) => c.status === "pending").length;
  const deniedCount = data.claimRequests.filter((c) => c.status === "denied").length;
  const filteredClaims =
    claimStatusFilter === "all"
      ? data.claimRequests
      : data.claimRequests.filter((c) => c.status === claimStatusFilter);
  const unitSuffix =
    claimFeedback?.claimScope === "unit_partial" && claimFeedback.unitLabel ? ` (${claimFeedback.unitLabel})` : "";
  const claimFeedbackMessage =
    claimFeedback?.status === "created"
      ? `Claim request submitted for ${claimFeedback.upi}${unitSuffix}. It now appears in Claim status below while admin review is pending.`
      : claimFeedback?.status === "pending"
        ? `You already have a pending claim for ${claimFeedback.upi}${unitSuffix}.`
        : claimFeedback?.status === "owned"
          ? `That property is already in your portfolio.`
          : claimFeedback?.status === "unit_required"
            ? `Enter the apartment or unit identifier before submitting a partial claim for ${claimFeedback.upi}.`
            : claimFeedback?.status === "no_match"
              ? `No Preview parcel matched the UPI ${claimFeedback.upi}.`
              : null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Properties</h1>
          <div className={styles.body}>
            Private sale starts here. Begin from the parcel UPI, optionally describe the apartment or unit you mean,
            and then turn the approved claim into a listing only after the ownership record is unlocked.
          </div>
        </div>

        <div className={styles.pageNav}>
          <a className={styles.pageNavItem} href="#portfolio">Portfolio</a>
          <a className={styles.pageNavItem} href="#claims">Claims</a>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Claim a property by UPI</h2>
            <div className={styles.sectionMeta}>
              Start from the parcel identifier. If you are claiming only one apartment or unit on that parcel, include
              the unit identifier even though our authoritative land data is still parcel-first.
            </div>
          </div>

          <form action={routes.app.portalPropertyClaim} className={styles.claimForm} method="get">
            <label className={styles.field} htmlFor="portal-claim-upi">
              <span className={styles.fieldLabel}>UPI</span>
              <input
                className={styles.textInput}
                defaultValue={claimFeedback?.upi}
                id="portal-claim-upi"
                name="upi"
                placeholder="Enter parcel UPI"
                type="text"
              />
            </label>
            <button className={styles.claimAction} type="submit">
              Continue
            </button>
          </form>

          {claimFeedbackMessage ? (
            <div
              className={`${styles.feedback} ${
                claimFeedback?.status === "no_match" || claimFeedback?.status === "unit_required"
                  ? styles.feedbackWarning
                  : styles.feedbackSuccess
              }`}
            >
              {claimFeedbackMessage}
              {claimFeedback?.propertyRouteId ? (
                <>
                  {" "}
                  <Link href={routes.public.property(claimFeedback.propertyRouteId)}>Open the resolved property page.</Link>
                </>
              ) : null}
            </div>
          ) : null}

          <div className={styles.examplesBlock}>
            <div className={styles.examplesHeader}>
              <h3 className={styles.examplesTitle}>Demo UPIs</h3>
              <div className={styles.examplesMeta}>
                These are ready-to-test parcel examples from Preview. They intentionally foreground UPI and location
                instead of pre-named property titles.
              </div>
            </div>
            {data.claimExamples.length > 0 ? (
              <div className={styles.exampleGrid}>
                {data.claimExamples.map((example) => (
                  <div className={styles.exampleCard} key={example.upi}>
                    <div className={styles.exampleTop}>
                      <div>
                        <div className={styles.exampleUpi}>{example.upi}</div>
                        <div className={styles.exampleMetaLine}>
                          {example.sector ? `${example.sector}, ` : ""}
                          {example.district}
                        </div>
                      </div>
                      <div className={styles.badges}>
                        <div className={styles.badge}>
                          {example.activeListingCount > 0 ? `${example.activeListingCount} active listing` : "Off-market parcel"}
                        </div>
                      </div>
                    </div>
                    <div className={styles.cardMeta}>
                      {example.assetCount === 1 ? "Single known property record on this parcel." : `${example.assetCount} known property records on this parcel.`}
                    </div>
                    <Link
                      className={styles.secondaryAction}
                      href={`${routes.app.portalPropertyClaim}?upi=${encodeURIComponent(example.upi)}`}
                    >
                      Claim this UPI
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>No demo UPIs are available right now.</div>
            )}
          </div>
        </section>

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

        <section className={styles.section} id="portfolio">
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
                  <div className={styles.cardThumbWrap}>
                    {property.firstImageUrl ? (
                      <img alt={property.propertyTitle} className={styles.cardThumb} src={property.firstImageUrl} />
                    ) : (
                      <div className={styles.cardThumbPlaceholder} />
                    )}
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardTop}>
                      <div>
                        <h3 className={styles.cardTitle}>{property.propertyTitle}</h3>
                        <div className={styles.cardMeta}>
                          {property.sector ? `${property.sector}, ` : ""}
                          {property.district}
                        </div>
                      </div>
                      <div className={styles.badges}>
                        {getKindLabel(property.propertyKind) ? (
                          <div className={styles.badge}>{getKindLabel(property.propertyKind)}</div>
                        ) : null}
                        {property.listingId ? (
                          <div className={styles.badge}>{property.listingMarketingType === "rent" ? "For rent" : "For sale"}</div>
                        ) : null}
                        <div className={styles.badge}>{property.listingId ? `Listing ${property.listingStatus}` : "Off-market"}</div>
                      </div>
                    </div>
                    {property.listingId ? (
                      <div className={styles.askingPrice}>
                        {property.listingAskingPrice ? formatCurrency(property.listingAskingPrice, "RWF") : "—"}
                      </div>
                    ) : null}
                    {property.listingAgencyName ? (
                      <div className={styles.detailRow}>
                        <span>Agency</span>
                        <span>{property.listingAgencyName}</span>
                      </div>
                    ) : null}
                    <div className={styles.actions}>
                      <Link className={styles.primaryAction} href={routes.public.property(property.propertyRouteId, property.propertyTitle)}>
                        Open property page
                      </Link>
                      {canCreateListing && property.listingId ? (
                        <Link className={styles.secondaryAction} href={routes.app.portalListingEdit(property.listingId)}>
                          Edit listing
                        </Link>
                      ) : canCreateListing ? (
                        <Link className={styles.secondaryAction} href={`${routes.app.portalListingNew}?property=${encodeURIComponent(property.propertyRouteId)}`}>
                          Create listing
                        </Link>
                      ) : null}
                      {canManageListingLifecycle && property.listingId && property.listingStatus === "draft" ? (
                        <form action={setListingStatusAction}>
                          <input name="listingId" type="hidden" value={property.listingId} />
                          <input name="status" type="hidden" value="active" />
                          <ListingStatusButton
                            className={styles.secondaryAction}
                            currentStatus="draft"
                            disabled={!property.listingAskingPrice || !property.firstImageUrl}
                            nextStatus="active"
                          />
                        </form>
                      ) : canManageListingLifecycle && property.listingId && property.listingStatus === "active" ? (
                        <form action={setListingStatusAction}>
                          <input name="listingId" type="hidden" value={property.listingId} />
                          <input name="status" type="hidden" value="inactive" />
                          <ListingStatusButton
                            className={styles.secondaryAction}
                            currentStatus="active"
                            nextStatus="inactive"
                          />
                        </form>
                      ) : canManageListingLifecycle && property.listingId && property.listingStatus === "inactive" ? (
                        <form action={setListingStatusAction}>
                          <input name="listingId" type="hidden" value={property.listingId} />
                          <input name="status" type="hidden" value="active" />
                          <ListingStatusButton
                            className={styles.secondaryAction}
                            currentStatus="inactive"
                            disabled={!property.firstImageUrl}
                            nextStatus="active"
                          />
                        </form>
                      ) : null}
                    </div>
                    <div className={styles.propertyId}>Property ID: {property.propertyRouteId}</div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              No owned properties yet. Use the UPI claim section above to submit your first claim, then come back here
              after admin approval.
            </div>
          )}
        </section>

        <section className={styles.section} id="claims">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderRow}>
              <div>
                <h2 className={styles.sectionTitle}>Claim status</h2>
                <div className={styles.sectionMeta}>
                  {pendingCount} pending · {deniedCount} denied
                </div>
              </div>
              <div className={styles.filterTabs}>
                <Link
                  className={`${styles.filterTab} ${claimStatusFilter === "all" ? styles.filterTabActive : ""}`}
                  href={`${routes.app.portalProperties}?claims=all`}
                >
                  All
                </Link>
                <Link
                  className={`${styles.filterTab} ${claimStatusFilter === "pending" ? styles.filterTabActive : ""}`}
                  href={`${routes.app.portalProperties}?claims=pending`}
                >
                  Pending
                </Link>
                <Link
                  className={`${styles.filterTab} ${claimStatusFilter === "denied" ? styles.filterTabActive : ""}`}
                  href={`${routes.app.portalProperties}?claims=denied`}
                >
                  Denied
                </Link>
              </div>
            </div>
          </div>
          {data.claimRequests.length > 0 ? (
            <>
              {filteredClaims.length === 0 ? (
                <div className={styles.empty}>No {claimStatusFilter} claims.</div>
              ) : null}
            <div className={styles.cardGrid}>
              {filteredClaims.map((claim) => (
                <article className={styles.card} key={claim.id}>
                  <div className={styles.cardContent}>
                    <div className={styles.cardTop}>
                      <div>
                        <h3 className={styles.cardTitle}>{claim.upi}</h3>
                        <div className={styles.cardMeta}>
                          {claim.sector ? `${claim.sector}, ` : ""}
                          {claim.district}
                          {claim.unitLabel ? ` · Unit ${claim.unitLabel}` : ""}
                        </div>
                      </div>
                      <div className={styles.badges}>
                        <div className={styles.badge}>{claim.status}</div>
                        <div className={styles.badge}>{getClaimScopeLabel(claim.claimScope)}</div>
                      </div>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Submitted</span>
                      <span>{formatDate(claim.createdAt)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Land tenure</span>
                      <span>{getTenureLabel(claim.tenureType)}</span>
                    </div>
                    {claim.propertyRouteId ? (
                      <div className={styles.detailRow}>
                        <span>Property ID</span>
                        <span>{claim.propertyRouteId}</span>
                      </div>
                    ) : null}
                    <div className={styles.actions}>
                      {claim.propertyRouteId ? (
                        <Link className={styles.primaryAction} href={routes.public.property(claim.propertyRouteId, claim.propertyTitle)}>
                          Open property page
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            </>
          ) : (
            <div className={styles.empty}>No open claim requests right now.</div>
          )}
        </section>
      </div>
    </div>
  );
}
