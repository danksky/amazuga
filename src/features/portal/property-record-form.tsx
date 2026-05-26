import Link from "next/link";

import { submitPropertyDetailsAction } from "@/features/portal/actions";
import { routes } from "@/lib/routes";
import type { PortalEditablePropertyRecord } from "@/lib/server/portal-properties";

import styles from "./property-record-form.module.css";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";

function isUnitProperty(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "apartment_unit" || kind === "commercial_unit";
}

function needsInteriorArea(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "apartment_unit" || kind === "building" || kind === "commercial_unit" || kind === "mixed_use";
}

function needsRepresentativeSize(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "building" || kind === "land" || kind === "mixed_use";
}

function needsBedroomsAndBathrooms(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "apartment_unit";
}

function needsZoning(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "building" || kind === "commercial_unit" || kind === "land" || kind === "mixed_use";
}

function getAreaLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  if (kind === "building") return "Built area (sqm)";
  if (kind === "commercial_unit") return "Floor area (sqm)";
  return "Interior area (sqm)";
}

function getRepresentativeSizeLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "land" ? "Parcel size (sqm)" : "Land / parcel size (sqm)";
}

function getKindLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  switch (kind) {
    case "house":
      return "House";
    case "land":
      return "Land";
    case "building":
      return "Building";
    case "apartment_unit":
      return "Apartment unit";
    case "commercial_unit":
      return "Commercial unit";
    case "mixed_use":
      return "Mixed-use property";
    default:
      return "Property";
  }
}

export function PropertyRecordForm({
  property,
}: {
  property: PortalEditablePropertyRecord;
}) {
  const body = property.isListingReady
    ? "Update the structural facts saved on this property record. Listing creation will use these facts directly."
    : "Complete the required property facts here before you create a listing.";

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Portal</div>
          <h1 className={styles.title}>{property.isListingReady ? "Edit property details" : "Complete property details"}</h1>
          <div className={styles.body}>{body}</div>
        </div>

        <div className={styles.actions}>
          <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
            Back to properties
          </Link>
          <Link className={styles.secondaryAction} href={routes.public.property(property.propertyRouteId, property.propertyTitle)}>
            Open property page
          </Link>
        </div>

        <section className={styles.card}>
          <div className={styles.cardTop}>
            <div>
              <h2 className={styles.propertyTitle}>{property.propertyTitle}</h2>
              <div className={styles.propertyMeta}>
                {property.village ? `${property.village}, ` : ""}
                {property.sector ? `${property.sector}, ` : ""}
                {property.district}
              </div>
            </div>
            <div className={styles.badges}>
              <div className={styles.badge}>{getKindLabel(property.propertyKind)}</div>
              <div className={styles.badge}>UPI {property.upi}</div>
            </div>
          </div>
        </section>

        <form action={submitPropertyDetailsAction} className={styles.form}>
          <input name="propertyRouteId" type="hidden" value={property.propertyRouteId} />

          {isUnitProperty(property.propertyKind) ? (
            <label className={styles.field}>
              <span className={styles.label}>Unit label</span>
              <input
                className={styles.input}
                defaultValue={property.unitLabel}
                name="unitLabel"
                placeholder="e.g. A-201, Flat 3B, Suite G-08"
                required
                type="text"
              />
            </label>
          ) : null}

          {needsInteriorArea(property.propertyKind) ? (
            <label className={styles.field}>
              <span className={styles.label}>{getAreaLabel(property.propertyKind)}</span>
              <WheelSafeNumberInput
                className={styles.input}
                defaultValue={property.interiorAreaSqm}
                min="1"
                name="interiorAreaSqm"
                required
                step="0.01"
              />
            </label>
          ) : null}

          {needsRepresentativeSize(property.propertyKind) ? (
            <label className={styles.field}>
              <span className={styles.label}>{getRepresentativeSizeLabel(property.propertyKind)}</span>
              <WheelSafeNumberInput
                className={styles.input}
                defaultValue={property.representativeSize}
                min="1"
                name="representativeSize"
                required
                step="0.01"
              />
            </label>
          ) : null}

          {needsBedroomsAndBathrooms(property.propertyKind) ? (
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Bedrooms</span>
                <WheelSafeNumberInput
                  className={styles.input}
                  defaultValue={property.bedrooms}
                  min="0"
                  name="bedrooms"
                  required
                  step="1"
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Bathrooms</span>
                <WheelSafeNumberInput
                  className={styles.input}
                  defaultValue={property.bathrooms}
                  min="0.5"
                  name="bathrooms"
                  required
                  step="0.5"
                />
              </label>
            </div>
          ) : null}

          {needsZoning(property.propertyKind) ? (
            <label className={styles.field}>
              <span className={styles.label}>Use zone</span>
              <input
                className={styles.input}
                defaultValue={property.zoning}
                name="zoning"
                placeholder="e.g. R4, mixed-use, commercial corridor"
                required
                type="text"
              />
            </label>
          ) : null}

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>Year built</span>
              <WheelSafeNumberInput
                className={styles.input}
                defaultValue={property.yearBuilt}
                min="1800"
                name="yearBuilt"
                placeholder="Optional"
                step="1"
              />
            </label>
            <div className={styles.field}>
              <span className={styles.label}>Property type</span>
              <div className={styles.readOnly}>{property.propertyType}</div>
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea
              className={styles.textarea}
              defaultValue={property.description}
              name="description"
              placeholder="Optional descriptive context for this property record."
              rows={5}
            />
          </label>

          <div className={styles.note}>
            Listing creation will use these property facts directly. Complete the required fields now so the listing
            flow can stay focused on price, photos, and market-facing copy.
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryAction} type="submit">
              Save property details
            </button>
            <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
