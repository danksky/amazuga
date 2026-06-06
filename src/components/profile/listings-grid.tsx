"use client";

import { useState } from "react";

import { BrowseListingCard } from "@/components/property/browse-listing-card";
import type { BrowseMapCard } from "@/lib/server/browse-map";

import styles from "./profile-page.module.css";

type MarketingFilter = "sale" | "rent";

function getTypeGroup(propertyType?: string): string | undefined {
  if (!propertyType) return undefined;
  const t = propertyType.toLowerCase();
  if (t.includes("house")) return "House";
  if (t.includes("land")) return "Land";
  if (t.includes("apartment")) return "Apartment";
  if (t.includes("commercial")) return "Commercial";
  return undefined;
}

interface ListingsGridProps {
  listings: BrowseMapCard[];
}

export function ListingsGrid({ listings }: ListingsGridProps) {
  const hasSale = listings.some((l) => l.marketingType === "sale");
  const hasRent = listings.some((l) => l.marketingType === "rent");
  const showMarketingToggle = hasSale && hasRent;

  const [marketingFilter, setMarketingFilter] = useState<MarketingFilter>(hasSale ? "sale" : "rent");
  const [typeFilter, setTypeFilter] = useState("all");

  const typeSet = new Set<string>();
  for (const card of listings) {
    const group = getTypeGroup(card.propertyType);
    if (group) typeSet.add(group);
  }
  const availableTypes = [...typeSet].sort();
  const showTypeFilter = availableTypes.length > 1;

  const filtered = listings.filter((card) => {
    if (showMarketingToggle && card.marketingType !== marketingFilter) return false;
    if (typeFilter !== "all" && getTypeGroup(card.propertyType) !== typeFilter) return false;
    return true;
  });

  const countLabel =
    filtered.length === 0
      ? "No listings match"
      : `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`;

  return (
    <div className={styles.resultsCard}>
      <div className={styles.resultsHead}>
        <div className={styles.subtitle}>{countLabel}</div>
        {(showMarketingToggle || showTypeFilter) ? (
          <div className={styles.controls}>
            {showMarketingToggle ? (
              <div className={styles.segControl}>
                <button
                  className={`${styles.segTab} ${marketingFilter === "sale" ? styles.segTabActive : ""}`}
                  onClick={() => setMarketingFilter("sale")}
                  type="button"
                >
                  For sale
                </button>
                <button
                  className={`${styles.segTab} ${marketingFilter === "rent" ? styles.segTabActive : ""}`}
                  onClick={() => setMarketingFilter("rent")}
                  type="button"
                >
                  For rent
                </button>
              </div>
            ) : null}
            {showMarketingToggle && showTypeFilter ? (
              <div className={styles.filterDivider} />
            ) : null}
            {showTypeFilter ? (
              <div className={styles.filterTabs}>
                <button
                  className={`${styles.filterTab} ${typeFilter === "all" ? styles.filterTabActive : ""}`}
                  onClick={() => setTypeFilter("all")}
                  type="button"
                >
                  All
                </button>
                {availableTypes.map((type) => (
                  <button
                    className={`${styles.filterTab} ${typeFilter === type ? styles.filterTabActive : ""}`}
                    key={type}
                    onClick={() => setTypeFilter(type)}
                    type="button"
                  >
                    {type}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>No listings match the selected filters.</div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((card) => (
            <BrowseListingCard key={card.listingId} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
