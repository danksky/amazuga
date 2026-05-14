"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search/search-bar";
import { PropertyCard } from "@/components/property/property-card";
import type { PublicListingCardData } from "@/lib/server/public-listings";

import styles from "./browse-page.module.css";

interface BrowsePageProps {
  mode: "buy" | "rent";
  listings: PublicListingCardData[];
}

export function BrowsePage({ mode, listings }: BrowsePageProps) {
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const title = mode === "buy" ? "Homes for sale in Rwanda" : "Homes for rent in Rwanda";
  const filters = ["Price", "Beds & baths", "Property type", "More filters"];

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    
    function syncScrollLock() {
      const shouldLockScroll = window.innerWidth > 1100;
      document.body.style.overflow = shouldLockScroll ? "hidden" : previousBodyOverflow;
      document.documentElement.style.overflow = shouldLockScroll ? "hidden" : previousHtmlOverflow;
    }

    syncScrollLock();
    window.addEventListener("resize", syncScrollLock);

    return () => {
      window.removeEventListener("resize", syncScrollLock);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <SearchBar
          filters={filters}
          onFiltersOpenChange={setFiltersOpen}
        />
        <div className={`${styles.layout} ${showMobileMap ? styles.mobileMapVisible : ""}`}>
          <div className={styles.mapCard}>
            <div className={styles.mapCanvas}>
              <div className={styles.boundary} />
              <div className={styles.pin} style={{ left: "21%", top: "34%" }}>
                185M
              </div>
              <div className={styles.pin} style={{ left: "56%", top: "56%" }}>
                950k
              </div>
              <div className={styles.pin} style={{ left: "65%", top: "28%" }}>
                Parcel
              </div>
            </div>
          </div>
          <div className={styles.resultsCard}>
            <div className={styles.resultsHead}>
              <div className={styles.eyebrow}>{mode === "buy" ? "Buy" : "Rent"}</div>
              <h1 className={styles.title}>{title}</h1>
              <div className={styles.subtitle}>{listings.length} live listings in the current view</div>
            </div>
            <div className={styles.grid}>
              {listings.map(({ property, listing }) => (
                <PropertyCard key={listing.id} listing={listing} property={property} />
              ))}
            </div>
          </div>
        </div>
        {!filtersOpen ? (
          <div className={styles.mobileToggle}>
            <Button onClick={() => setShowMobileMap((current) => !current)} type="button">
              {showMobileMap ? "Show listings" : "Use map"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
