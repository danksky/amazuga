"use client";

import { useState } from "react";

import type { PropertyKind } from "@/types/domain";
import { routes } from "@/lib/routes";

import styles from "./claim-details-form.module.css";

type PropertyType = "house" | "apartment_building" | "land" | "apartment_unit" | "commercial_building" | "commercial_unit";

const UNIT_TYPES: PropertyType[] = ["apartment_unit", "commercial_unit"];

function deriveClaimScope(propertyType: PropertyType): "full_parcel" | "unit_partial" {
  return UNIT_TYPES.includes(propertyType) ? "unit_partial" : "full_parcel";
}

function kindToPropertyType(kind: PropertyKind | undefined): PropertyType {
  if (!kind) return "house";
  const map: Partial<Record<PropertyKind, PropertyType>> = {
    house: "house",
    land: "land",
    building: "apartment_building",
    apartment_unit: "apartment_unit",
    commercial_unit: "commercial_unit",
  };
  return map[kind] ?? "house";
}

export function ClaimDetailsForm({ upi, existingAssetKind }: { upi: string; existingAssetKind?: PropertyKind }) {
  const [propertyType, setPropertyType] = useState<PropertyType>(() => kindToPropertyType(existingAssetKind));
  const claimScope = deriveClaimScope(propertyType);

  return (
    <form action={routes.app.portalPropertyClaimSubmit} className={styles.form} method="post">
      <input name="upi" type="hidden" value={upi} />
      <input name="claimScope" type="hidden" value={claimScope} />

      <div className={styles.upiLine}>
        <span className={styles.upiLabel}>UPI</span>
        <span className={styles.upiValue}>{upi}</span>
      </div>

      <label className={styles.field} htmlFor="claim-type">
        <span className={styles.fieldLabel}>What kind of property is here?</span>
        <select
          className={styles.selectInput}
          id="claim-type"
          name="propertyType"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value as PropertyType)}
        >
          <option value="house">House</option>
          <option value="apartment_building">Apartment building</option>
          <option value="land">Land</option>
          <option value="apartment_unit">Apartment unit</option>
          <option value="commercial_building">Commercial building</option>
          <option value="commercial_unit">Commercial unit</option>
        </select>
      </label>

      {claimScope === "unit_partial" && (
        <label className={styles.field} htmlFor="claim-unit">
          <span className={styles.fieldLabel}>Unit / apartment identifier</span>
          <input
            autoFocus
            className={styles.textInput}
            id="claim-unit"
            name="unitLabel"
            placeholder="e.g. A-201, Flat 3B, Suite G-08"
            type="text"
          />
        </label>
      )}

      <label className={styles.field} htmlFor="claim-tenure">
        <span className={styles.fieldLabel}>Land tenure</span>
        <select className={styles.selectInput} defaultValue="unspecified" id="claim-tenure" name="tenureType">
          <option value="unspecified">Not sure</option>
          <option value="freehold">Freehold</option>
          <option value="emphyteutic_lease">Emphyteutic lease</option>
        </select>
        <span className={styles.fieldHint}>Optional — your answer stays separate from any future dataset enrichment.</span>
      </label>

      <button className={styles.submitAction} type="submit">
        Submit claim
      </button>
    </form>
  );
}
