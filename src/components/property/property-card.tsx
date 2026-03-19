import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import { getListingForProperty, getValuationsForProperty } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import type { Property } from "@/types/domain";

import styles from "./property-card.module.css";

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const listing = getListingForProperty(property.id);
  const latestValuation = getValuationsForProperty(property.id)[0];
  const price = listing
    ? formatCurrency(listing.askingPrice, listing.currency)
    : latestValuation
      ? formatCurrency(latestValuation.estimatedValue, latestValuation.currency)
      : "Market estimate unavailable";
  const priceLabel = listing ? null : latestValuation ? "Market estimate" : "Not listed";
  const mediaVariant = listing?.marketingType ?? "sale";
  const mediaLabel =
    property.facts.propertyType === "Apartment"
      ? "Apartment"
      : property.facts.propertyType === "Parcel"
        ? "Parcel"
        : "House";

  return (
    <Link className={styles.card} href={routes.public.property(property.id)}>
      <div
        aria-hidden="true"
        className={`${styles.media} ${mediaVariant === "rent" ? styles.mediaRent : styles.mediaSale} ${
          property.facts.propertyType === "Parcel" ? styles.mediaParcel : ""
        }`}
      >
        <div className={styles.mediaBadge}>{mediaLabel}</div>
        <div className={styles.mediaShapePrimary} />
        <div className={styles.mediaShapeSecondary} />
        <div className={styles.mediaShapeTertiary} />
      </div>
      <div className={styles.body}>
        {priceLabel ? <div className={styles.priceLabel}>{priceLabel}</div> : null}
        <div className={styles.price}>{price}</div>
        <div className={styles.facts}>
          {property.facts.bedrooms ? `${property.facts.bedrooms} bd` : "Parcel"}
          {property.facts.bathrooms ? ` | ${property.facts.bathrooms} ba` : ""}
          {property.facts.areaSqm ? ` | ${property.facts.areaSqm} sqm` : ""}
        </div>
        <div className={styles.title}>{property.title}</div>
        <div className={styles.meta}>
          {property.location.sector}, {property.location.district}
        </div>
      </div>
    </Link>
  );
}
