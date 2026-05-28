"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/search/search-bar";
import { BrowseMap } from "@/components/maps/browse-map";
import type { BrowseMapCard } from "@/components/maps/browse-map";
import { BrowseListingCard } from "@/components/property/browse-listing-card";

import styles from "./browse-page.module.css";

const MIN_DISPLAY_CARDS = 6;

interface BrowsePageProps {
  mode: "buy" | "rent";
}

export function BrowsePage({ mode }: BrowsePageProps) {
  const [showMobileMap, setShowMobileMap] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cards, setCards] = useState<BrowseMapCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  // Holds the last rich batch so we can fill in when the current view is sparse.
  const fallbackRef = useRef<BrowseMapCard[]>([]);

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

  // Scroll the selected card into view whenever selection changes.
  useEffect(() => {
    if (!selectedListingId) return;
    const el = document.querySelector(`[data-listing-id="${selectedListingId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedListingId]);

  const handleResultsChange = useCallback((incoming: BrowseMapCard[]) => {
    if (incoming.length >= MIN_DISPLAY_CARDS) {
      fallbackRef.current = incoming;
    }
    setCards(incoming);
  }, []);

  // Build the displayed list: always at least MIN_DISPLAY_CARDS entries by
  // padding with the most-recently-seen cards that aren't already visible.
  const visibleIds = new Set(cards.map((c) => c.listingId));
  const fillers = fallbackRef.current.filter((c) => !visibleIds.has(c.listingId));
  const displayCards =
    cards.length >= MIN_DISPLAY_CARDS
      ? cards
      : [...cards, ...fillers].slice(0, Math.max(cards.length, MIN_DISPLAY_CARDS));

  const countLabel = isLoading
    ? "Searching current view…"
    : cards.length === 0
      ? "No listings in this area"
      : `${cards.length} listing${cards.length === 1 ? "" : "s"} in the current view`;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <SearchBar
          filters={filters}
          onFiltersOpenChange={setFiltersOpen}
        />
        <div className={`${styles.layout} ${showMobileMap ? styles.mobileMapVisible : ""}`}>
          <div className={styles.mapCard}>
            <BrowseMap
              mode={mode}
              onResultsChange={handleResultsChange}
              onLoadingChange={setIsLoading}
              selectedListingId={selectedListingId}
              onSelectListing={setSelectedListingId}
            />
          </div>
          <div className={styles.resultsCard}>
            <div className={styles.resultsHead}>
              <div className={styles.eyebrow}>{mode === "buy" ? "Buy" : "Rent"}</div>
              <h1 className={styles.title}>{title}</h1>
              <div className={styles.subtitle}>{countLabel}</div>
            </div>
            <div className={styles.grid}>
              {displayCards.map((card) => (
                <BrowseListingCard
                  key={card.listingId}
                  card={card}
                  selected={card.listingId === selectedListingId}
                />
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
