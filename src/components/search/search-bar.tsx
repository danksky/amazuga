"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import type { BrowseFilters, LocationSuggestion } from "@/lib/browse-types";

import styles from "./search-bar.module.css";

interface SearchBarProps {
  placeholder?: string;
  helperText?: string;
  filters?: string[];
  onFiltersOpenChange?: (isOpen: boolean) => void;
  onFiltersChange?: (filters: BrowseFilters) => void;
}

const PROPERTY_TYPE_OPTIONS = ["House", "Apartment", "Land parcel"];

const LEVEL_LABEL: Record<string, string> = {
  village:  "Village in",
  cell:     "Cell in",
  sector:   "Sector in",
  district: "District in",
};

function parseBedValue(val: string): number | undefined {
  if (val === "Any") return undefined;
  return parseFloat(val.replace("+", ""));
}

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
  placeholder = "Search by location, district, or sector",
  helperText,
  filters = [],
  onFiltersOpenChange,
  onFiltersChange,
}: SearchBarProps) {
  const router = useRouter();

  // Text input & UPI search
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  // Location autocomplete
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | undefined>();
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter dropdowns
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDesktopFilter, setActiveDesktopFilter] = useState<string | null>(null);
  const [activeMobileFilter, setActiveMobileFilter] = useState<string | null>(null);
  const desktopFiltersRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);

  // Price state (RWF)
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();

  // Beds & baths
  const [bedroomSelection, setBedroomSelection] = useState("Any");
  const [bathroomSelection, setBathroomSelection] = useState("Any");
  const [useExactMatch, setUseExactMatch] = useState(false);

  // Property type
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  function buildFilters(overrides?: Partial<BrowseFilters>): BrowseFilters {
    return {
      location: selectedLocation,
      minPriceRwf: minPrice,
      maxPriceRwf: maxPrice,
      propertyTypes: selectedTypes.length ? selectedTypes : undefined,
      minBedrooms: parseBedValue(bedroomSelection),
      minBathrooms: parseBedValue(bathroomSelection),
      exactBedrooms: useExactMatch,
      ...overrides,
    };
  }

  function applyFilters(overrides?: Partial<BrowseFilters>) {
    onFiltersChange?.(buildFilters(overrides));
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

  // Close desktop dropdowns on outside click
  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        !desktopFiltersRef.current?.contains(event.target as Node) &&
        !inputWrapRef.current?.contains(event.target as Node)
      ) {
        setActiveDesktopFilter(null);
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Autocomplete: debounce fetch on query change
  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    suggestDebounceRef.current = setTimeout(() => {
      fetch(`/api/public/browse/locations?q=${encodeURIComponent(trimmed)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { suggestions: LocationSuggestion[] } | null) => {
          if (data?.suggestions?.length) {
            setSuggestions(data.suggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [query]);

  function selectSuggestion(suggestion: LocationSuggestion) {
    setQuery(suggestion.name);
    setSelectedLocation(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    applyFilters({ location: suggestion });
  }

  function clearLocation() {
    setSelectedLocation(undefined);
    setQuery("");
    applyFilters({ location: undefined });
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSuggestions(false);

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setSearchMessage(null);
      if (selectedLocation) {
        setSelectedLocation(undefined);
        applyFilters({ location: undefined });
      }
      return;
    }

    if (normalizedQuery.includes("/")) {
      try {
        const response = await fetch(`/api/properties/by-upi?upi=${encodeURIComponent(normalizedQuery)}`);
        if (response.ok) {
          const payload = (await response.json()) as { propertyId: string | null };
          if (payload.propertyId) {
            setSearchMessage(null);
            router.push(routes.public.property(payload.propertyId));
            return;
          }
        }
      } catch {
        setSearchMessage("Search is temporarily unavailable.");
        return;
      }
      setSearchMessage("No property matched that UPI.");
      return;
    }

    // Treat as location search — pick first suggestion if available
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0]);
    } else {
      // Trigger a fresh lookup and pick the first result
      try {
        const response = await fetch(`/api/public/browse/locations?q=${encodeURIComponent(normalizedQuery)}`);
        if (response.ok) {
          const data = (await response.json()) as { suggestions: LocationSuggestion[] };
          if (data.suggestions.length > 0) {
            selectSuggestion(data.suggestions[0]);
            return;
          }
        }
      } catch {
        // fall through
      }
      setSearchMessage("No matching location found.");
    }
  }

  function formatPriceDisplay(value: number | undefined) {
    if (value === undefined) return "";
    return value.toLocaleString("en-US");
  }

  function parsePriceInput(raw: string): number | undefined {
    const stripped = raw.replace(/,/g, "").trim();
    if (!stripped) return undefined;
    const n = Number(stripped);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  // --- Desktop filter dropdown render ---
  function renderDesktopPanel(filter: string) {
    if (filter === "Price") {
      return (
        <div className={`${styles.desktopDropdown} ${styles.priceDropdown}`}>
          <div className={styles.priceFieldLabel}>Price range (RWF)</div>
          <div className={styles.priceInputs}>
            <label className={styles.priceField}>
              <span className={styles.priceFieldLabel}>Min</span>
              <input
                className={styles.priceInput}
                onChange={(e) => setMinPrice(parsePriceInput(e.target.value))}
                placeholder="No min"
                type="text"
                value={formatPriceDisplay(minPrice)}
              />
            </label>
            <span className={styles.priceSeparator}>–</span>
            <label className={styles.priceField}>
              <span className={styles.priceFieldLabel}>Max</span>
              <input
                className={styles.priceInput}
                onChange={(e) => setMaxPrice(parsePriceInput(e.target.value))}
                placeholder="No max"
                type="text"
                value={formatPriceDisplay(maxPrice)}
              />
            </label>
          </div>
          <div className={styles.filterActions}>
            <button
              className={styles.filterApply}
              onClick={() => { setActiveDesktopFilter(null); applyFilters(); }}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      );
    }

    if (filter === "Beds & baths") {
      return (
        <div className={`${styles.desktopDropdown} ${styles.bedsDropdown}`}>
          <div className={styles.filterSection}>
            <div className={styles.filterSectionTitle}>Bedrooms</div>
            <div className={styles.segmentedRow}>
              {["Any", "1+", "2+", "3+", "4+", "5+"].map((option) => (
                <button
                  className={`${styles.segmentButton} ${bedroomSelection === option ? styles.segmentButtonSelected : ""}`}
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
                onChange={(e) => setUseExactMatch(e.target.checked)}
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
                  className={`${styles.segmentButton} ${bathroomSelection === option ? styles.segmentButtonSelected : ""}`}
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
            <button
              className={styles.filterApply}
              onClick={() => { setActiveDesktopFilter(null); applyFilters(); }}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      );
    }

    if (filter === "Property type") {
      return (
        <div className={styles.desktopDropdown}>
          <div className={styles.checkboxList}>
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <label className={styles.checkboxOption} key={option}>
                <input
                  checked={selectedTypes.includes(option)}
                  onChange={() => toggleType(option)}
                  type="checkbox"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <div className={styles.filterActions}>
            <button
              className={styles.filterApply}
              onClick={() => { setActiveDesktopFilter(null); applyFilters(); }}
              type="button"
            >
              Apply
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  // --- Mobile filter panel render ---
  function renderMobilePanel(filter: string) {
    if (filter === "Price") {
      return (
        <>
          <div className={styles.priceFieldLabel}>Price range (RWF)</div>
          <div className={styles.priceInputs}>
            <label className={styles.priceField}>
              <span className={styles.priceFieldLabel}>Min</span>
              <input
                className={styles.priceInput}
                onChange={(e) => setMinPrice(parsePriceInput(e.target.value))}
                placeholder="No min"
                type="text"
                value={formatPriceDisplay(minPrice)}
              />
            </label>
            <span className={styles.priceSeparator}>–</span>
            <label className={styles.priceField}>
              <span className={styles.priceFieldLabel}>Max</span>
              <input
                className={styles.priceInput}
                onChange={(e) => setMaxPrice(parsePriceInput(e.target.value))}
                placeholder="No max"
                type="text"
                value={formatPriceDisplay(maxPrice)}
              />
            </label>
          </div>
        </>
      );
    }

    if (filter === "Beds & baths") {
      return (
        <>
          <div className={styles.filterSection}>
            <div className={styles.filterSectionTitle}>Bedrooms</div>
            <div className={styles.segmentedRow}>
              {["Any", "1+", "2+", "3+", "4+", "5+"].map((option) => (
                <button
                  className={`${styles.segmentButton} ${bedroomSelection === option ? styles.segmentButtonSelected : ""}`}
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
                onChange={(e) => setUseExactMatch(e.target.checked)}
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
                  className={`${styles.segmentButton} ${bathroomSelection === option ? styles.segmentButtonSelected : ""}`}
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
      );
    }

    if (filter === "Property type") {
      return (
        <div className={styles.checkboxList}>
          {PROPERTY_TYPE_OPTIONS.map((option) => (
            <label className={styles.checkboxOption} key={`mobile-type-${option}`}>
              <input
                checked={selectedTypes.includes(option)}
                onChange={() => toggleType(option)}
                type="checkbox"
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    }

    return null;
  }

  return (
    <div className={styles.root}>
      <form className={styles.wrap} onSubmit={handleSearchSubmit}>
        <div className={styles.inputWrap} ref={inputWrapRef}>
          <input
            autoComplete="off"
            className={styles.input}
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedLocation) setSelectedLocation(undefined);
              if (searchMessage) setSearchMessage(null);
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder={placeholder}
            value={query}
          />
          {selectedLocation ? (
            <button
              aria-label="Clear location"
              className={styles.clearButton}
              onClick={clearLocation}
              type="button"
            >
              ×
            </button>
          ) : null}
          {showSuggestions && suggestions.length > 0 ? (
            <div className={styles.suggestions}>
              {suggestions.map((s, i) => (
                <button
                  className={styles.suggestionItem}
                  key={`${s.level}-${s.name}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                  type="button"
                >
                  <span className={styles.suggestionName}>{s.name}</span>
                  {s.parentName ? (
                    <span className={styles.suggestionMeta}>
                      {LEVEL_LABEL[s.level]} {s.parentName}
                      {(s.level === "village" || s.level === "cell") && s.district && s.district !== s.parentName
                        ? ` · ${s.district}`
                        : null}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.controls}>
          <Button type="submit">Search</Button>
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
                {activeDesktopFilter === filter ? renderDesktopPanel(filter) : null}
              </div>
            ))}
          </div>
        </div>
      </form>
      {searchMessage ? (
        <div className={styles.helper}>{searchMessage}</div>
      ) : helperText ? (
        <div className={styles.helper}>{helperText}</div>
      ) : null}
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
                  <div className={styles.mobileFilterPanel}>{renderMobilePanel(filter)}</div>
                ) : null}
              </div>
            ))}
            <div className={styles.filterActions}>
              <button
                className={styles.filterApply}
                onClick={() => { applyFilters(); closeFilters(); }}
                type="button"
              >
                Apply filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
