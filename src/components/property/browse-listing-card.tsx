import Link from "next/link";

import { formatAreaSqm, formatCurrency } from "@/lib/format";
import { buildPublicPropertyPath } from "@/lib/property-slug";
import type { BrowseMapCard } from "@/lib/server/browse-map";

import styles from "./property-card.module.css";

interface BrowseListingCardProps {
  card: BrowseMapCard;
  selected?: boolean;
}

export function BrowseListingCard({ card, selected }: BrowseListingCardProps) {
  const price = formatCurrency(card.priceLabelRwf, "RWF");
  const mediaVariant = card.marketingType;
  const mediaLabel = card.propertyType ?? "Property";
  const location = [card.sector, card.district].filter(Boolean).join(", ");
  const isLand = card.propertyType === "Land";
  const facts: { label: string; value: string }[] = [];
  if (card.bedrooms) facts.push({ label: "Beds", value: String(card.bedrooms) });
  if (card.bathrooms) facts.push({ label: "Baths", value: String(card.bathrooms) });
  if (isLand && card.landAreaSqm) {
    facts.push({ label: "Plot size", value: `${Math.round(card.landAreaSqm)} m²` });
  } else if (!isLand && card.areaSqm) {
    facts.push({ label: "Area", value: formatAreaSqm(card.areaSqm) });
  }

  return (
    <Link
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      data-listing-id={card.listingId}
      href={buildPublicPropertyPath(card.routeId, card.title)}
    >
      <div
        aria-hidden="true"
        className={`${styles.media} ${mediaVariant === "rent" ? styles.mediaRent : styles.mediaSale}`}
      >
        {card.heroImageUrl ? (
          <img
            alt=""
            className={styles.mediaImage}
            src={card.heroImageUrl}
          />
        ) : null}
        <div className={styles.splitBadge}>
          <span className={styles.splitBadgeType}>{mediaLabel}</span>
          <span className={styles.splitBadgeState}>{card.marketingType === "rent" ? "for rent" : "for sale"}</span>
        </div>
        {!card.heroImageUrl ? (
          <div className={styles.mediaShapePrimary} />
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.price}>{price}</div>
        <div className={styles.title}>{card.title}</div>
        {location ? <div className={styles.meta}>{location}</div> : null}
        {facts.length > 0 ? (
          <div className={styles.factGrid}>
            {facts.map((fact) => (
              <div className={styles.factCell} key={fact.label}>
                <div className={styles.factLabel}>{fact.label}</div>
                <div className={styles.factValue}>{fact.value}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
