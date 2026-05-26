"use client";

import { useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  PortalEditableListing,
  PortalListingAgencyOption,
  PortalListingPropertyOption,
} from "@/lib/server/portal-listing-editor";

import {
  addListingAccessGrantAction,
  removeListingAccessGrantAction,
  setListingStatusAction,
} from "./actions";
import { ListingPhotoManager } from "./listing-photo-manager";
import { ListingStatusButton } from "./listing-status-button";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";
import styles from "./listing-form.module.css";

function getPropertyKindLabel(kind?: string) {
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

function getPropertyDetailsTitle(kind?: string) {
  switch (kind) {
    case "house":
      return "Home details";
    case "land":
      return "Parcel details";
    case "building":
      return "Building details";
    case "apartment_unit":
      return "Unit details";
    case "commercial_unit":
      return "Commercial details";
    default:
      return "Property details";
  }
}

function flattenAgentOptions(agencies: PortalListingAgencyOption[]) {
  return agencies.flatMap((agency) =>
    getUniqueAgencyMembers(agency).map((member) => ({
      agencyId: agency.agencyId,
      agencyName: agency.businessName,
      userId: member.userId,
      fullName: member.fullName,
      membershipRole: member.membershipRole,
    })),
  );
}

function getUniqueAgencyMembers(agency: PortalListingAgencyOption) {
  const membersByUserId = new Map<string, PortalListingAgencyOption["members"][number]>();

  for (const member of agency.members) {
    const current = membersByUserId.get(member.userId);
    if (!current || member.membershipRole === "manager") {
      membersByUserId.set(member.userId, member);
    }
  }

  return Array.from(membersByUserId.values());
}

function groupPriceHistoryByCampaign(priceHistory: PortalEditableListing["priceHistory"]) {
  const groups = new Map<number, PortalEditableListing["priceHistory"]>();

  for (const entry of priceHistory) {
    const currentEntries = groups.get(entry.campaignIndex) ?? [];
    currentEntries.push(entry);
    groups.set(entry.campaignIndex, currentEntries);
  }

  return Array.from(groups.entries()).map(([campaignIndex, entries]) => ({
    campaignIndex,
    entries,
  }));
}

function getListingDetailsTitle(mode: "create" | "edit", status?: PortalEditableListing["status"]) {
  if (mode === "create") {
    return "Draft setup";
  }

  if (status === "draft") {
    return "Listing details";
  }

  return "Manage listing details";
}

export function ListingForm({
  agencies,
  listing,
  cancelHref = routes.app.portalListings,
  mode,
  propertyOptions = [],
  selectedPropertyRouteId,
  submitAction,
  uploadEnabled = false,
}: {
  agencies: PortalListingAgencyOption[];
  cancelHref?: string;
  listing?: PortalEditableListing;
  mode: "create" | "edit";
  propertyOptions?: PortalListingPropertyOption[];
  selectedPropertyRouteId?: string;
  submitAction: (formData: FormData) => void | Promise<void>;
  uploadEnabled?: boolean;
}) {
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [askingPriceHasValue, setAskingPriceHasValue] = useState(Boolean(listing?.askingPrice));
  const [descriptionHasValue, setDescriptionHasValue] = useState(Boolean(listing?.description?.trim()));
  const [photoCount, setPhotoCount] = useState(listing?.images.length ?? 0);

  const isPrivateListerMode = agencies.length === 0;
  const selectedAgency =
    agencies.find((agency) => agency.agencyId === listing?.agencyId) ?? agencies[0];
  const agentAgencies =
    mode === "edit" && selectedAgency ? [selectedAgency] : agencies;
  const flattenedAgents = flattenAgentOptions(agentAgencies);
  const selectedProperty =
    propertyOptions.find((property) => property.propertyRouteId === listing?.propertyRouteId) ??
    propertyOptions.find((property) => property.propertyRouteId === selectedPropertyRouteId) ??
    (listing
      ? {
          propertyAssetId: listing.propertyAssetId,
          propertyRouteId: listing.propertyRouteId,
          propertyTitle: listing.propertyTitle,
          propertyKind: listing.propertyKind,
          district: listing.district,
          sector: listing.sector,
        }
      : propertyOptions[0]);
  const showCreateEmptyState = mode === "create" && propertyOptions.length === 0;
  const canPublish = askingPriceHasValue && descriptionHasValue && photoCount > 0;
  const isManageMode = mode === "edit";
  const priceHistoryGroups = listing ? groupPriceHistoryByCampaign(listing.priceHistory) : [];

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Portal</div>
        <h1 className={styles.title}>{mode === "create" ? "Create listing" : "Manage listing"}</h1>
        <div className={styles.body}>
          {mode === "create"
            ? isPrivateListerMode
              ? "Create a listing for one of your owned, listing-ready properties, then add the market-facing details before publishing."
              : "Create a listing for one of your owned, listing-ready properties, attach it to the right agency and agent, and then finish the publish details in the editor."
            : listing?.status === "draft"
              ? "Manage this draft by adding the market-facing details and photos needed before publishing."
              : "Manage this listing's market-facing details, assignment, and lifecycle while keeping the property record attachment intact."}
        </div>
        {listing ? (
          <div className={styles.submeta}>
            {isManageMode ? "Manage listing mode" : "Create listing mode"}{listing ? ` · Status: ${listing.status}` : ""}
          </div>
        ) : null}
        {showCreateEmptyState ? (
          <div className={styles.emptyState}>
            <div className={styles.notice}>
              You do not have any owned properties that are currently listing-ready and available for a new draft.
            </div>
            <div className={styles.emptyBody}>
              Your owned properties either already have an open listing or draft, or they are still missing upstream
              property details that make them listing-ready. To create another draft, first claim a different property,
              free up an existing listing slot, or complete the property record backfill for the asset.
            </div>
            <div className={styles.actions}>
              <Link href={routes.app.portalProperties}>
                <Button type="button">View owned properties</Button>
              </Link>
              <Link href={cancelHref}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </div>
        ) : null}

        {showCreateEmptyState ? null : (
        <>
        <form action={submitAction} className={styles.form}>
          {listing ? <input name="listingId" type="hidden" value={listing.id} /> : null}

          <section className={styles.formSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{getListingDetailsTitle(mode, listing?.status)}</h2>
              <div className={styles.sectionBody}>
                {mode === "create"
                  ? "Choose the property and representation details that will anchor this draft."
                  : "Manage the market-facing details that belong to this listing."
                }
              </div>
            </div>

            {isPrivateListerMode ? null : (
            <div className={styles.split}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="agency-id">
                  Agency
                </label>
                <select
                  className={styles.select}
                  defaultValue={listing?.agencyId || selectedAgency?.agencyId}
                  disabled={mode === "edit"}
                  id="agency-id"
                  name="agencyId"
                >
                  {agencies.map((agency) => (
                    <option key={agency.agencyId} value={agency.agencyId}>
                      {agency.businessName}
                    </option>
                  ))}
                </select>
                {mode === "edit" ? (
                  <div className={styles.hint}>Agency changes are not part of this first edit flow.</div>
                ) : (
                  <div className={styles.hint}>Choose the agency that should own this listing in the portal.</div>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="agent-user-id">
                  Assigned agent
                </label>
                <select
                  className={styles.select}
                  defaultValue={listing?.agentUserId || flattenedAgents[0]?.userId}
                  id="agent-user-id"
                  name="agentUserId"
                >
                  {agentAgencies.map((agency) => (
                    <optgroup key={agency.agencyId} label={agency.businessName}>
                      {getUniqueAgencyMembers(agency).map((agent) => (
                        <option key={`${agency.agencyId}-${agent.userId}-${agent.membershipRole}`} value={agent.userId}>
                          {agent.fullName}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className={styles.hint}>
                  {mode === "create"
                    ? "Choose an active member of the same agency you selected above."
                    : "Only active members of this listing's agency can be assigned here."}
                </div>
              </div>
            </div>
            )}

            {mode === "create" ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="property-route-id">
                  Property to list
                </label>
                <select
                  className={styles.select}
                  defaultValue={selectedProperty?.propertyRouteId}
                  id="property-route-id"
                  name="propertyRouteId"
                  disabled={propertyOptions.length === 0}
                >
                  {propertyOptions.map((property) => (
                    <option key={property.propertyRouteId} value={property.propertyRouteId}>
                      {property.propertyTitle} - {property.propertyRouteId}
                    </option>
                  ))}
                </select>
                <div className={styles.hint}>
                  This flow only offers owned properties that are listing-ready and do not currently have another open listing or draft.
                </div>
              </div>
            ) : null}

            <div className={styles.split}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="marketing-type">
                  Listing type
                </label>
                <select
                  className={styles.select}
                  defaultValue={listing?.marketingType || "sale"}
                  id="marketing-type"
                  name="marketingType"
                >
                  <option value="sale">For sale</option>
                  <option value="rent">For rent</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="visibility">
                  Visibility
                </label>
                <select
                  className={styles.select}
                  defaultValue={listing?.visibility || "public"}
                  id="visibility"
                  name="visibility"
                >
                  <option value="public">Public — appears in search results</option>
                  <option value="unlisted">Unlisted — viewable by direct link only</option>
                  <option value="private">Private — visible to invited users only</option>
                </select>
              </div>

              {mode === "edit" ? (
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="asking-price">
                    Asking price (RWF)
                  </label>
                  <WheelSafeNumberInput
                    className={`${styles.input}${publishAttempted && !askingPriceHasValue ? ` ${styles.inputError}` : ""}`}
                    defaultValue={listing?.askingPrice}
                    id="asking-price"
                    inputMode="numeric"
                    name="askingPrice"
                    onChange={(e) => setAskingPriceHasValue(Boolean(e.target.value))}
                    placeholder="Example: 185000000"
                    step="1"
                  />
                </div>
              ) : null}
            </div>

            {mode === "edit" ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="description">
                  Description
                </label>
                <textarea
                  className={`${styles.textarea}${publishAttempted && !descriptionHasValue ? ` ${styles.inputError}` : ""}`}
                  defaultValue={listing?.description}
                  id="description"
                  name="description"
                  onChange={(e) => setDescriptionHasValue(Boolean(e.target.value.trim()))}
                  placeholder="Add listing copy, context, and useful details for the public property page."
                />
                <div className={styles.hint}>Price, description, and at least one photo are required before publish.</div>
              </div>
            ) : null}
          </section>

          {selectedProperty ? (
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{getPropertyDetailsTitle(selectedProperty.propertyKind)}</h2>
                <div className={styles.sectionBody}>
                  These details come from the property record and are used in this listing. They are intentionally
                  separate from the market-facing edits you make here.
                </div>
              </div>
              <div className={styles.propertyMeta}>
                <h3 className={styles.propertyMetaTitle}>{selectedProperty.propertyTitle}</h3>
                <div className={styles.propertyMetaBody}>
                  {selectedProperty.sector ? `${selectedProperty.sector}, ` : ""}
                  {selectedProperty.district}. Public route: {selectedProperty.propertyRouteId}
                </div>
                <div className={styles.propertyMetaFacts}>
                  <div className={styles.pill}>{getPropertyKindLabel(selectedProperty.propertyKind)}</div>
                  <div className={styles.pill}>{selectedProperty.propertyRouteId}</div>
                </div>
                <div className={styles.propertyMetaFooter}>
                  <div className={styles.propertyMetaFooterCopy}>
                    <strong>Need a correction?</strong> Property-record correction requests will be added here in a
                    later pass so listing managers can flag issues without editing asset facts directly.
                  </div>
                  <button className={styles.propertyMetaPlaceholderAction} disabled type="button">
                    Request correction
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {mode === "edit" && listing ? (
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Photos</h2>
                <div className={styles.sectionBody}>
                  Add the gallery images that support the listing and unlock publishing.
                </div>
              </div>
              <ListingPhotoManager
                hasError={publishAttempted && photoCount === 0}
                initialImages={listing.images}
                listingId={listing.id}
                onCountChange={setPhotoCount}
                uploadEnabled={uploadEnabled}
              />
            </section>
          ) : mode === "create" ? (
            <div className={styles.notice}>
              Photos come next. This first step creates the listing, then sends you to the full editor to add and
              manage gallery images before publishing.
            </div>
          ) : null}

          {mode === "edit" && listing && listing.priceHistory.length > 0 ? (
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Price history</h2>
                <div className={styles.sectionBody}>
                  Previous asking prices stay grouped by listing campaign.
                </div>
              </div>
              <div className={styles.historySection}>
                <div className={styles.historyGroups}>
                  {priceHistoryGroups.map((group, groupIndex) => (
                    <div key={group.campaignIndex} className={styles.historyCampaign}>
                      <div className={styles.historyCampaignHeader}>
                        <div className={styles.historyCampaignTitle}>Campaign {group.campaignIndex}</div>
                        {groupIndex === 0 ? <span className={styles.historyBadge}>Current</span> : null}
                      </div>
                      <ol className={styles.historyList}>
                        {group.entries.map((entry) => (
                          <li key={entry.id} className={styles.historyItem}>
                            <span className={styles.historyPrice}>{formatCurrency(entry.priceRwf)}</span>
                            <span className={styles.historyDate}>{formatDate(entry.changedAt)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <div className={styles.actions}>
            <Button name="intent" type="submit" value="save">
              {mode === "create" ? "Create listing" : listing?.status === "draft" ? "Save draft" : "Save changes"}
            </Button>
            {mode === "edit" && listing?.status === "draft" ? (
              <>
                <Button
                  name="intent"
                  onClick={(e) => {
                    if (!canPublish) {
                      e.preventDefault();
                      setPublishAttempted(true);
                    }
                  }}
                  type="submit"
                  value="publish"
                >
                  Publish
                </Button>
                <Button name="intent" type="submit" value="discard" variant="secondary">Discard draft</Button>
              </>
            ) : null}
            {mode === "edit" && listing?.status === "active" ? (
              <ListingStatusButton
                className={styles.secondaryAction}
                currentStatus="active"
                formAction={setListingStatusAction}
                nextStatus="inactive"
                submitName="status"
                submitValue="inactive"
              />
            ) : null}
            {mode === "edit" && listing?.status === "inactive" ? (
              <ListingStatusButton
                className={styles.secondaryAction}
                currentStatus="inactive"
                disabled={!canPublish}
                formAction={setListingStatusAction}
                nextStatus="active"
                submitName="status"
                submitValue="active"
              />
            ) : null}
            <Link href={cancelHref}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>

          {mode === "edit" && listing && listing.visibility === "private" ? (
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Private access</h2>
                <div className={styles.sectionBody}>
                  Control who can view this private listing beyond the assigned representative.
                </div>
              </div>
            <div className={styles.grantsSection}>
              <div className={styles.grantsHeader}>
                <h3 className={styles.grantsSectionTitle}>Viewer access</h3>
                <div className={styles.grantsBody}>
                  This listing is private. Only the assigned agent and the people listed below can view it.
                </div>
              </div>
              {listing.accessGrants.length > 0 ? (
                <ul className={styles.grantsList}>
                  {listing.accessGrants.map((grant) => (
                    <li key={grant.id} className={styles.grantsItem}>
                      <div className={styles.grantsItemInfo}>
                        <span className={styles.grantsItemName}>{grant.userName}</span>
                        <span className={styles.grantsItemEmail}>{grant.userEmail}</span>
                      </div>
                      <form action={removeListingAccessGrantAction}>
                        <input type="hidden" name="listingId" value={listing.id} />
                        <input type="hidden" name="grantId" value={grant.id} />
                        <button type="submit" className={styles.grantsRemove}>Remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.grantsEmpty}>No one has been granted access yet.</div>
              )}
              <form action={addListingAccessGrantAction} className={styles.grantsAddForm}>
                <input type="hidden" name="listingId" value={listing.id} />
                <div className={styles.grantsAddRow}>
                  <input
                    className={styles.grantsAddInput}
                    name="email"
                    placeholder="Email address"
                    required
                    type="email"
                  />
                  <button type="submit" className={styles.grantsAddButton}>Grant access</button>
                </div>
              </form>
            </div>
            </section>
          ) : null}
        </>
        )}
      </div>
    </div>
  );
}
