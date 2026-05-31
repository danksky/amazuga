"use client";

import { useId, useMemo, useState } from "react";

import type { Agency } from "@/types/domain";

import styles from "./agency-picker.module.css";

interface AgencyPickerProps {
  agencies: Agency[];
  initialAgencyId?: string;
  onChange?: (agencyId: string) => void;
}

export function AgencyPicker({ agencies, initialAgencyId, onChange }: AgencyPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState(initialAgencyId ?? "");

  function updateSelectedAgencyId(id: string) {
    setSelectedAgencyId(id);
    onChange?.(id);
  }
  const searchId = useId();
  const normalizedQuery = query.trim().toLowerCase();

  const filteredAgencies = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return agencies.filter((agency) => {
      const name = agency.businessName.toLowerCase();
      const tin = agency.tin.toLowerCase();
      return name.includes(normalizedQuery) || tin.includes(normalizedQuery);
    });
  }, [agencies, normalizedQuery]);

  const selectedAgency = agencies.find((agency) => agency.id === selectedAgencyId);

  return (
    <div className={styles.stack}>
      <label className={styles.searchLabel} htmlFor={searchId}>
        Search approved agencies
      </label>
      <input name="agencyId" type="hidden" value={selectedAgencyId} />

      {selectedAgency ? (
        <div className={styles.selected}>
          <div className={styles.selectedBody}>{selectedAgency.businessName}</div>
          <button
            aria-label="Clear selected agency"
            className={styles.clearButton}
            onClick={() => {
              updateSelectedAgencyId("");
              setQuery("");
            }}
            type="button"
          >
            ×
          </button>
        </div>
      ) : (
        <input
          className={styles.searchInput}
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by agency name or TIN"
          type="search"
          value={query}
        />
      )}

      {normalizedQuery ? (
        <div className={styles.results}>
          {filteredAgencies.length > 0 ? (
            filteredAgencies.map((agency) => {
              const isSelected = agency.id === selectedAgencyId;

              return (
                <button
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                  key={agency.id}
                  onClick={() => {
                    updateSelectedAgencyId(agency.id);
                    setQuery("");
                  }}
                  type="button"
                >
                  <div>
                    <div className={styles.optionTitle}>{agency.businessName}</div>
                    <div className={styles.optionBody}>TIN {agency.tin}</div>
                  </div>
                  <div className={styles.optionState}>{isSelected ? "Selected" : "Select"}</div>
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>No approved agencies match your search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
