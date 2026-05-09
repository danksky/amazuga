"use client";

import { useState } from "react";

import { PropertyParcelMap } from "@/components/maps/property-parcel-map";
import { formatAreaSqm, formatCurrency, formatDate } from "@/lib/format";
import { getAgencyById, getListingForProperty, getUserById, getValuationsForProperty } from "@/lib/mock-data";
import type { Property } from "@/types/domain";

import { Button } from "../ui/button";
import styles from "./property-page.module.css";

interface PropertyPageProps {
  property: Property;
}

export function PropertyPage({ property }: PropertyPageProps) {
  const [showWhatsapp, setShowWhatsapp] = useState(false);
  const listing = getListingForProperty(property.id);
  const valuations = getValuationsForProperty(property.id);
  const agency = listing ? getAgencyById(listing.agencyId) : undefined;
  const latestValuation = valuations[0];
  const locationLabel = [property.location.village, property.location.cell, property.location.sector, property.location.district]
    .filter(Boolean)
    .join(", ");
  const zoningLabel = property.facts.zoningLabel;
  const summaryDescription = property.facts.propertyType === "Parcel" ? undefined : property.description;
  const galleryImages = listing?.imageUrls ?? [];
  const primaryImage = galleryImages[0];
  const secondaryImage = galleryImages[1] ?? galleryImages[0];
  const tertiaryImage = galleryImages[2] ?? galleryImages[1] ?? galleryImages[0];

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        {listing && primaryImage ? (
          <div className={`${styles.panel} ${styles.mediaPanel}`}>
            <div className={styles.gallery}>
              <div className={styles.galleryPrimary}>
                <img alt={listing.headline ?? property.title} className={styles.galleryImage} src={primaryImage} />
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
          <div className={styles.statusRow}>
            <div className={styles.status}>{listing ? "Listed" : "Not listed"}</div>
            {listing ? (
              <div className={styles.inlineMeta}>Listed at {formatCurrency(listing.askingPrice, listing.currency)}</div>
            ) : latestValuation ? (
              <div className={styles.inlineMeta}>
                Market estimate based on {formatDate(latestValuation.effectiveDate)}:{" "}
                {formatCurrency(latestValuation.estimatedValue, latestValuation.currency)}
              </div>
            ) : null}
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
          {zoningLabel ? <div className={styles.description}>{zoningLabel}</div> : null}
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Type</div>
              <div className={styles.factValue}>{property.facts.propertyType ?? "Property"}</div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Interior</div>
              <div className={styles.factValue}>{property.facts.areaSqm ? formatAreaSqm(property.facts.areaSqm) : "Unknown"}</div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Beds / baths</div>
              <div className={styles.factValue}>
                {property.facts.bedrooms ?? "-"} bd / {property.facts.bathrooms ?? "-"} ba
              </div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Parcel</div>
              <div className={styles.factValue}>{property.facts.landAreaSqm ? formatAreaSqm(property.facts.landAreaSqm) : "Unknown"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.mapSection}>
        <div className={`${styles.panel} ${styles.section}`}>
          <div className={styles.mapHeader}>
            <div>
              <div className={styles.panelEyebrow}>Map</div>
              <div className={styles.mapTitle}>Parcel context</div>
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
                  const valuator = getUserById(valuation.submittedByUserId);
                  const valuatorLabel = valuation.isAnonymous ? "Anonymous" : valuator?.fullName ?? "Unknown valuator";

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
              <h2 className={styles.sectionTitle}>{listing ? "Active listing" : "Property actions"}</h2>
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
                  <Button variant="secondary">Save property</Button>
                </div>
              </div>
            ) : (
              <div className={styles.nonListedState}>
                <div className={styles.nonListedTitle}>This property is not currently listed.</div>
                <div className={styles.nonListedBody}>
                  You can claim the home or contribute a valuation when you have relevant information.
                </div>
                <div className={styles.ctaGroup}>
                  <Button>Claim this home</Button>
                  <Button variant="secondary">Submit a valuation</Button>
                </div>
              </div>
            )}
          </div>
          <div className={`${styles.panel} ${styles.section}`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Property details</h2>
            </div>
            <div className={styles.detailList}>
              <div className={styles.detailRow}>
                <span>District</span>
                <span>{property.location.district}</span>
              </div>
              {property.location.sector ? (
                <div className={styles.detailRow}>
                  <span>Sector</span>
                  <span>{property.location.sector}</span>
                </div>
              ) : null}
              {property.location.cell ? (
                <div className={styles.detailRow}>
                  <span>Cell</span>
                  <span>{property.location.cell}</span>
                </div>
              ) : null}
              {property.location.village ? (
                <div className={styles.detailRow}>
                  <span>Village</span>
                  <span>{property.location.village}</span>
                </div>
              ) : null}
              {property.facts.yearBuilt ? (
                <div className={styles.detailRow}>
                  <span>Year built</span>
                  <span>{property.facts.yearBuilt}</span>
                </div>
              ) : null}
              <div className={styles.detailRow}>
                <span>Amazuga ID</span>
                <span>{property.publicId ?? property.id}</span>
              </div>
            </div>
          </div>
          {!listing ? (
            <div className={`${styles.panel} ${styles.section}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>About claiming</h2>
              </div>
              <div className={styles.infoBlock}>
                Claiming is available on non-listed properties. The downstream verification flow is still being defined, so
                this currently acts as the entry point into that process.
              </div>
            </div>
          ) : (
            <div className={`${styles.panel} ${styles.section}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Listing notes</h2>
              </div>
              <div className={styles.infoBlock}>
                This property page is canonical. Listing information appears here when the property has an active listing.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
