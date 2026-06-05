"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { PropertyParcelMap } from "@/components/maps/property-parcel-map";
import { startPropertyClaimAction, toggleSavePropertyAction } from "@/features/properties/actions";
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
  label?: string;
  value?: string;
}

interface PropertyPageBehavior {
  // 'none' means no parcel and no gallery — suppress map entirely
  kind: PropertyKind;
  kindLabel: string;
  mediaMode: "gallery" | "map" | "none";
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

function formatValuationDate(date: string) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatValuationPrice(amount: number, currency: string) {
  const millions = amount / 1_000_000;
  return `${currency} ${millions.toFixed(2)} M`;
}

function formatBedsBaths(property: Property) {
  return `${property.facts.bedrooms ?? "-"} bd / ${property.facts.bathrooms ?? "-"} ba`;
}

function formatArea(value?: number) {
  return value ? formatAreaSqm(value) : "Unknown";
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
      return [{ label: "Land area", value: parcelValue }, {}, {}];
    case "apartment_unit":
      return [
        { label: "Beds", value: bedroomValue },
        { label: "Baths", value: bathroomValue },
        { label: "Interior", value: interiorValue },
      ];
    case "apartment_building":
    case "commercial_building":
      return [
        { label: "Interior", value: interiorValue },
        { label: "Land area", value: parcelValue },
        { label: "Built", value: yearBuiltValue },
      ];
    case "commercial_unit":
      return [
        { label: "Interior", value: interiorValue },
        { label: "Baths", value: bathroomValue },
        { label: "Land area", value: parcelValue },
      ];
    case "house":
    default:
      return [
        { label: "Beds", value: bedroomValue },
        { label: "Baths", value: bathroomValue },
        { label: "Interior", value: interiorValue },
      ];
  }
}

function buildPropertyPageBehavior(
  property: Property,
  propertyKind: PropertyKind | undefined,
  listing: Listing | undefined,
  hasGallery: boolean,
): PropertyPageBehavior {
  const isParcelLinked = property.locationSource === "parcel" || !property.locationSource;
  const mediaMode: PropertyPageBehavior["mediaMode"] =
    hasGallery ? "gallery" : isParcelLinked ? "map" : "none";
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
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const closeGalleryButtonRef = useRef<HTMLButtonElement | null>(null);
  const propertyKind = inferPropertyKind(property);
  const behavior = buildPropertyPageBehavior(property, propertyKind, listing, Boolean(primaryImage));
  const detailItems = buildDetailItems(property, propertyKind);
  const listingStateLabel = buildListingStateLabel(listing);
  const primaryInfoMetaLabel = `${listingStateLabel} | ${behavior.kindLabel}`;
  const primaryInfoStats = buildPrimaryInfoStats(property, propertyKind);
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
  const activeGalleryImage = galleryImages[activeGalleryIndex];
  const hasMultipleGalleryImages = galleryImages.length > 1;

  function openGalleryModal(imageIndex = 0) {
    setActiveGalleryIndex(imageIndex);
    setGalleryModalOpen(true);
  }

  function showPreviousGalleryImage() {
    setActiveGalleryIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
  }

  function showNextGalleryImage() {
    setActiveGalleryIndex((current) => (current + 1) % galleryImages.length);
  }

  useEffect(() => {
    if (!galleryModalOpen) {
      return;
    }

    closeGalleryButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setGalleryModalOpen(false);
      }

      if (!hasMultipleGalleryImages) {
        return;
      }

      if (event.key === "ArrowLeft") {
        setActiveGalleryIndex((current) => (current - 1 + galleryImages.length) % galleryImages.length);
      }

      if (event.key === "ArrowRight") {
        setActiveGalleryIndex((current) => (current + 1) % galleryImages.length);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryModalOpen, hasMultipleGalleryImages, galleryImages.length]);

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
                    </div>
                  </div>
                ) : secondaryImage ? (
                  <div className={`${styles.gallerySecondary} ${styles.gallerySecondaryAction} ${styles.gallerySecondaryFull}`}>
                    <img alt={`${property.title} view 2`} className={styles.galleryImage} src={secondaryImage} />
                  </div>
                ) : null}
                {hasMultipleGalleryImages ? (
                  <button className={styles.galleryCta} onClick={() => openGalleryModal(0)} type="button">
                    See all images
                  </button>
                ) : null}
              </div>
            </div>
          ) : behavior.mediaMode === "map" ? (
            <div className={`${styles.panel} ${styles.mapPanel}`}>
              <div className={styles.mapGrid}>
                <PropertyParcelMap property={property} />
              </div>
            </div>
          ) : null}

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
            <div className={styles.detailList}>
              {detailItems.map((detailItem) => (
                <div className={styles.detailRow} key={detailItem.label}>
                  <span>{detailItem.label}</span>
                  <span>{detailItem.value}</span>
                </div>
              ))}
            </div>
          </div>

          {behavior.mediaMode === "gallery" && (!property.locationSource || property.locationSource === "parcel") ? (
            <div className={styles.mapSection}>
              <div className={`${styles.panel} ${styles.section}`}>
                <div className={styles.secondaryMapFrame}>
                  <PropertyParcelMap property={property} />
                </div>
              </div>
            </div>
          ) : null}

          {valuations.length > 0 ? (
            <div className={`${styles.panel} ${styles.section} ${styles.valuationPanel}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Valuation history</h2>
                <div className={styles.sectionMeta}>{valuations.length} approved entries</div>
              </div>
              <table className={styles.historyTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((valuation) => (
                    <tr key={valuation.id}>
                      <td>{formatValuationDate(valuation.effectiveDate)}</td>
                      <td>{formatValuationPrice(valuation.estimatedValue, valuation.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
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
                  {stat.label ? <div className={styles.eyebrow}>{stat.label}</div> : null}
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
                  <a
                    className={styles.whatsappAction}
                    href={routes.public.propertyWhatsapp(propertyRouteId)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Inquire via WhatsApp
                  </a>
                  <form action={toggleSavePropertyAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit" variant="secondary">{isSaved ? "Saved" : "Save property"}</Button>
                  </form>
                  <a
                    className={styles.actionLinkSecondary}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${property.location.lat},${property.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions
                  </a>
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
                ) : property.locationSource && property.locationSource !== "parcel" ? null : (
                  <form action={startPropertyClaimAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit">{behavior.claimLabel}</Button>
                  </form>
                )}
                <form action={toggleSavePropertyAction}>
                  <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                  <input name="propertyPath" type="hidden" value={propertyPath} />
                  <Button type="submit" variant="secondary">{isSaved ? "Saved" : "Save property"}</Button>
                </form>
                <a
                  className={styles.actionLinkSecondary}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${property.location.lat},${property.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      {galleryModalOpen && activeGalleryImage ? (
        <div
          aria-label={`${property.title} image gallery`}
          aria-modal="true"
          className={styles.galleryModalBackdrop}
          onClick={() => setGalleryModalOpen(false)}
          role="dialog"
        >
          <div className={styles.galleryModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.galleryModalHeader}>
              <div className={styles.galleryModalCounter}>
                {activeGalleryIndex + 1} / {galleryImages.length}
              </div>
              <button
                aria-label="Close image gallery"
                className={styles.galleryModalClose}
                onClick={() => setGalleryModalOpen(false)}
                ref={closeGalleryButtonRef}
                type="button"
              >
                Close
              </button>
            </div>
            <div className={styles.galleryModalImageFrame}>
              <img
                alt={`${property.title} view ${activeGalleryIndex + 1}`}
                className={styles.galleryModalImage}
                src={activeGalleryImage}
              />
              {hasMultipleGalleryImages ? (
                <>
                  <button
                    aria-label="Show previous image"
                    className={`${styles.galleryModalArrow} ${styles.galleryModalArrowPrevious}`}
                    onClick={showPreviousGalleryImage}
                    type="button"
                  >
                    &lt;
                  </button>
                  <button
                    aria-label="Show next image"
                    className={`${styles.galleryModalArrow} ${styles.galleryModalArrowNext}`}
                    onClick={showNextGalleryImage}
                    type="button"
                  >
                    &gt;
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
