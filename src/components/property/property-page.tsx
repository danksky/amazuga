"use client";

import { useState } from "react";

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
  valuations: ValuationSubmission[];
  isSaved?: boolean;
  statusMessage?: string;
}

interface FactItem {
  label: string;
  value: string;
}

interface DetailItem {
  label: string;
  value: string;
}

interface PropertyPageBehavior {
  kind: PropertyKind;
  kindLabel: string;
  mediaMode: "gallery" | "map";
  focusTitle: string;
  focusBody: string;
  mapTitle: string;
  detailsTitle: string;
  listingTitle: string;
  claimLabel: string;
  nonListedTitle: string;
  nonListedBody: string;
  infoTitle: string;
  infoBody: string;
}

const PROPERTY_KIND_LABELS: Record<PropertyKind, string> = {
  house: "House",
  land: "Land",
  building: "Building",
  apartment_unit: "Apartment Unit",
  commercial_unit: "Commercial Unit",
  mixed_use: "Mixed Use",
  other: "Property",
};

function formatPropertyKindLabel(propertyKind?: PropertyKind) {
  if (!propertyKind) {
    return "Property";
  }

  return PROPERTY_KIND_LABELS[propertyKind] ?? "Property";
}

function inferPropertyKind(property: Property): PropertyKind {
  if (property.facts.propertyKind) {
    return property.facts.propertyKind;
  }

  const propertyType = property.facts.propertyType?.toLowerCase();

  if (propertyType?.includes("apartment")) {
    return "apartment_unit";
  }

  if (propertyType?.includes("commercial")) {
    return "commercial_unit";
  }

  if (propertyType?.includes("building")) {
    return "building";
  }

  if (propertyType?.includes("parcel") || propertyType?.includes("land") || propertyType?.includes("lot")) {
    return "land";
  }

  if (propertyType?.includes("house")) {
    return "house";
  }

  return "other";
}

function formatBedsBaths(property: Property) {
  return `${property.facts.bedrooms ?? "-"} bd / ${property.facts.bathrooms ?? "-"} ba`;
}

function formatArea(value?: number) {
  return value ? formatAreaSqm(value) : "Unknown";
}

function buildFactItems(property: Property, propertyKind: PropertyKind): FactItem[] {
  const typeLabel = property.facts.propertyType ?? formatPropertyKindLabel(propertyKind);

  switch (propertyKind) {
    case "land":
      return [
        { label: "Type", value: typeLabel },
        { label: "Parcel size", value: formatArea(property.facts.landAreaSqm) },
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
        { label: "District", value: property.location.district },
      ];
    case "apartment_unit":
      return [
        { label: "Type", value: typeLabel },
        { label: "Interior", value: formatArea(property.facts.areaSqm) },
        { label: "Beds / baths", value: formatBedsBaths(property) },
        { label: "Year built", value: property.facts.yearBuilt ? String(property.facts.yearBuilt) : "Unknown" },
      ];
    case "building":
      return [
        { label: "Type", value: typeLabel },
        { label: "Built area", value: formatArea(property.facts.areaSqm) },
        { label: "Parcel size", value: formatArea(property.facts.landAreaSqm) },
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
      ];
    case "commercial_unit":
      return [
        { label: "Type", value: typeLabel },
        { label: "Floor area", value: formatArea(property.facts.areaSqm) },
        { label: "Use zone", value: property.facts.zoningLabel ?? "Unknown" },
        { label: "Parcel size", value: formatArea(property.facts.landAreaSqm) },
      ];
    case "house":
    case "mixed_use":
    case "other":
    default:
      return [
        { label: "Interior", value: formatArea(property.facts.areaSqm) },
        { label: "Beds / baths", value: formatBedsBaths(property) },
        { label: "Parcel", value: formatArea(property.facts.landAreaSqm) },
        { label: "Year built", value: property.facts.yearBuilt ? String(property.facts.yearBuilt) : "Unknown" },
      ];
  }
}

function buildDetailItems(property: Property, propertyKind: PropertyKind): DetailItem[] {
  const detailItems: DetailItem[] = [];

  if (property.facts.zoningLabel) {
    detailItems.push({ label: propertyKind === "land" ? "Zone" : "Use zone", value: property.facts.zoningLabel });
  }

  if (property.parcelPublicId) {
    detailItems.push({ label: "Parcel public ID", value: property.parcelPublicId });
  }

  if (property.code) {
    detailItems.push({ label: "Property code", value: property.code });
  }

  if (property.facts.yearBuilt) {
    detailItems.push({ label: "Year built", value: String(property.facts.yearBuilt) });
  }

  detailItems.push({ label: "District", value: property.location.district });

  if (property.location.sector) {
    detailItems.push({ label: "Sector", value: property.location.sector });
  }

  if (property.location.cell) {
    detailItems.push({ label: "Cell", value: property.location.cell });
  }

  if (property.location.village) {
    detailItems.push({ label: "Village", value: property.location.village });
  }

  detailItems.push({ label: "Property kind", value: formatPropertyKindLabel(propertyKind) });
  detailItems.push({ label: "Property ID", value: property.id });

  return detailItems;
}

function buildPropertyPageBehavior(
  property: Property,
  propertyKind: PropertyKind,
  listing: Listing | undefined,
  hasGallery: boolean,
): PropertyPageBehavior {
  const mediaMode = !listing || propertyKind === "land" || !hasGallery ? "map" : "gallery";

  switch (propertyKind) {
    case "land":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind),
        mediaMode,
        focusTitle: "Parcel-first overview",
        focusBody: "Parcel size, zoning, and map context lead this page so land decisions can start with feasibility instead of interior imagery.",
        mapTitle: "Parcel map and land context",
        detailsTitle: "Parcel details",
        listingTitle: listing ? "Parcel listing" : "Parcel actions",
        claimLabel: "Claim this parcel",
        nonListedTitle: "This parcel is not currently listed.",
        nonListedBody: "You can claim the parcel or save it while it remains off-market.",
        infoTitle: listing ? "Listing notes" : "About parcel claims",
        infoBody: listing
          ? "This page stays parcel-first even when listed so zoning and land footprint remain the primary decision signals."
          : "Claiming is available on unlisted parcels while the downstream verification flow is still being defined.",
      };
    case "apartment_unit":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind),
        mediaMode,
        focusTitle: "Unit-first overview",
        focusBody: "Apartment pages lead with unit livability and layout, while parcel context stays available as supporting information.",
        mapTitle: "Building and parcel context",
        detailsTitle: "Unit details",
        listingTitle: listing ? "Unit listing" : "Unit actions",
        claimLabel: "Claim this unit",
        nonListedTitle: "This apartment unit is not currently listed.",
        nonListedBody: "You can claim the unit or save it while we wait for future listing activity.",
        infoTitle: listing ? "Listing notes" : "About unit claims",
        infoBody: listing
          ? "Listing information appears here while the property page remains the canonical surface for the unit."
          : "Claiming is available on unlisted units as the starting point for future verification and ownership workflows.",
      };
    case "building":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind),
        mediaMode,
        focusTitle: "Building-level overview",
        focusBody: "This page leads with the building as the marketable object, which gives us room to add child units later without changing the core page model.",
        mapTitle: "Building footprint and parcel context",
        detailsTitle: "Building details",
        listingTitle: listing ? "Building listing" : "Building actions",
        claimLabel: "Claim this building",
        nonListedTitle: "This building is not currently listed.",
        nonListedBody: "You can claim the building or save it while it remains off-market.",
        infoTitle: listing ? "Listing notes" : "About building claims",
        infoBody: listing
          ? "This building page is the canonical surface today and can later branch into child-unit inventory."
          : "Claiming is available on unlisted buildings while the downstream verification flow is still being defined.",
      };
    case "commercial_unit":
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind),
        mediaMode,
        focusTitle: "Business-use overview",
        focusBody: "Commercial pages lead with floor area, zoning, and location utility so business suitability is clearer before a deeper site visit.",
        mapTitle: "Business location context",
        detailsTitle: "Commercial details",
        listingTitle: listing ? "Commercial listing" : "Commercial actions",
        claimLabel: "Claim this property",
        nonListedTitle: "This commercial property is not currently listed.",
        nonListedBody: "You can claim the property or save it while it remains off-market.",
        infoTitle: listing ? "Listing notes" : "About commercial claims",
        infoBody: listing
          ? "This page keeps the commercial property canonical while the active listing contributes current pricing and contact details."
          : "Claiming is available on unlisted commercial properties while the downstream verification flow is still being defined.",
      };
    case "house":
    case "mixed_use":
    case "other":
    default:
      return {
        kind: propertyKind,
        kindLabel: formatPropertyKindLabel(propertyKind),
        mediaMode,
        focusTitle: "Home-focused overview",
        focusBody: "House pages lead with day-to-day livability, while parcel context and valuation history support the core housing decision.",
        mapTitle: "Parcel context",
        detailsTitle: "Property details",
        listingTitle: listing ? "Active listing" : "Property actions",
        claimLabel: "Claim this home",
        nonListedTitle: "This property is not currently listed.",
        nonListedBody: "You can claim the home or save it while it remains off-market.",
        infoTitle: listing ? "Listing notes" : "About claiming",
        infoBody: listing
          ? "This property page is canonical. Listing information appears here when the property has an active listing."
          : "Claiming is available on non-listed properties. The downstream verification flow is still being defined, so this currently acts as the entry point into that process.",
      };
  }
}

function buildListingStateLabel(listing?: Listing) {
  if (!listing) {
    return "Not listed";
  }

  return listing.marketingType === "rent" ? "Listed for rent" : "Listed for sale";
}

export function PropertyPage({ property, listing, agency, valuations, isSaved = false, statusMessage }: PropertyPageProps) {
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const latestValuation = valuations[0];
  const locationLabel = [property.location.village, property.location.cell, property.location.sector, property.location.district]
    .filter(Boolean)
    .join(", ");
  const propertyRouteId = property.id;
  const propertyPath = routes.public.property(propertyRouteId);
  const galleryImages = listing?.imageUrls ?? [];
  const primaryImage = galleryImages[0];
  const secondaryImage = galleryImages[1] ?? galleryImages[0];
  const tertiaryImage = galleryImages[2] ?? galleryImages[1] ?? galleryImages[0];
  const propertyKind = inferPropertyKind(property);
  const behavior = buildPropertyPageBehavior(property, propertyKind, listing, Boolean(primaryImage));
  const factItems = buildFactItems(property, propertyKind);
  const detailItems = buildDetailItems(property, propertyKind);
  const kindBadgeLabel = behavior.kindLabel;
  const listingStateLabel = buildListingStateLabel(listing);
  const listingMetaLabel = listing ? (listing.marketingType === "rent" ? "For rent" : "For sale") : undefined;
  const summaryDescription = property.description;
  const zoningLabel = property.facts.zoningLabel;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        {behavior.mediaMode === "gallery" && primaryImage ? (
          <div className={`${styles.panel} ${styles.mediaPanel}`}>
            <div className={styles.gallery}>
              <div className={styles.galleryPrimary}>
                <img alt={listing?.headline ?? property.title} className={styles.galleryImage} src={primaryImage} />
              </div>
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
          <div className={styles.eyebrow}>{locationLabel}</div>
          <h1 className={styles.title}>{property.title}</h1>
          <div className={styles.badgeRow}>
            <div className={styles.status}>{listingStateLabel}</div>
            <div className={styles.kindBadge}>{kindBadgeLabel}</div>
            {listingMetaLabel ? <div className={styles.neutralBadge}>{listingMetaLabel}</div> : null}
            {zoningLabel ? <div className={styles.neutralBadge}>{zoningLabel}</div> : null}
          </div>
          {statusMessage ? <div className={styles.description}>{statusMessage}</div> : null}
          <div className={styles.statusRow}>
            {listing ? (
              <div className={styles.inlineMeta}>Listed at {formatCurrency(listing.askingPrice, listing.currency)}</div>
            ) : latestValuation ? (
              <div className={styles.inlineMeta}>
                Market estimate based on {formatDate(latestValuation.effectiveDate)}:{" "}
                {formatCurrency(latestValuation.estimatedValue, latestValuation.currency)}
              </div>
            ) : (
              <div className={styles.inlineMeta}>No active listing is attached to this property right now.</div>
            )}
          </div>
          <div className={styles.focusCard}>
            <div className={styles.focusLabel}>{behavior.focusTitle}</div>
            <div className={styles.focusBody}>{behavior.focusBody}</div>
          </div>
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
          <div className={styles.facts}>
            {factItems.map((fact) => (
              <div className={styles.fact} key={fact.label}>
                <div className={styles.factLabel}>{fact.label}</div>
                <div className={styles.factValue}>{fact.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.mapSection}>
        <div className={`${styles.panel} ${styles.section}`}>
          <div className={styles.mapHeader}>
            <div>
              <div className={styles.panelEyebrow}>Map</div>
              <div className={styles.mapTitle}>{behavior.mapTitle}</div>
            </div>
            <div className={styles.mapMeta}>{locationLabel}</div>
          </div>
          <div className={styles.secondaryMapFrame}>
            <PropertyParcelMap property={property} />
          </div>
        </div>
      </div>

      <div className={styles.tertiaryGrid}>
        <div className={`${styles.panel} ${styles.section}`}>
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

        <div className={styles.sidebar}>
          <div className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{behavior.listingTitle}</h2>
            </div>
            {listing ? (
              <div className={styles.listingCard}>
                <div className={styles.listingPrice}>{formatCurrency(listing.askingPrice, listing.currency)}</div>
                <div className={styles.listingHeadline}>{listing.headline}</div>
                <div className={styles.listingMeta}>
                  {listing.marketingType === "rent" ? "For rent" : "For sale"}
                  {agency ? ` · ${agency.businessName}` : ""}
                </div>
                <div className={styles.listingDescription}>{listing.description}</div>
                {showWhatsapp && agency?.whatsappPhone ? (
                  <div className={styles.contactCard}>
                    <div className={styles.contactLabel}>WhatsApp</div>
                    <div className={styles.contactValue}>{agency.whatsappPhone}</div>
                  </div>
                ) : null}
                <div className={styles.ctaGroup}>
                  <Button onClick={() => setShowWhatsapp((current) => !current)}>
                    {showWhatsapp ? "Hide WhatsApp" : "Show WhatsApp"}
                  </Button>
                  <form action={toggleSavePropertyAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit" variant="secondary">{isSaved ? "Saved" : "Save property"}</Button>
                  </form>
                </div>
              </div>
            ) : (
              <div className={styles.nonListedState}>
                <div className={styles.nonListedTitle}>{behavior.nonListedTitle}</div>
                <div className={styles.nonListedBody}>{behavior.nonListedBody}</div>
                <div className={styles.ctaGroup}>
                  {property.internalId ? (
                    <form action={createPropertyClaimRequestAction}>
                      <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                      <input name="propertyPath" type="hidden" value={propertyPath} />
                      <input name="propertyId" type="hidden" value={property.id} />
                      <input name="propertyInternalId" type="hidden" value={property.internalId} />
                      <input name="parcelId" type="hidden" value={property.parcelId} />
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
              </div>
            )}
          </div>
          <div className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{behavior.detailsTitle}</h2>
            </div>
            <div className={styles.detailList}>
              {detailItems.map((detailItem) => (
                <div className={styles.detailRow} key={detailItem.label}>
                  <span>{detailItem.label}</span>
                  <span>{detailItem.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{behavior.infoTitle}</h2>
            </div>
            <div className={styles.infoBlock}>{behavior.infoBody}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
