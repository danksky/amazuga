"use client";

import { useState } from "react";
import Link from "next/link";

import { PropertyParcelMap } from "@/components/maps/property-parcel-map";
import { createPropertyClaimRequestAction, toggleSavePropertyAction } from "@/features/properties/actions";
import { formatAreaSqm, formatCurrency, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Agency, Listing, Property, PropertyKind, ValuationSubmission } from "@/types/domain";

import { Button } from "../ui/button";
import styles from "./property-page.module.css";

interface PropertyPageProps {
  property: Property;
  listing?: Listing;
  agency?: Agency;
  contactName?: string;
  valuations: ValuationSubmission[];
  isSaved?: boolean;
  statusMessage?: string;
  claimState?: "claimable" | "pending" | "owned";
  canCreateListing?: boolean;
}

interface FactItem {
  label: string;
  value: string;
}

interface DetailItem {
  label: string;
  value: string;
}

interface PrimaryInfoStat {
  value?: string;
}

interface PropertyPageBehavior {
  kind: PropertyKind;
  kindLabel: string;
  mediaMode: "gallery" | "map";
  mapTitle: string;
  claimLabel: string;
  nonListedTitle: string;
  nonListedBody: string;
}

const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  house: "House",
  land: "Land",
  apartment_building: "Apartment building",
  commercial_building: "Commercial building",
  apartment_unit: "Apartment Unit",
  commercial_unit: "Commercial Unit",
};

function formatPropertyKindLabel(propertyKind?: PropertyKind, propertyType?: string) {
  if (propertyType?.trim()) {
    return propertyType.trim();
  }

  if (!propertyKind) {
    return "Property";
  }

  return PROPERTY_KIND_LABELS[propertyKind] ?? "Property";
}

function inferPropertyKind(property: Property): PropertyKind | undefined {
  if (property.facts.propertyKind) {
    return property.facts.propertyKind;
  }

  const propertyType = property.facts.propertyType?.toLowerCase();

  if (propertyType?.includes("commercial building")) {
    return "commercial_building";
  }

  if (propertyType?.includes("apartment building")) {
    return "apartment_building";
  }

  if (propertyType?.includes("apartment")) {
    return "apartment_unit";
  }

  if (propertyType?.includes("commercial")) {
    return "commercial_unit";
  }

  if (propertyType?.includes("building")) {
    return "apartment_building";
  }

  if (propertyType?.includes("parcel") || propertyType?.includes("land") || propertyType?.includes("lot")) {
    return "land";
  }

  if (propertyType?.includes("house")) {
    return "house";
  }

  return undefined;
}

function formatBedsBaths(property: Property) {
  return `${property.facts.bedrooms ?? "-"} bd / ${property.facts.bathrooms ?? "-"} ba`;
}

function formatArea(value?: number) {
  return value ? formatAreaSqm(value) : "Unknown";
}

function buildWhatsappUrl(phone?: string) {
  const normalizedPhone = phone?.replace(/\D/g, "");

  if (!normalizedPhone) {
    return undefined;
  }

  return `https://wa.me/${normalizedPhone}`;
}

function buildFactItems(property: Property, propertyKind?: PropertyKind): FactItem[] {
  switch (propertyKind) {
    case "land":
      return [
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
      ];
    case "apartment_unit":
      return [
        { label: "Year built", value: property.facts.yearBuilt ? String(property.facts.yearBuilt) : "Unknown" },
      ];
    case "apartment_building":
    case "commercial_building":
      return [
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
      ];
    case "commercial_unit":
      return [
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
      ];
    case "house":
    default:
      return [
        { label: "Parcel", value: formatArea(property.facts.landAreaSqm) },
        { label: "Year built", value: property.facts.yearBuilt ? String(property.facts.yearBuilt) : "Unknown" },
      ];
  }
}

function buildDetailItems(property: Property, propertyKind?: PropertyKind): DetailItem[] {
  const factItems = buildFactItems(property, propertyKind);
  const detailItems: DetailItem[] = factItems.map((fact) => ({ label: fact.label, value: fact.value }));

  if (property.facts.zoningLabel && !detailItems.some((item) => item.label === "Use zone" || item.label === "Zone")) {
    detailItems.push({ label: propertyKind === "land" ? "Zone" : "Use zone", value: property.facts.zoningLabel });
  }

  detailItems.push({ label: "Property ID", value: property.id });

  return detailItems;
}

function buildPrimaryInfoStats(property: Property, propertyKind?: PropertyKind): PrimaryInfoStat[] {
  const bedroomValue = property.facts.bedrooms !== undefined ? `${property.facts.bedrooms} bd` : undefined;
  const bathroomValue = property.facts.bathrooms !== undefined ? `${property.facts.bathrooms} ba` : undefined;
  const interiorValue = property.facts.areaSqm ? formatAreaSqm(property.facts.areaSqm) : undefined;
  const parcelValue = property.facts.landAreaSqm ? formatAreaSqm(property.facts.landAreaSqm) : undefined;
  const yearBuiltValue = property.facts.yearBuilt ? String(property.facts.yearBuilt) : undefined;

  switch (propertyKind) {
    case "land":
      return [{}, {}, { value: parcelValue }];
    case "apartment_unit":
      return [
        { value: bedroomValue },
        { value: bathroomValue },
        { value: interiorValue },
      ];
    case "apartment_building":
    case "commercial_building":
      return [
        { value: interiorValue },
        { value: parcelValue },
        { value: yearBuiltValue },
      ];
    case "commercial_unit":
      return [
        { value: interiorValue },
        { value: bathroomValue },
        { value: parcelValue },
      ];
    case "house":
    default:
      return [
        { value: bedroomValue },
        { value: bathroomValue },
        { value: interiorValue },
      ];
  }
}

function buildPropertyPageBehavior(
  property: Property,
  propertyKind: PropertyKind | undefined,
  listing: Listing | undefined,
  hasGallery: boolean,
): PropertyPageBehavior {
  const mediaMode = !listing || propertyKind === "land" || !hasGallery ? "map" : "gallery";
  const resolvedKindLabel = formatPropertyKindLabel(propertyKind, property.facts.propertyType);
  const resolvedKindLabelLower = resolvedKindLabel.toLowerCase();

  switch (propertyKind) {
    case "land":
      return {
        kind: propertyKind ?? "house",
        kindLabel: formatPropertyKindLabel(propertyKind, property.facts.propertyType),
        mediaMode,
        mapTitle: "Parcel map and land context",
        claimLabel: "Claim this parcel",
        nonListedTitle: "This parcel is not currently listed.",
        nonListedBody: "You can claim the parcel or save it while it remains off-market.",
      };
    case "apartment_unit":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind, property.facts.propertyType),
        mediaMode,
        mapTitle: mediaMode === "map" ? "Shared parcel reference" : "Building and parcel context",
        claimLabel: "Claim this unit",
        nonListedTitle: "This apartment unit is not currently listed.",
        nonListedBody: "You can claim the unit or save it while we wait for future listing activity.",
      };
    case "apartment_building":
    case "commercial_building":
      return {
        kind: propertyKind,
        kindLabel: resolvedKindLabel,
        mediaMode,
        mapTitle: mediaMode === "map" ? "Parcel reference" : "Building footprint and parcel context",
        claimLabel: `Claim this ${resolvedKindLabelLower}`,
        nonListedTitle: `This ${resolvedKindLabelLower} is not currently listed.`,
        nonListedBody: `You can claim the ${resolvedKindLabelLower} or save it while it remains off-market.`,
      };
    case "commercial_unit":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind, property.facts.propertyType),
        mediaMode,
        mapTitle: mediaMode === "map" ? "Shared parcel reference" : "Business location context",
        claimLabel: "Claim this property",
        nonListedTitle: "This commercial property is not currently listed.",
        nonListedBody: "You can claim the property or save it while it remains off-market.",
      };
    case "house":
    default:
      return {
        kind: propertyKind ?? "house",
        kindLabel: formatPropertyKindLabel(propertyKind, property.facts.propertyType),
        mediaMode,
        mapTitle: "Parcel context",
        claimLabel: "Claim this home",
        nonListedTitle: "This property is not currently listed.",
        nonListedBody: "You can claim the home or save it while it remains off-market.",
      };
  }
}

function buildListingStateLabel(listing?: Listing) {
  if (!listing) {
    return "Off market";
  }

  return listing.marketingType === "rent" ? "For rent" : "For sale";
}

export function PropertyPage({
  property,
  listing,
  agency,
  contactName,
  valuations,
  isSaved = false,
  statusMessage,
  claimState = "claimable",
  canCreateListing = false,
}: PropertyPageProps) {
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const latestValuation = valuations[0];
  const locationLabel = [property.location.village, property.location.cell, property.location.sector, property.location.district]
    .filter(Boolean)
    .join(", ");
  const propertyRouteId = property.id;
  const propertyPath = routes.public.property(propertyRouteId, {
    propertyTitle: property.title,
    parcelDisplayId: property.parcelDisplayId,
    propertyKind: property.facts.propertyKind,
    unitLabel: property.unitLabel,
  });
  const galleryImages = listing?.imageUrls ?? [];
  const primaryImage = galleryImages[0];
  const secondaryImage = galleryImages[1];
  const tertiaryImage = galleryImages[2];
  const propertyKind = inferPropertyKind(property);
  const behavior = buildPropertyPageBehavior(property, propertyKind, listing, Boolean(primaryImage));
  const detailItems = buildDetailItems(property, propertyKind);
  const listingStateLabel = buildListingStateLabel(listing);
  const primaryInfoMetaLabel = `${listingStateLabel} | ${behavior.kindLabel}`;
  const summaryDescription = property.description;
  const primaryInfoStats = buildPrimaryInfoStats(property, propertyKind);
  const whatsappUrl = buildWhatsappUrl(agency?.whatsappPhone);
  const primaryPrice = listing
    ? formatCurrency(listing.askingPrice, listing.currency)
    : latestValuation
      ? formatCurrency(latestValuation.estimatedValue, latestValuation.currency)
      : "Price unavailable";
  const contactRoleLabel = listing
    ? agency
      ? contactName && contactName !== agency.businessName
        ? agency.businessName
        : "Listing agency"
      : "For sale by owner"
    : undefined;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.pageGrid}>
        <div className={styles.leftRail}>
          {behavior.mediaMode === "gallery" && primaryImage ? (
            <div className={`${styles.panel} ${styles.mediaPanel}`}>
              <div className={`${styles.gallery}${!secondaryImage ? ` ${styles.gallerySingle}` : ""}`}>
                <div className={styles.galleryPrimary}>
                  <img alt={property.title} className={styles.galleryImage} src={primaryImage} />
                </div>
                {tertiaryImage ? (
                  <div className={styles.galleryStack}>
                    <div className={styles.gallerySecondary}>
                      <img alt={`${property.title} view 2`} className={styles.galleryImage} src={secondaryImage} />
                    </div>
                    <div className={`${styles.gallerySecondary} ${styles.gallerySecondaryAction}`}>
                      <img alt={`${property.title} view 3`} className={styles.galleryImage} src={tertiaryImage} />
                      <button className={styles.galleryCta} type="button">
                        See all images
                      </button>
                    </div>
                  </div>
                ) : secondaryImage ? (
                  <div className={`${styles.gallerySecondary} ${styles.gallerySecondaryAction} ${styles.gallerySecondaryFull}`}>
                    <img alt={`${property.title} view 2`} className={styles.galleryImage} src={secondaryImage} />
                    <button className={styles.galleryCta} type="button">
                      See all images
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={`${styles.panel} ${styles.mapPanel}`}>
              <div className={styles.mapGrid}>
                <PropertyParcelMap property={property} />
              </div>
            </div>
          )}

          <div className={`${styles.panel} ${styles.summary}`}>
            {statusMessage ? <div className={styles.description}>{statusMessage}</div> : null}
            {!listing && (
              <div className={styles.statusRow}>
                {latestValuation ? (
                  <div className={styles.inlineMeta}>
                    Market estimate based on {formatDate(latestValuation.effectiveDate)}:{" "}
                    {formatCurrency(latestValuation.estimatedValue, latestValuation.currency)}
                  </div>
                ) : (
                  <div className={styles.inlineMeta}>No active listing is attached to this property right now.</div>
                )}
              </div>
            )}
            {!listing && latestValuation ? (
              <div className={styles.estimateCard}>
                <div className={styles.estimateLabel}>Market estimate</div>
                <div className={styles.estimateValue}>{formatCurrency(latestValuation.estimatedValue, latestValuation.currency)}</div>
                <div className={styles.estimateBody}>
                  This property is not currently listed. The estimate is based on the latest approved valuation recorded on{" "}
                  {formatDate(latestValuation.effectiveDate)}.
                </div>
              </div>
            ) : null}
            {summaryDescription ? <div className={styles.description}>{summaryDescription}</div> : null}
            <div className={styles.detailList}>
              {detailItems.map((detailItem) => (
                <div className={styles.detailRow} key={detailItem.label}>
                  <span>{detailItem.label}</span>
                  <span>{detailItem.value}</span>
                </div>
              ))}
            </div>
          </div>

          {behavior.mediaMode === "gallery" ? (
            <div className={styles.mapSection}>
              <div className={`${styles.panel} ${styles.section}`}>
                <div className={styles.secondaryMapFrame}>
                  <PropertyParcelMap property={property} />
                </div>
              </div>
            </div>
          ) : null}

          <div className={`${styles.panel} ${styles.section} ${styles.valuationPanel}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Valuation history</h2>
              <div className={styles.sectionMeta}>{valuations.length} approved entries</div>
            </div>
            {valuations.length > 0 ? (
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Value</th>
                    <th>Valuator</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((valuation) => {
                    const valuatorLabel = valuation.isAnonymous ? "Anonymous" : "Named valuator";

                    return (
                      <tr key={valuation.id}>
                        <td>{formatDate(valuation.effectiveDate)}</td>
                        <td>{formatCurrency(valuation.estimatedValue, valuation.currency)}</td>
                        <td>{valuatorLabel}</td>
                        <td>{formatDate(valuation.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>No approved valuation history yet.</div>
            )}
          </div>
        </div>

        <div className={styles.rightRail}>
          <div className={`${styles.panel} ${styles.primaryInfoPanel}`}>
            <div className={styles.eyebrow}>{locationLabel}</div>
            <div className={styles.eyebrow}>{primaryInfoMetaLabel}</div>
            <div className={styles.priceValue}>{primaryPrice}</div>
            <h1 className={styles.primaryAddress}>{property.title}</h1>
            <div className={styles.primaryInfoStats}>
              {primaryInfoStats.map((stat, index) => (
                <div className={styles.primaryInfoStat} key={`${propertyKind}-${index}`}>
                  {stat.value ? <span>{stat.value}</span> : null}
                </div>
              ))}
            </div>
            {listing ? (
              <div className={styles.contactSummary}>
                <div className={styles.contactIdentity}>
                  <div className={styles.contactDetailRow}>
                    <div className={styles.contactDetailLabel}>Agent:</div>
                    <div className={styles.contactDetailValue}>{contactName ?? agency?.businessName ?? "Owner"}</div>
                  </div>
                  <div className={styles.contactDetailRow}>
                    <div className={styles.contactDetailLabel}>Agency:</div>
                    <div className={styles.contactDetailValue}>{contactRoleLabel ?? "For sale by owner"}</div>
                  </div>
                </div>
                <div className={styles.ctaGroup}>
                  {showWhatsapp && whatsappUrl ? (
                    <a className={styles.whatsappAction} href={whatsappUrl} rel="noreferrer" target="_blank">
                      Message on WhatsApp
                    </a>
                  ) : (
                    <Button disabled={!whatsappUrl} onClick={() => setShowWhatsapp(true)}>
                      {whatsappUrl ? "Reveal WhatsApp" : "WhatsApp unavailable"}
                    </Button>
                  )}
                  <form action={toggleSavePropertyAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit" variant="secondary">{isSaved ? "Saved" : "Save property"}</Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className={styles.ctaGroup}>
                {claimState === "owned" ? (
                  <>
                    <Link className={styles.actionLinkPrimary} href={routes.app.portalProperties}>
                      View owned properties
                    </Link>
                    {canCreateListing ? (
                      <Link
                        className={styles.actionLinkSecondary}
                        href={`${routes.app.portalListingNew}?property=${encodeURIComponent(propertyRouteId)}`}
                      >
                        Create listing
                      </Link>
                    ) : null}
                  </>
                ) : claimState === "pending" ? (
                  <Button disabled>Claim pending review</Button>
                ) : property.internalId ? (
                  <form action={createPropertyClaimRequestAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <input name="propertyId" type="hidden" value={property.id} />
                    <input name="propertyInternalId" type="hidden" value={property.internalId} />
                    <input name="parcelId" type="hidden" value={property.parcelId} />
                    <input name="upi" type="hidden" value={property.upi} />
                    <input name="propertyKind" type="hidden" value={property.facts.propertyKind || ""} />
                    <input name="unitLabel" type="hidden" value={property.unitLabel || ""} />
                    <Button type="submit">{behavior.claimLabel}</Button>
                  </form>
                ) : (
                  <Button disabled>{behavior.claimLabel}</Button>
                )}
                <form action={toggleSavePropertyAction}>
                  <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                  <input name="propertyPath" type="hidden" value={propertyPath} />
                  <Button type="submit" variant="secondary">{isSaved ? "Saved" : "Save property"}</Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
