"use client";

import { useEffect, useRef, useState } from "react";

import type { LocationSuggestion } from "@/lib/browse-types";

import styles from "./village-autocomplete.module.css";

function formatChip(s: LocationSuggestion): string {
  const context = [s.cell, s.sector, s.district].filter(Boolean).join(" · ");
  return context ? `${s.name} · ${context}` : s.name;
}

function formatOptionMeta(s: LocationSuggestion): string {
  return [s.cell, s.sector, s.district].filter(Boolean).join(" · ");
}

export interface VillageSelection {
  village: string;
  cell?: string;
  sector?: string;
  district?: string;
}

export function VillageAutocomplete({
  onSelect,
}: {
  /** When provided the component calls this instead of rendering hidden inputs. */
  onSelect?: (selection: VillageSelection | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<LocationSuggestion | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/public/browse/locations?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { suggestions: LocationSuggestion[] } | null) => {
          const villages = (data?.suggestions ?? []).filter((s) => s.level === "village");
          setSuggestions(villages);
          setShowDropdown(villages.length > 0);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
        });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function select(s: LocationSuggestion) {
    setSelected(s);
    setQuery("");
    setSuggestions([]);
    setShowDropdown(false);
    onSelect?.({ village: s.name, cell: s.cell ?? undefined, sector: s.sector ?? undefined, district: s.district ?? undefined });
  }

  function clear() {
    setSelected(null);
    setQuery("");
    onSelect?.(null);
  }

  return (
    <div className={styles.root} ref={containerRef}>
      {selected ? (
        <>
          <div className={styles.chip}>
            <span className={styles.chipText}>{formatChip(selected)}</span>
            <button aria-label="Clear village" className={styles.chipClear} onClick={clear} type="button">
              ×
            </button>
          </div>
          {/* Hidden inputs are only emitted when no onSelect callback — legacy form-post callers */}
          {!onSelect && (
            <>
              <input name="adminVillage" type="hidden" value={selected.name} />
              <input name="adminCell" type="hidden" value={selected.cell ?? ""} />
              <input name="adminSector" type="hidden" value={selected.sector ?? ""} />
              <input name="adminDistrict" type="hidden" value={selected.district ?? ""} />
            </>
          )}
        </>
      ) : (
        <div className={styles.inputWrap}>
          <input
            autoComplete="off"
            className={styles.input}
            name="_villageQuery"
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            placeholder="e.g. Kimisagara"
            required
            type="text"
            value={query}
          />
          {query && (
            <button aria-label="Clear" className={styles.clear} onClick={clear} type="button">
              ×
            </button>
          )}
          {showDropdown && (
            <div className={styles.dropdown}>
              {suggestions.map((s, i) => (
                <button
                  className={styles.option}
                  key={`${s.name}-${s.district}-${i}`}
                  onMouseDown={(e) => { e.preventDefault(); select(s); }}
                  type="button"
                >
                  <span className={styles.optionName}>{s.name}</span>
                  {formatOptionMeta(s) && (
                    <span className={styles.optionMeta}>{formatOptionMeta(s)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
