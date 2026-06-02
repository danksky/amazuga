export interface LocationSuggestion {
  level: "district" | "sector" | "cell" | "village";
  name: string;
  /** One administrative level up — shown after the name in suggestions. */
  parentName?: string;
  /** Full hierarchy context for precise server-side filtering. */
  district?: string;
  sector?: string;
  cell?: string;
}

export interface BrowseFilters {
  location?: LocationSuggestion;
  minPriceRwf?: number;
  maxPriceRwf?: number;
  propertyTypes?: string[];
  minBedrooms?: number;
  minBathrooms?: number;
  exactBedrooms?: boolean;
}
