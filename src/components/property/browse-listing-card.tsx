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
  const factsLabel = card.propertyType === "Land" ? "Land" : "Property";
  const location = [card.sector, card.district].filter(Boolean).join(", ");

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
        <div className={styles.mediaBadge}>{mediaLabel}</div>
        {!card.heroImageUrl ? (
          <div className={styles.mediaShapePrimary} />
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.price}>{price}</div>
        <div className={styles.facts}>
          {card.bedrooms ? `${card.bedrooms} bd` : factsLabel}
          {card.bathrooms ? ` | ${card.bathrooms} ba` : ""}
          {card.areaSqm ? ` | ${formatAreaSqm(card.areaSqm)}` : ""}
        </div>
        <div className={styles.title}>{card.title}</div>
        {location ? <div className={styles.meta}>{location}</div> : null}
      </div>
    </Link>
  );
}
