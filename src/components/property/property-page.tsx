import { formatCurrency, formatDate } from "@/lib/format";
import { getAgencyById, getListingForProperty, getValuationsForProperty } from "@/lib/mock-data";
import type { Property } from "@/types/domain";

import { Button } from "../ui/button";
import styles from "./property-page.module.css";

interface PropertyPageProps {
  property: Property;
}

export function PropertyPage({ property }: PropertyPageProps) {
  const listing = getListingForProperty(property.id);
  const valuations = getValuationsForProperty(property.id);
  const agency = listing ? getAgencyById(listing.agencyId) : undefined;
  const latestValuation = valuations[0];
  const locationLabel = [property.location.village, property.location.cell, property.location.sector, property.location.district]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        <div className={`${styles.panel} ${styles.mapPanel}`}>
          <div className={styles.mapHeader}>
            <div>
              <div className={styles.panelEyebrow}>Parcel</div>
              <div className={styles.mapTitle}>Property outline</div>
            </div>
            <div className={styles.mapMeta}>{property.facts.landAreaSqm ? `${property.facts.landAreaSqm} sqm` : "Area unavailable"}</div>
          </div>
          <div className={styles.mapGrid}>
            <div className={styles.parcel} />
          </div>
        </div>
        <div className={`${styles.panel} ${styles.summary}`}>
          <div className={styles.eyebrow}>{locationLabel}</div>
          <h1 className={styles.title}>{property.title}</h1>
          <div className={styles.statusRow}>
            <div className={styles.status}>{listing ? "Listed" : "Not listed"}</div>
            {latestValuation ? (
              <div className={styles.inlineMeta}>
                Last valuation {formatDate(latestValuation.effectiveDate)}:{" "}
                {formatCurrency(latestValuation.estimatedValue, latestValuation.currency)}
              </div>
            ) : null}
          </div>
          <div className={styles.description}>{property.description}</div>
          <div className={styles.facts}>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Type</div>
              <div className={styles.factValue}>{property.facts.propertyType ?? "Property"}</div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Interior</div>
              <div className={styles.factValue}>{property.facts.areaSqm ? `${property.facts.areaSqm} sqm` : "Unknown"}</div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Beds / baths</div>
              <div className={styles.factValue}>
                {property.facts.bedrooms ?? "-"} bd / {property.facts.bathrooms ?? "-"} ba
              </div>
            </div>
            <div className={styles.fact}>
              <div className={styles.factLabel}>Parcel</div>
              <div className={styles.factValue}>{property.facts.landAreaSqm ? `${property.facts.landAreaSqm} sqm` : "Unknown"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.secondaryGrid}>
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
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {valuations.map((valuation) => (
                  <tr key={valuation.id}>
                    <td>{formatDate(valuation.effectiveDate)}</td>
                    <td>{formatCurrency(valuation.estimatedValue, valuation.currency)}</td>
                    <td>{formatDate(valuation.createdAt)}</td>
                  </tr>
                ))}
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
                <div className={styles.ctaGroup}>
                  <Button>Contact agent</Button>
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
                <span>{property.id}</span>
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
