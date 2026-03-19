"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import styles from "./search-bar.module.css";

interface SearchBarProps {
  placeholder?: string;
  helperText?: string;
  filters?: string[];
  onFiltersOpenChange?: (isOpen: boolean) => void;
}

const filterOptions: Record<string, string[]> = {
  "For sale": ["For sale", "New construction", "Recently listed"],
  "For rent": ["For rent", "Long term", "Short term"],
  "Property type": ["House", "Apartment", "Land parcel"],
  "More filters": ["Parking", "Furnished", "Garden", "Pet friendly"],
};

function Chevron({ direction = "down" }: { direction?: "down" | "up" }) {
  return (
    <svg
      aria-hidden="true"
      className={styles.chevronIcon}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === "down" ? "M2.25 4.5 6 8.25 9.75 4.5" : "M2.25 7.5 6 3.75 9.75 7.5"}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function SearchBar({
  placeholder = "Search by UPI, listing, district, or sector",
  helperText,
  filters = [],
  onFiltersOpenChange,
}: SearchBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDesktopFilter, setActiveDesktopFilter] = useState<string | null>(null);
  const [activeMobileFilter, setActiveMobileFilter] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(10000000);
  const [bedroomSelection, setBedroomSelection] = useState("Any");
  const [bathroomSelection, setBathroomSelection] = useState("Any");
  const [useExactMatch, setUseExactMatch] = useState(false);
  const desktopFiltersRef = useRef<HTMLDivElement>(null);
  const priceRangeMax = 10000000;
  const minPercent = (minPrice / priceRangeMax) * 100;
  const maxPercent = (maxPrice / priceRangeMax) * 100;

  function formatPriceInput(value: number) {
    if (value <= 0) {
      return "";
    }

    return value.toLocaleString("en-US");
  }

  function openFilters() {
    setFiltersOpen(true);
    setActiveMobileFilter(filters[0] ?? null);
    onFiltersOpenChange?.(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
    onFiltersOpenChange?.(false);
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!desktopFiltersRef.current?.contains(event.target as Node)) {
        setActiveDesktopFilter(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div>
      <div className={styles.wrap}>
        <input className={styles.input} placeholder={placeholder} />
        <div className={styles.controls}>
          <Button type="button">Search</Button>
          <button className={styles.mobileFiltersButton} onClick={openFilters} type="button">
            Filters
          </button>
          <div className={styles.filters} ref={desktopFiltersRef}>
            {filters.map((filter) => (
              <div className={styles.filterGroup} key={filter}>
                <button
                  aria-expanded={activeDesktopFilter === filter}
                  className={styles.chip}
                  onClick={() => setActiveDesktopFilter(activeDesktopFilter === filter ? null : filter)}
                  type="button"
                >
                  {filter}
                  <span className={styles.chevron}>
                    <Chevron direction="down" />
                  </span>
                </button>
                {activeDesktopFilter === filter ? (
                  filter === "Price" ? (
                    <div className={`${styles.desktopDropdown} ${styles.priceDropdown}`}>
                      <div className={styles.priceSliderBlock}>
                        <div className={styles.priceFieldLabel}>Price range</div>
                        <div className={styles.priceSlider}>
                          <div className={styles.priceTrack} />
                          <div
                            className={styles.priceActiveTrack}
                            style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                          />
                          <input
                            className={styles.rangeInput}
                            max={Math.max(maxPrice - 100000, 0)}
                            min={0}
                            onChange={(event) => setMinPrice(Number(event.target.value))}
                            step={100000}
                            type="range"
                            value={minPrice}
                          />
                          <input
                            className={styles.rangeInput}
                            max={priceRangeMax}
                            min={Math.min(minPrice + 100000, priceRangeMax)}
                            onChange={(event) => setMaxPrice(Number(event.target.value))}
                            step={100000}
                            type="range"
                            value={maxPrice}
                          />
                          <span className={styles.priceHandle} style={{ left: `${minPercent}%` }} />
                          <span className={styles.priceHandle} style={{ left: `${maxPercent}%` }} />
                        </div>
                        <div className={styles.priceRangeMeta}>
                          <span>$0</span>
                          <span>$10M+</span>
                        </div>
                      </div>

                      <div className={styles.priceInputs}>
                        <label className={styles.priceField}>
                          <span className={styles.priceFieldLabel}>Min</span>
                          <input
                            className={styles.priceInput}
                            onChange={(event) => {
                              const numericValue = Number(event.target.value.replace(/,/g, ""));
                              if (Number.isNaN(numericValue)) {
                                return;
                              }

                              setMinPrice(Math.max(0, Math.min(numericValue, maxPrice - 100000)));
                            }}
                            placeholder="No min"
                            type="text"
                            value={formatPriceInput(minPrice)}
                          />
                        </label>
                        <span className={styles.priceSeparator}>-</span>
                        <label className={styles.priceField}>
                          <span className={styles.priceFieldLabel}>Max</span>
                          <input
                            className={styles.priceInput}
                            onChange={(event) => {
                              const numericValue = Number(event.target.value.replace(/,/g, ""));
                              if (Number.isNaN(numericValue)) {
                                return;
                              }

                              setMaxPrice(Math.min(priceRangeMax, Math.max(numericValue, minPrice + 100000)));
                            }}
                            placeholder="No max"
                            type="text"
                            value={maxPrice >= priceRangeMax ? "" : formatPriceInput(maxPrice)}
                          />
                        </label>
                      </div>
                      <div className={styles.filterActions}>
                        <button className={styles.filterApply} type="button">
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : filter === "Beds & baths" ? (
                    <div className={`${styles.desktopDropdown} ${styles.bedsDropdown}`}>
                      <div className={styles.filterSection}>
                        <div className={styles.filterSectionTitle}>Bedrooms</div>
                        <div className={styles.segmentedRow}>
                          {["Any", "1+", "2+", "3+", "4+", "5+"].map((option) => (
                            <button
                              className={`${styles.segmentButton} ${
                                bedroomSelection === option ? styles.segmentButtonSelected : ""
                              }`}
                              key={`bedroom-${option}`}
                              onClick={() => setBedroomSelection(option)}
                              type="button"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <label className={styles.checkboxRow}>
                          <input
                            checked={useExactMatch}
                            onChange={(event) => setUseExactMatch(event.target.checked)}
                            type="checkbox"
                          />
                          <span>Use exact match</span>
                        </label>
                      </div>

                      <div className={styles.filterSection}>
                        <div className={styles.filterSectionTitle}>Bathrooms</div>
                        <div className={styles.segmentedRow}>
                          {["Any", "1+", "1.5+", "2+", "3+", "4+"].map((option) => (
                            <button
                              className={`${styles.segmentButton} ${
                                bathroomSelection === option ? styles.segmentButtonSelected : ""
                              }`}
                              key={`bathroom-${option}`}
                              onClick={() => setBathroomSelection(option)}
                              type="button"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className={styles.filterActions}>
                        <button className={styles.filterApply} type="button">
                          Apply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.desktopDropdown}>
                      {filter === "Property type" || filter === "More filters" ? (
                        <div className={styles.checkboxList}>
                          {(filterOptions[filter] ?? []).map((option) => (
                            <label className={styles.checkboxOption} key={option}>
                              <input type="checkbox" />
                              <span>{option}</span>
                            </label>
                          ))}
                          <div className={styles.filterActions}>
                            <button className={styles.filterApply} type="button">
                              Apply
                            </button>
                          </div>
                        </div>
                      ) : (
                        (filterOptions[filter] ?? ["Any"]).map((option) => (
                          <button className={styles.desktopDropdownItem} key={option} type="button">
                            {option}
                          </button>
                        ))
                      )}
                    </div>
                  )
                ) : null}
              </div>
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
              <div className={styles.mobileFilterGroup} key={filter}>
                <button
                  aria-expanded={activeMobileFilter === filter}
                  className={styles.mobileOverlayItem}
                  onClick={() => setActiveMobileFilter(activeMobileFilter === filter ? null : filter)}
                  type="button"
                >
                  <span>{filter}</span>
                  <span className={styles.chevron}>
                    <Chevron direction={activeMobileFilter === filter ? "up" : "down"} />
                  </span>
                </button>
                {activeMobileFilter === filter ? (
                  <div className={styles.mobileFilterPanel}>
                    {filter === "Price" ? (
                      <>
                        <div className={styles.priceSliderBlock}>
                          <div className={styles.priceFieldLabel}>Price range</div>
                          <div className={styles.priceSlider}>
                            <div className={styles.priceTrack} />
                            <div
                              className={styles.priceActiveTrack}
                              style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                            />
                            <input
                              className={styles.rangeInput}
                              max={Math.max(maxPrice - 100000, 0)}
                              min={0}
                              onChange={(event) => setMinPrice(Number(event.target.value))}
                              step={100000}
                              type="range"
                              value={minPrice}
                            />
                            <input
                              className={styles.rangeInput}
                              max={priceRangeMax}
                              min={Math.min(minPrice + 100000, priceRangeMax)}
                              onChange={(event) => setMaxPrice(Number(event.target.value))}
                              step={100000}
                              type="range"
                              value={maxPrice}
                            />
                            <span className={styles.priceHandle} style={{ left: `${minPercent}%` }} />
                            <span className={styles.priceHandle} style={{ left: `${maxPercent}%` }} />
                          </div>
                          <div className={styles.priceRangeMeta}>
                            <span>$0</span>
                            <span>$10M+</span>
                          </div>
                        </div>

                        <div className={styles.priceInputs}>
                          <label className={styles.priceField}>
                            <span className={styles.priceFieldLabel}>Min</span>
                            <input
                              className={styles.priceInput}
                              onChange={(event) => {
                                const numericValue = Number(event.target.value.replace(/,/g, ""));
                                if (Number.isNaN(numericValue)) {
                                  return;
                                }

                                setMinPrice(Math.max(0, Math.min(numericValue, maxPrice - 100000)));
                              }}
                              placeholder="No min"
                              type="text"
                              value={formatPriceInput(minPrice)}
                            />
                          </label>
                          <span className={styles.priceSeparator}>-</span>
                          <label className={styles.priceField}>
                            <span className={styles.priceFieldLabel}>Max</span>
                            <input
                              className={styles.priceInput}
                              onChange={(event) => {
                                const numericValue = Number(event.target.value.replace(/,/g, ""));
                                if (Number.isNaN(numericValue)) {
                                  return;
                                }

                                setMaxPrice(Math.min(priceRangeMax, Math.max(numericValue, minPrice + 100000)));
                              }}
                              placeholder="No max"
                              type="text"
                              value={maxPrice >= priceRangeMax ? "" : formatPriceInput(maxPrice)}
                            />
                          </label>
                        </div>
                      </>
                    ) : filter === "Beds & baths" ? (
                      <>
                        <div className={styles.filterSection}>
                          <div className={styles.filterSectionTitle}>Bedrooms</div>
                          <div className={styles.segmentedRow}>
                            {["Any", "1+", "2+", "3+", "4+", "5+"].map((option) => (
                              <button
                                className={`${styles.segmentButton} ${
                                  bedroomSelection === option ? styles.segmentButtonSelected : ""
                                }`}
                                key={`mobile-bedroom-${option}`}
                                onClick={() => setBedroomSelection(option)}
                                type="button"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          <label className={styles.checkboxRow}>
                            <input
                              checked={useExactMatch}
                              onChange={(event) => setUseExactMatch(event.target.checked)}
                              type="checkbox"
                            />
                            <span>Use exact match</span>
                          </label>
                        </div>

                        <div className={styles.filterSection}>
                          <div className={styles.filterSectionTitle}>Bathrooms</div>
                          <div className={styles.segmentedRow}>
                            {["Any", "1+", "1.5+", "2+", "3+", "4+"].map((option) => (
                              <button
                                className={`${styles.segmentButton} ${
                                  bathroomSelection === option ? styles.segmentButtonSelected : ""
                                }`}
                                key={`mobile-bathroom-${option}`}
                                onClick={() => setBathroomSelection(option)}
                                type="button"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : filter === "Property type" || filter === "More filters" ? (
                      <div className={styles.checkboxList}>
                        {(filterOptions[filter] ?? []).map((option) => (
                          <label className={styles.checkboxOption} key={`mobile-${filter}-${option}`}>
                            <input type="checkbox" />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className={styles.checkboxList}>
                        {(filterOptions[filter] ?? []).map((option) => (
                          <label className={styles.checkboxOption} key={`mobile-${filter}-${option}`}>
                            <input name={`mobile-${filter}`} type="radio" />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            <div className={styles.filterActions}>
              <button className={styles.filterApply} onClick={closeFilters} type="button">
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
