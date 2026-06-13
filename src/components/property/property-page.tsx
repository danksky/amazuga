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
  isListingOwner?: boolean;
  isLoggedIn?: boolean;
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

function buildFactItems(property: Property, propertyKind?: PropertyKind): FactItem[] {
  const items: FactItem[] = [];

  switch (propertyKind) {
    case "land":
      if (property.facts.zoningLabel) items.push({ label: "Use zone", value: property.facts.zoningLabel });
      break;
    case "apartment_unit":
      if (property.facts.yearBuilt) items.push({ label: "Year built", value: String(property.facts.yearBuilt) });
      break;
    case "apartment_building":
    case "commercial_building":
      if (property.facts.zoningLabel) items.push({ label: "Use zone", value: property.facts.zoningLabel });
      break;
    case "commercial_unit":
      if (property.facts.zoningLabel) items.push({ label: "Use zone", value: property.facts.zoningLabel });
      break;
    case "house":
    default:
      if (property.facts.landAreaSqm) items.push({ label: "Parcel", value: formatAreaSqm(property.facts.landAreaSqm) });
      if (property.facts.yearBuilt) items.push({ label: "Year built", value: String(property.facts.yearBuilt) });
      break;
  }

  return items;
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
  // When location_hidden is on, suppress the map even for parcel-linked properties.
  const locationSuppressed = isParcelLinked && (listing?.locationHidden ?? false);
  const mediaMode: PropertyPageBehavior["mediaMode"] =
    hasGallery ? "gallery" : (isParcelLinked && !locationSuppressed) ? "map" : "none";
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
  isListingOwner = false,
  isLoggedIn = false,
}: PropertyPageProps) {
  const latestValuation = valuations[0];
  const locationLabel = [property.location.village, property.location.cell, property.location.sector, property.location.district]
    .filter(Boolean)
    .join(", ");
  const isParcelLinked = !property.locationSource || property.locationSource === "parcel";
  // Show directions and map references only when location is precise and not suppressed by owner.
  const showPreciseLocation = isParcelLinked && !(listing?.locationHidden ?? false);
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${property.location.lat},${property.location.lng}`;
  const propertyRouteId = property.id;
  const propertyPath = routes.public.property(propertyRouteId, {
    propertyTitle: property.title,
    parcelDisplayId: property.parcelDisplayId,
    propertyKind: property.facts.propertyKind,
    unitLabel: property.unitLabel,
  });
  type MediaItem =
    | { type: "image"; url: string }
    | { type: "video"; url: string; thumbnailUrl?: string; streamUid?: string };

  const galleryMedia: MediaItem[] = [
    ...(listing?.imageUrls ?? []).map((url): MediaItem => ({ type: "image", url })),
    ...(listing?.videoUrl
      ? [{
          type: "video" as const,
          url: listing.videoUrl,
          thumbnailUrl: listing.videoThumbnailUrl,
          streamUid: listing.videoStreamUid,
        }]
      : []),
  ];
  const primaryItem = galleryMedia[0];
  const secondaryItem = galleryMedia[1];
  const tertiaryItem = galleryMedia[2];
  const hasGallery = galleryMedia.length > 0;
  const hasVideo = Boolean(listing?.videoUrl);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const closeGalleryButtonRef = useRef<HTMLButtonElement | null>(null);
  const propertyKind = inferPropertyKind(property);
  const behavior = buildPropertyPageBehavior(property, propertyKind, listing, hasGallery);
  const detailItems = buildDetailItems(property, propertyKind);
  const listingStateLabel = buildListingStateLabel(listing);
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
  const activeGalleryItem = galleryMedia[activeGalleryIndex];
  const hasMultipleGalleryItems = galleryMedia.length > 1;

  async function shareProperty() {
    const url = window.location.href;
    const title = property.title;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  function openGalleryModal(imageIndex = 0) {
    setActiveGalleryIndex(imageIndex);
    setGalleryModalOpen(true);
  }

  function showPreviousGalleryItem() {
    setActiveGalleryIndex((current) => (current - 1 + galleryMedia.length) % galleryMedia.length);
  }

  function showNextGalleryItem() {
    setActiveGalleryIndex((current) => (current + 1) % galleryMedia.length);
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

      if (!hasMultipleGalleryItems) {
        return;
      }

      if (event.key === "ArrowLeft") {
        setActiveGalleryIndex((current) => (current - 1 + galleryMedia.length) % galleryMedia.length);
      }

      if (event.key === "ArrowRight") {
        setActiveGalleryIndex((current) => (current + 1) % galleryMedia.length);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [galleryModalOpen, hasMultipleGalleryItems, galleryMedia.length]);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.pageGrid}>
        <div className={styles.leftRail}>
          {behavior.mediaMode === "gallery" && primaryItem ? (
            <div className={`${styles.panel} ${styles.mediaPanel}`}>
              <div className={`${styles.gallery}${!secondaryItem ? ` ${styles.gallerySingle}` : ""}`}>
                <div className={styles.galleryPrimary} onClick={() => openGalleryModal(0)} style={{ cursor: "pointer" }}>
                  {primaryItem.type === "video" ? (
                    <div className={styles.galleryVideoThumb}>
                      {primaryItem.thumbnailUrl
                        ? <img alt={`${property.title} video`} className={styles.galleryImage} src={primaryItem.thumbnailUrl} />
                        : <div className={styles.galleryImage} />}
                      <div className={styles.galleryPlayOverlay} aria-hidden="true">
                        <svg fill="white" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="24" cy="24" fill="rgba(0,0,0,0.5)" r="24" />
                          <polygon fill="white" points="19,14 38,24 19,34" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <img alt={property.title} className={styles.galleryImage} src={primaryItem.url} />
                  )}
                </div>
                {tertiaryItem ? (
                  <div className={styles.galleryStack}>
                    <div className={styles.gallerySecondary}>
                      {secondaryItem?.type === "video" ? (
                        <div className={styles.galleryVideoThumb} onClick={() => openGalleryModal(1)} style={{ cursor: "pointer" }}>
                          {secondaryItem.thumbnailUrl
                            ? <img alt={`${property.title} video`} className={styles.galleryImage} src={secondaryItem.thumbnailUrl} />
                            : <div className={styles.galleryImage} />}
                          <div className={styles.galleryPlayOverlay} aria-hidden="true">
                            <svg fill="white" height="36" viewBox="0 0 48 48" width="36" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="24" cy="24" fill="rgba(0,0,0,0.5)" r="24" />
                              <polygon fill="white" points="19,14 38,24 19,34" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <img alt={`${property.title} view 2`} className={styles.galleryImage} src={secondaryItem?.url} />
                      )}
                    </div>
                    <div className={`${styles.gallerySecondary} ${styles.gallerySecondaryAction}`}>
                      {tertiaryItem.type === "video" ? (
                        <div className={styles.galleryVideoThumb}>
                          {tertiaryItem.thumbnailUrl
                            ? <img alt={`${property.title} video`} className={styles.galleryImage} src={tertiaryItem.thumbnailUrl} />
                            : <div className={styles.galleryImage} />}
                          <div className={styles.galleryPlayOverlay} aria-hidden="true">
                            <svg fill="white" height="36" viewBox="0 0 48 48" width="36" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="24" cy="24" fill="rgba(0,0,0,0.5)" r="24" />
                              <polygon fill="white" points="19,14 38,24 19,34" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <img alt={`${property.title} view 3`} className={styles.galleryImage} src={tertiaryItem.url} />
                      )}
                    </div>
                  </div>
                ) : secondaryItem ? (
                  <div className={`${styles.gallerySecondary} ${styles.gallerySecondaryAction} ${styles.gallerySecondaryFull}`}>
                    {secondaryItem.type === "video" ? (
                      <div className={styles.galleryVideoThumb} onClick={() => openGalleryModal(1)} style={{ cursor: "pointer" }}>
                        {secondaryItem.thumbnailUrl
                          ? <img alt={`${property.title} video`} className={styles.galleryImage} src={secondaryItem.thumbnailUrl} />
                          : <div className={styles.galleryImage} />}
                        <div className={styles.galleryPlayOverlay} aria-hidden="true">
                          <svg fill="white" height="36" viewBox="0 0 48 48" width="36" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="24" cy="24" fill="rgba(0,0,0,0.5)" r="24" />
                            <polygon fill="white" points="19,14 38,24 19,34" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <img alt={`${property.title} view 2`} className={styles.galleryImage} src={secondaryItem.url} />
                    )}
                  </div>
                ) : null}
                {hasMultipleGalleryItems ? (
                  <button className={styles.galleryCta} onClick={() => openGalleryModal(0)} type="button">
                    {hasVideo ? "See all media" : "See all images"}
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

          {behavior.mediaMode === "gallery" && isParcelLinked && !listing?.locationHidden ? (
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
            {isListingOwner && listing ? (
              <Link href={routes.app.portalListingEdit(listing.id)} className={styles.editListingBtn} title="Edit listing">
                <i className="bi bi-pencil" />
              </Link>
            ) : null}
            <div className={styles.metaBadgeRow}>
              <span className={styles.metaBadge}>
                <span className={styles.metaBadgeType}>{behavior.kindLabel}</span>
                <span className={styles.metaBadgeState}>{listingStateLabel.toLowerCase()}</span>
              </span>
            </div>
            <div className={styles.eyebrow}>{locationLabel}</div>
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
            <hr className={styles.separator} />
            {listing ? (
              <>
                <div className={styles.contactIdentity}>
                  <div className={styles.contactDetailRow}>
                    <div className={styles.contactDetailLabel}>Agent:</div>
                    <div className={styles.contactDetailValue}>
                      {agency && listing?.agentUserId ? (
                        <Link className={styles.contactLink} href={routes.public.agent(listing.agentUserId)}>
                          {contactName ?? agency.businessName}
                        </Link>
                      ) : (contactName ?? agency?.businessName ?? "Owner")}
                    </div>
                  </div>
                  <div className={styles.contactDetailRow}>
                    <div className={styles.contactDetailLabel}>Agency:</div>
                    <div className={styles.contactDetailValue}>
                      {agency ? (
                        <Link className={styles.contactLink} href={routes.public.agency(agency.slug)}>
                          {agency.businessName}
                        </Link>
                      ) : "For sale by owner"}
                    </div>
                  </div>
                </div>
                <div className={styles.ctaGroup}>
                  <a
                    className={styles.whatsappAction}
                    href={routes.public.propertyWhatsapp(propertyRouteId)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <i className="bi bi-whatsapp" />{" "}Inquire via WhatsApp
                  </a>
                  <button className={styles.actionLinkSecondary} onClick={shareProperty} type="button">
                    <i className={shareCopied ? "bi bi-check2" : "bi bi-share"} />{" "}{shareCopied ? "Link copied!" : "Share property"}
                  </button>
                  <form action={toggleSavePropertyAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit" variant="secondary"><i className="bi bi-bookmark" />{" "}{isSaved ? "Saved" : "Save property"}</Button>
                  </form>
                  {showPreciseLocation ? (
                    <a
                      className={styles.actionLinkSecondary}
                      href={directionsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="bi bi-geo-alt" />{" "}Get directions
                    </a>
                  ) : null}
                  {isParcelLinked && property.upi ? (
                    <Link
                      className={styles.disputeLink}
                      href={`${routes.app.portalPropertyContest}?property=${encodeURIComponent(propertyRouteId)}`}
                    >
                      <i className="bi bi-flag" />{" "}Dispute ownership
                    </Link>
                  ) : null}
                </div>
                {!canCreateListing ? (
                  <>
                    <hr className={styles.separator} />
                    <div className={styles.createListingNudge}>
                      <p className={styles.createListingNudgeText}>Want to list your own property?</p>
                      <Link
                        className={styles.actionLinkSecondary}
                        href={isLoggedIn ? routes.public.sell : `${routes.auth.signup}?next=${encodeURIComponent(routes.public.sell)}`}
                      >
                        <i className="bi bi-plus-circle" />{" "}Create your own listing
                      </Link>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className={styles.ctaGroup}>
                {claimState === "owned" ? (
                  <>
                    <Link className={styles.actionLinkPrimary} href={routes.app.portalProperties}>
                      <i className="bi bi-building" />{" "}View owned properties
                    </Link>
                    {canCreateListing ? (
                      <Link
                        className={styles.actionLinkSecondary}
                        href={`${routes.app.portalListingNew}?property=${encodeURIComponent(propertyRouteId)}`}
                      >
                        <i className="bi bi-plus-circle" />{" "}Create listing
                      </Link>
                    ) : null}
                  </>
                ) : claimState === "pending" ? (
                  <Button disabled><i className="bi bi-hourglass-split" />{" "}Claim pending review</Button>
                ) : !isParcelLinked ? null : (
                  <form action={startPropertyClaimAction}>
                    <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                    <input name="propertyPath" type="hidden" value={propertyPath} />
                    <Button type="submit"><i className="bi bi-key" />{" "}{behavior.claimLabel}</Button>
                  </form>
                )}
                <form action={toggleSavePropertyAction}>
                  <input name="propertyRouteId" type="hidden" value={propertyRouteId} />
                  <input name="propertyPath" type="hidden" value={propertyPath} />
                  <Button type="submit" variant="secondary"><i className="bi bi-bookmark" />{" "}{isSaved ? "Saved" : "Save property"}</Button>
                </form>
                {isParcelLinked ? (
                  <a
                    className={styles.actionLinkSecondary}
                    href={directionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bi bi-geo-alt" />{" "}Get directions
                  </a>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      {galleryModalOpen && activeGalleryItem ? (
        <div
          aria-label={`${property.title} media gallery`}
          aria-modal="true"
          className={styles.galleryModalBackdrop}
          onClick={() => setGalleryModalOpen(false)}
          role="dialog"
        >
          <div className={styles.galleryModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.galleryModalImageFrame}>
              <div className={styles.galleryModalCounter}>
                {activeGalleryIndex + 1} / {galleryMedia.length}
              </div>
              <button
                aria-label="Close media gallery"
                className={styles.galleryModalClose}
                onClick={() => setGalleryModalOpen(false)}
                ref={closeGalleryButtonRef}
                type="button"
              >
                Close
              </button>
              {activeGalleryItem.type === "video" ? (
                activeGalleryItem.streamUid ? (
                  <iframe
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    className={`${styles.galleryModalVideo} ${styles.galleryModalStream}`}
                    key={activeGalleryItem.streamUid}
                    src={`https://iframe.videodelivery.net/${encodeURIComponent(activeGalleryItem.streamUid)}?autoplay=true&muted=true&controls=true&playsinline=true`}
                    style={{ border: "none" }}
                    title={`${property.title} video`}
                  />
                ) : (
                  <video
                    autoPlay
                    className={styles.galleryModalVideo}
                    controls
                    key={activeGalleryItem.url}
                    muted
                    playsInline
                    poster={activeGalleryItem.thumbnailUrl}
                    src={activeGalleryItem.url}
                  />
                )
              ) : (
                <img
                  alt={`${property.title} view ${activeGalleryIndex + 1}`}
                  className={styles.galleryModalImage}
                  src={activeGalleryItem.url}
                />
              )}
              {hasMultipleGalleryItems ? (
                <>
                  <button
                    aria-label="Show previous"
                    className={`${styles.galleryModalArrow} ${styles.galleryModalArrowPrevious}`}
                    onClick={showPreviousGalleryItem}
                    type="button"
                  >
                    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                  </button>
                  <button
                    aria-label="Show next"
                    className={`${styles.galleryModalArrow} ${styles.galleryModalArrowNext}`}
                    onClick={showNextGalleryItem}
                    type="button"
                  >
                    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
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
