"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import Link from "next/link";

import { formatCurrency, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PortalPropertiesWorkspaceData } from "@/lib/server/portal-properties";

import { respondToOwnershipTransferAction, setListingStatusAction } from "./actions";
import { ListingStatusButton } from "./listing-status-button";
import styles from "./portal-properties-page.module.css";

const UPI_PATTERN = /^[1-5]\/\d{2}\/\d{2}\/\d{2}\/\d+$/;
const UPI_EXAMPLE = "1/03/08/06/7889999";

function formatUpiInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const segmentLengths = [1, 2, 2, 2];
  const segments: string[] = [];
  let cursor = 0;

  for (const length of segmentLengths) {
    const segment = digits.slice(cursor, cursor + length);
    if (!segment) {
      break;
    }

    segments.push(segment);
    cursor += segment.length;

    if (segment.length < length) {
      break;
    }
  }

  const parcelNumber = digits.slice(cursor);
  if (parcelNumber) {
    segments.push(parcelNumber);
  }

  return segments.join("/");
}

function getUpiGuidance(value: string, hasInvalidCharacters: boolean) {
  if (!value) {
    return {
      state: "info" as const,
      message: `Format: ${UPI_EXAMPLE}`,
    };
  }

  if (hasInvalidCharacters) {
    return {
      state: "invalid" as const,
      message: "Use numbers only. Slashes appear automatically as you type.",
    };
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return {
      state: "info" as const,
      message: `Format: ${UPI_EXAMPLE}`,
    };
  }

  const provinceCode = digits[0];
  if (!/[1-5]/.test(provinceCode)) {
    return {
      state: "invalid" as const,
      message: "UPI codes start with 1, 2, 3, 4, or 5 for the province or Kigali City code.",
    };
  }

  if (digits.length === 1) {
    return {
      state: "info" as const,
      message: `UPI codes start with ${provinceCode}/ and continue as district, sector, cell, and parcel number.`,
    };
  }

  if (digits.length < 7) {
    return {
      state: "info" as const,
      message: "Keep going: UPI format is P/DD/SS/CC/parcel-number.",
    };
  }

  if (digits.length === 7) {
    return {
      state: "info" as const,
      message: "Add the parcel number after the cell code to complete the UPI.",
    };
  }

  if (!UPI_PATTERN.test(value)) {
    return {
      state: "invalid" as const,
      message: `Use the format ${UPI_EXAMPLE}.`,
    };
  }

  return {
    state: "valid" as const,
    message: "UPI format looks valid.",
  };
}

function UpiClaimForm({ defaultUpi }: { defaultUpi?: string }) {
  const [upiInput, setUpiInput] = useState(() => formatUpiInput(defaultUpi ?? ""));
  const [upiHasInvalidCharacters, setUpiHasInvalidCharacters] = useState(false);
  const upiGuidance = getUpiGuidance(upiInput, upiHasInvalidCharacters);

  return (
    <form action={routes.app.portalPropertyClaim} className={styles.claimForm} method="get">
      <label className={styles.field} htmlFor="portal-claim-upi">
        <span className={styles.fieldLabel}>UPI</span>
        <input
          aria-describedby="portal-claim-upi-hint"
          aria-invalid={upiGuidance.state === "invalid" ? true : undefined}
          autoComplete="off"
          className={styles.textInput}
          id="portal-claim-upi"
          inputMode="numeric"
          name="upi"
          onChange={(event) => {
            setUpiHasInvalidCharacters(/[^0-9/\s]/.test(event.target.value));
            setUpiInput(formatUpiInput(event.target.value));
          }}
          pattern="[1-5]/\d{2}/\d{2}/\d{2}/\d+"
          placeholder={UPI_EXAMPLE}
          required
          title={`Use the format ${UPI_EXAMPLE}`}
          type="text"
          value={upiInput}
        />
        <span
          className={`${styles.fieldHint} ${
            upiGuidance.state === "invalid"
              ? styles.fieldHintWarning
              : upiGuidance.state === "valid"
                ? styles.fieldHintSuccess
                : ""
          }`}
          id="portal-claim-upi-hint"
        >
          {upiGuidance.message}
        </span>
      </label>
      <button className={styles.claimAction} type="submit">
        Continue
      </button>
    </form>
  );
}

function getKindLabel(kind: PortalPropertiesWorkspaceData["ownedProperties"][number]["propertyKind"]) {
  if (!kind) return null;
  const labels: Record<NonNullable<typeof kind>, string> = {
    house: "House",
    land: "Land",
    apartment_building: "Apartment building",
    commercial_building: "Commercial building",
    apartment_unit: "Apartment unit",
    commercial_unit: "Commercial unit",
  };
  return labels[kind];
}

function getVisibilityLabel(visibility: PortalPropertiesWorkspaceData["ownedProperties"][number]["listingVisibility"]) {
  if (visibility === "unlisted") return "Unlisted";
  if (visibility === "private") return "Private";
  return "Public";
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

function OwnedPropertyActionMenu({
  buttonClassName,
  children,
  menuClassName,
  triggerClassName,
}: {
  buttonClassName: string;
  children: ReactNode;
  menuClassName: string;
  triggerClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={triggerClassName} ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClassName}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" className={styles.actionMenuDots}>
          <span />
          <span />
          <span />
        </span>
      </button>
      {open ? (
        <div className={menuClassName} role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function PortalPropertiesPage({
  canCreateListing,
  canManageListingLifecycle,
  claimFeedback,
  claimStatusFilter = "pending",
  data,
  transferFeedback,
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
  transferFeedback?: {
    status: "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner" | "accepted" | "declined";
    propertyRouteId?: string;
    buyerEmail?: string;
  };
}) {
  const listableCount = data.ownedProperties.filter((property) => !property.listingId && property.isListingReady).length;
  const blockedCount = data.ownedProperties.filter((property) => !property.listingId && !property.isListingReady).length;
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
  const transferFeedbackMessage =
    transferFeedback?.status === "created"
      ? `Transfer request sent to ${transferFeedback.buyerEmail || "the buyer"}. They need to accept before admin can approve it.`
      : transferFeedback?.status === "existing_pending"
        ? "There is already an open transfer request for this property."
        : transferFeedback?.status === "buyer_not_found"
          ? `No active Amazuga account exists yet for ${transferFeedback.buyerEmail || "that email address"}.`
          : transferFeedback?.status === "self"
            ? "You cannot transfer a property to yourself."
            : transferFeedback?.status === "not_owner"
              ? "This transfer could not be created because the property is no longer owned by your account."
              : transferFeedback?.status === "accepted"
                ? "Transfer accepted. It now waits for admin approval."
                : transferFeedback?.status === "declined"
                  ? "Transfer declined."
                  : null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Properties</h1>
          <div className={styles.body}>
            Private sale starts here. Begin from the parcel UPI, optionally describe the apartment or unit you mean,
            and then turn the approved claim into a listing only after the ownership record is unlocked and the asset
            is listing-ready.
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

          <UpiClaimForm defaultUpi={claimFeedback?.upi} key={claimFeedback?.upi ?? "blank"} />

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

          {transferFeedbackMessage ? (
            <div
              className={`${styles.feedback} ${
                transferFeedback?.status === "buyer_not_found" ||
                transferFeedback?.status === "self" ||
                transferFeedback?.status === "not_owner"
                  ? styles.feedbackWarning
                  : styles.feedbackSuccess
              }`}
            >
              {transferFeedbackMessage}
              {transferFeedback?.propertyRouteId ? (
                <>
                  {" "}
                  <Link href={routes.public.property(transferFeedback.propertyRouteId)}>Open the resolved property page.</Link>
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
            <div className={styles.statLabel}>Ready to draft</div>
            <div className={styles.statValue}>{listableCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Waiting on record completion</div>
            <div className={styles.statValue}>{blockedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Pending claims</div>
            <div className={styles.statValue}>{pendingCount}</div>
          </div>
        </div>

        <section className={styles.section} id="portfolio">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Portfolio</h2>
            <div className={styles.sectionMeta}>
              These are the properties your account can treat as owned in Amazuga right now. {listableCount} can start a
              draft immediately{blockedCount > 0 ? `, while ${blockedCount} still need required property-record details first.` : "."}
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
                        <div
                          className={`${styles.badge} ${
                            !property.listingId && property.isListingReady
                              ? styles.badgeReady
                              : !property.listingId
                                ? styles.badgeBlocked
                                : ""
                          }`}
                        >
                          {property.listingId
                            ? `Listing ${property.listingStatus}`
                            : property.isListingReady
                              ? "Listing-ready"
                              : "Needs record backfill"}
                        </div>
                        {property.listingId ? (
                          <div className={styles.badge}>{getVisibilityLabel(property.listingVisibility)}</div>
                        ) : null}
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
                    {!property.listingId && !property.isListingReady ? (
                      <div className={styles.readinessNote}>
                        This owned property still needs required property-record details before you can start a draft
                        listing from it. Complete the property details first, then come back here to create the draft.
                      </div>
                    ) : null}
                    <div className={styles.actions}>
                      <OwnedPropertyActionMenu
                        buttonClassName={`${styles.secondaryAction} ${styles.actionMenuButton}`}
                        menuClassName={styles.actionMenuPopover}
                        triggerClassName={styles.actionMenu}
                      >
                          <Link className={styles.actionMenuItem} href={routes.public.property(property.propertyRouteId, property.propertyTitle)}>
                            Open property page
                          </Link>
                          <Link className={styles.actionMenuItem} href={routes.app.portalPropertyEdit(property.propertyRouteId)}>
                            {property.isListingReady ? "Edit property details" : "Complete property details"}
                          </Link>
                          {canCreateListing && property.listingId ? (
                            <Link className={styles.actionMenuItem} href={routes.app.portalListingEdit(property.listingId)}>
                              {property.listingStatus === "draft" ? "Continue draft" : "Edit listing"}
                            </Link>
                          ) : canCreateListing && property.isListingReady ? (
                            <Link className={styles.actionMenuItem} href={`${routes.app.portalListingNew}?property=${encodeURIComponent(property.propertyRouteId)}`}>
                              Create listing
                            </Link>
                          ) : null}
                          {canManageListingLifecycle && property.listingId && property.listingStatus === "active" ? (
                            <form action={setListingStatusAction}>
                              <input name="listingId" type="hidden" value={property.listingId} />
                              <input name="status" type="hidden" value="inactive" />
                              <ListingStatusButton
                                className={styles.actionMenuButton}
                                currentStatus="active"
                                nextStatus="inactive"
                              />
                            </form>
                          ) : canManageListingLifecycle && property.listingId && property.listingStatus === "inactive" ? (
                            <form action={setListingStatusAction}>
                              <input name="listingId" type="hidden" value={property.listingId} />
                              <input name="status" type="hidden" value="active" />
                              <ListingStatusButton
                                className={styles.actionMenuButton}
                                currentStatus="inactive"
                                disabled={!property.listingAskingPrice || !property.firstImageUrl}
                                nextStatus="active"
                              />
                            </form>
                          ) : null}
                          <Link className={styles.actionMenuItem} href={routes.app.portalPropertyTransfer(property.propertyRouteId)}>
                            Transfer / sell
                          </Link>
                      </OwnedPropertyActionMenu>
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
                <h2 className={styles.sectionTitle}>Claim and transfer status</h2>
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
                <div className={styles.empty}>No {claimStatusFilter} claims or transfers.</div>
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
                        <div className={styles.badge}>{claim.kind === "transfer" ? "Transfer" : "Claim"}</div>
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
                    {claim.kind === "transfer" ? (
                      <div className={styles.detailRow}>
                        <span>Current owner</span>
                        <span>{claim.transferFromUserName || "Unknown owner"}</span>
                      </div>
                    ) : null}
                    {claim.kind === "transfer" ? (
                      <div className={styles.detailRow}>
                        <span>Type</span>
                        <span>{claim.transferMode === "sale" ? "Sale" : "Transfer"}</span>
                      </div>
                    ) : null}
                    {claim.kind === "transfer" ? (
                      <div className={styles.detailRow}>
                        <span>Buyer response</span>
                        <span>{claim.buyerConfirmedAt ? "Accepted" : "Awaiting response"}</span>
                      </div>
                    ) : null}
                    {claim.propertyRouteId ? (
                      <div className={styles.detailRow}>
                        <span>Property ID</span>
                        <span>{claim.propertyRouteId}</span>
                      </div>
                    ) : null}
                    {claim.kind === "transfer" && claim.transferNote ? (
                      <div className={styles.transferNote}>{claim.transferNote}</div>
                    ) : null}
                    <div className={styles.actions}>
                      {claim.propertyRouteId ? (
                        <Link className={styles.primaryAction} href={routes.public.property(claim.propertyRouteId, claim.propertyTitle)}>
                          Open property page
                        </Link>
                      ) : null}
                      {claim.kind === "transfer" && claim.status === "pending" && !claim.buyerConfirmedAt ? (
                        <>
                          <form action={respondToOwnershipTransferAction}>
                            <input name="claimId" type="hidden" value={claim.id} />
                            <input name="decision" type="hidden" value="accept" />
                            <input name="propertyRouteId" type="hidden" value={claim.propertyRouteId || ""} />
                            <button className={styles.secondaryAction} type="submit">
                              Accept transfer
                            </button>
                          </form>
                          <form action={respondToOwnershipTransferAction}>
                            <input name="claimId" type="hidden" value={claim.id} />
                            <input name="decision" type="hidden" value="decline" />
                            <input name="propertyRouteId" type="hidden" value={claim.propertyRouteId || ""} />
                            <button className={styles.secondaryAction} type="submit">
                              Decline transfer
                            </button>
                          </form>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            </>
          ) : (
            <div className={styles.empty}>No open claim requests or transfers right now.</div>
          )}
        </section>
      </div>
    </div>
  );
}
