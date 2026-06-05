"use client";

import Link from "next/link";
import { useState } from "react";

import type { PropertyKind } from "@/types/domain";
import { routes } from "@/lib/routes";

import styles from "./claim-details-form.module.css";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";

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
    apartment_building: "apartment_building",
    commercial_building: "commercial_building",
    apartment_unit: "apartment_unit",
    commercial_unit: "commercial_unit",
  };
  return map[kind] ?? "house";
}

function needsInteriorArea(propertyType: PropertyType) {
  return propertyType !== "land";
}

function needsRepresentativeSize(propertyType: PropertyType) {
  return propertyType !== "apartment_unit" && propertyType !== "commercial_unit";
}

function needsBedroomsAndBathrooms(propertyType: PropertyType) {
  return propertyType === "house" || propertyType === "apartment_unit";
}

function needsYearBuilt(propertyType: PropertyType) {
  return propertyType !== "land";
}

function needsZoning(propertyType: PropertyType) {
  return propertyType === "land" || propertyType === "apartment_building" || propertyType === "commercial_building" || propertyType === "commercial_unit";
}

function getAreaLabel(propertyType: PropertyType) {
  if (propertyType === "apartment_building" || propertyType === "commercial_building") return "Built area (sqm)";
  if (propertyType === "commercial_unit") return "Floor area (sqm)";
  return "Interior area (sqm)";
}

function getRepresentativeSizeLabel(propertyType: PropertyType) {
  return propertyType === "land" ? "Parcel size (sqm)" : "Land / parcel size (sqm)";
}

function getFactsIntro(propertyType: PropertyType) {
  switch (propertyType) {
    case "house":
      return "Add the core home facts now so the claim can create a listing-ready property record once it is approved.";
    case "apartment_building":
      return "Add the building-level facts that should carry into the property record after claim approval.";
    case "land":
      return "Add the parcel facts that should be saved to the property record for this land claim.";
    case "apartment_unit":
      return "Add the unit-level facts that distinguish this apartment from the rest of the building.";
    case "commercial_building":
      return "Add the building-level facts that should define this commercial property record.";
    case "commercial_unit":
      return "Add the unit-level facts that define this commercial space.";
    default:
      return "Add the core property facts now so the claim can produce a complete property record.";
  }
}

function formatRepresentativeSize(value?: number) {
  if (value === undefined) {
    return "Missing from parcel record";
  }

  return `${value.toLocaleString()} sqm`;
}

function formatZoning(value?: string) {
  return value?.trim() || "Missing from parcel record";
}

export function ClaimDetailsForm({
  upi,
  propertyRouteId,
  existingAssetKind,
  representativeSize,
  zoning,
}: {
  upi: string;
  propertyRouteId: string;
  existingAssetKind?: PropertyKind;
  representativeSize?: number;
  zoning?: string;
}) {
  const [propertyType, setPropertyType] = useState<PropertyType>(() => kindToPropertyType(existingAssetKind));
  const claimScope = deriveClaimScope(propertyType);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Portal</div>
        <h1 className={styles.title}>Claim a property</h1>
        <div className={styles.body}>
          Confirm the property type and land tenure for the parcel below. When you choose an asset type, we’ll also ask
          for the minimum structural facts needed to turn this claim into a usable property record.
        </div>

        <div className={styles.upiDisplay}>
          <div className={styles.identifierRow}>
            <span className={styles.upiLabel}>UPI</span>
            <span className={styles.upiValue}>{upi}</span>
          </div>
          <div className={styles.identifierRow}>
            <span className={styles.upiLabel}>Property ID</span>
            <span className={styles.upiValue}>{propertyRouteId}</span>
          </div>
        </div>

        <form action={routes.app.portalPropertyClaimSubmit} className={styles.form} method="post">
          <input name="upi" type="hidden" value={upi} />
          <input name="claimScope" type="hidden" value={claimScope} />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="claim-type">
              What kind of property are you claiming?
            </label>
            <select
              className={styles.select}
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
          </div>

          {claimScope === "unit_partial" && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="claim-unit">
                Unit / apartment identifier
              </label>
              <input
                autoFocus
                className={styles.input}
                id="claim-unit"
                name="unitLabel"
                placeholder="e.g. A-201, Flat 3B, Suite G-08"
                type="text"
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="claim-tenure">
              Land tenure
            </label>
            <select className={styles.select} defaultValue="unspecified" id="claim-tenure" name="tenureType">
              <option value="unspecified">Not sure</option>
              <option value="freehold">Freehold</option>
              <option value="emphyteutic_lease">Emphyteutic lease</option>
            </select>
            <span className={styles.hint}>Optional — your answer stays separate from any future dataset enrichment.</span>
          </div>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>Property facts</div>
            <div className={styles.sectionBody}>{getFactsIntro(propertyType)}</div>
          </section>

          {needsInteriorArea(propertyType) ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="claim-interior-area">
                {getAreaLabel(propertyType)}
              </label>
              <WheelSafeNumberInput
                className={styles.input}
                id="claim-interior-area"
                min="1"
                name="interiorAreaSqm"
                required
                step="0.01"
              />
            </div>
          ) : null}

          {needsRepresentativeSize(propertyType) ? (
            <div className={styles.field}>
              <label className={styles.label}>
                {getRepresentativeSizeLabel(propertyType)}
              </label>
              <div className={styles.readOnly}>{formatRepresentativeSize(representativeSize)}</div>
              <div className={styles.hint}>This comes from the parcel record for the selected UPI and cannot be edited here.</div>
            </div>
          ) : null}

          {needsBedroomsAndBathrooms(propertyType) ? (
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="claim-bedrooms">
                  Bedrooms
                </label>
                <WheelSafeNumberInput className={styles.input} id="claim-bedrooms" min="0" name="bedrooms" required step="1" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="claim-bathrooms">
                  Bathrooms
                </label>
                <WheelSafeNumberInput
                  className={styles.input}
                  id="claim-bathrooms"
                  min="0.5"
                  name="bathrooms"
                  required
                  step="0.5"
                />
              </div>
            </div>
          ) : null}

          {needsZoning(propertyType) ? (
            <div className={styles.field}>
              <label className={styles.label}>
                Use zone
              </label>
              <div className={styles.readOnly}>{formatZoning(zoning)}</div>
              <div className={styles.hint}>This comes from the parcel record for the selected UPI and cannot be edited here.</div>
            </div>
          ) : null}

          {needsYearBuilt(propertyType) ? (
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="claim-year-built">
                  Year built
                </label>
                <WheelSafeNumberInput
                  className={styles.input}
                  id="claim-year-built"
                  min="1800"
                  name="yearBuilt"
                  placeholder="Optional"
                  step="1"
                />
              </div>
            </div>
          ) : null}

          <div className={styles.actions}>
            <button className={styles.submitAction} type="submit">
              Submit claim
            </button>
            <Link className={styles.cancelAction} href={routes.app.portalProperties}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
