"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./search-bar.module.css";

interface SearchBarProps {
  placeholder?: string;
  helperText?: string;
  filters?: string[];
  onFiltersOpenChange?: (isOpen: boolean) => void;
}

export function SearchBar({
  placeholder = "Search by UPI, listing, district, or sector",
  helperText,
  filters = [],
  onFiltersOpenChange,
}: SearchBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  function openFilters() {
    setFiltersOpen(true);
    onFiltersOpenChange?.(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
    onFiltersOpenChange?.(false);
  }

  return (
    <div>
      <div className={styles.wrap}>
        <input className={styles.input} placeholder={placeholder} />
        <div className={styles.controls}>
          <Button type="button">Search</Button>
          <button className={styles.mobileFiltersButton} onClick={openFilters} type="button">
            Filters
          </button>
          <div className={styles.filters}>
            {filters.map((filter) => (
              <button className={styles.chip} key={filter} onClick={openFilters} type="button">
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>
      {helperText ? <div className={styles.helper}>{helperText}</div> : null}
      {filtersOpen ? (
        <div className={styles.mobileOverlay}>
          <div className={styles.mobileOverlayHeader}>
            <div className={styles.mobileOverlayTitle}>Filters</div>
            <button className={styles.mobileFiltersButton} onClick={closeFilters} type="button">
              Close
            </button>
          </div>
          <div className={styles.mobileOverlayBody}>
            {filters.map((filter) => (
              <button className={styles.mobileOverlayItem} key={filter} type="button">
                {filter}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
