import Link from "next/link";

import { registerBuildingUnitAction, submitPropertyDetailsAction } from "@/features/portal/actions";
import { routes } from "@/lib/routes";
import type { PortalEditablePropertyRecord } from "@/lib/server/portal-properties";

import styles from "./property-record-form.module.css";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";

function isUnitProperty(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "apartment_unit" || kind === "commercial_unit";
}

function isBuildingProperty(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "apartment_building" || kind === "commercial_building";
}

function needsInteriorArea(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "apartment_unit" || kind === "apartment_building" || kind === "commercial_building" || kind === "commercial_unit";
}

function needsRepresentativeSize(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "apartment_building" || kind === "commercial_building" || kind === "land";
}

function needsBedroomsAndBathrooms(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "house" || kind === "apartment_unit";
}

function needsZoning(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "apartment_building" || kind === "commercial_building" || kind === "commercial_unit" || kind === "land";
}

function getAreaLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  if (kind === "apartment_building" || kind === "commercial_building") return "Built area (sqm)";
  if (kind === "commercial_unit") return "Floor area (sqm)";
  return "Interior area (sqm)";
}

function getRepresentativeSizeLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "land" ? "Parcel size (sqm)" : "Land / parcel size (sqm)";
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

function getKindLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  switch (kind) {
    case "house":
      return "House";
    case "land":
      return "Land";
    case "apartment_building":
      return "Apartment building";
    case "commercial_building":
      return "Commercial building";
    case "apartment_unit":
      return "Apartment unit";
    case "commercial_unit":
      return "Commercial unit";
    default:
      return "Property";
  }
}

function getChildUnitKindLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "commercial_building" ? "Commercial unit" : "Apartment unit";
}

function getChildUnitAreaLabel(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "commercial_building" ? "Floor area (sqm)" : "Interior area (sqm)";
}

function getChildUnitIntro(kind: PortalEditablePropertyRecord["propertyKind"]) {
  return kind === "commercial_building"
    ? "Register units once so future commercial spaces can be referenced directly without looking up the parcel UPI again."
    : "Register units once so future apartments can be referenced directly without looking up the parcel UPI again.";
}

function getChildUnitStatusLabel(input: {
  isOwnedByCurrentUser: boolean;
  isClaimed: boolean;
  listingStatus?: string;
}) {
  if (input.listingStatus === "active") return "Listed";
  if (input.listingStatus === "inactive") return "Listing paused";
  if (input.listingStatus === "draft") return "Listing draft";
  if (input.isOwnedByCurrentUser) return "Owned by you";
  if (input.isClaimed) return "Claimed";
  return "Unclaimed";
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
              <div className={styles.readOnly}>{formatRepresentativeSize(property.representativeSize)}</div>
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
              <div className={styles.readOnly}>{formatZoning(property.zoning)}</div>
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

        {isBuildingProperty(property.propertyKind) ? (
          <section className={styles.card}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Units in this building</h2>
                <div className={styles.body}>{getChildUnitIntro(property.propertyKind)}</div>
              </div>
              <div className={styles.badge}>{property.childUnits.length} registered</div>
            </div>

            {property.childUnits.length > 0 ? (
              <div className={styles.unitList}>
                {property.childUnits.map((unit) => (
                  <div className={styles.unitCard} key={unit.propertyInternalId}>
                    <div className={styles.unitCardTop}>
                      <div>
                        <div className={styles.unitTitle}>{unit.unitLabel || unit.propertyTitle}</div>
                        <div className={styles.propertyMeta}>{unit.propertyType}</div>
                      </div>
                      <div className={styles.badges}>
                        <div className={styles.badge}>{getChildUnitStatusLabel(unit)}</div>
                      </div>
                    </div>
                    <div className={styles.unitFacts}>
                      {unit.bedrooms !== undefined ? `${unit.bedrooms} bd` : null}
                      {unit.bathrooms !== undefined ? `${unit.bathrooms} ba` : null}
                      {unit.interiorAreaSqm !== undefined ? `${unit.interiorAreaSqm} sqm` : null}
                      {unit.yearBuilt !== undefined ? `Built ${unit.yearBuilt}` : null}
                    </div>
                    <div className={styles.actions}>
                      <Link className={styles.secondaryAction} href={routes.public.property(unit.propertyRouteId, unit.propertyTitle)}>
                        Open unit page
                      </Link>
                      {unit.isOwnedByCurrentUser ? (
                        <Link className={styles.secondaryAction} href={routes.app.portalPropertyEdit(unit.propertyRouteId)}>
                          Edit unit
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.note}>
                No child units have been registered yet. Add the first {getChildUnitKindLabel(property.propertyKind).toLowerCase()} below.
              </div>
            )}

            <form action={registerBuildingUnitAction} className={styles.form}>
              <input name="buildingRouteId" type="hidden" value={property.propertyRouteId} />

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Unit label</span>
                  <input
                    className={styles.input}
                    name="unitLabel"
                    placeholder={property.propertyKind === "commercial_building" ? "e.g. G-04" : "e.g. A-201"}
                    required
                    type="text"
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.label}>{getChildUnitAreaLabel(property.propertyKind)}</span>
                  <WheelSafeNumberInput className={styles.input} min="1" name="interiorAreaSqm" required step="0.01" />
                </label>
              </div>

              {property.propertyKind === "apartment_building" ? (
                <div className={styles.fieldGrid}>
                  <label className={styles.field}>
                    <span className={styles.label}>Bedrooms</span>
                    <WheelSafeNumberInput className={styles.input} min="0" name="bedrooms" required step="1" />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.label}>Bathrooms</span>
                    <WheelSafeNumberInput className={styles.input} min="0.5" name="bathrooms" required step="0.5" />
                  </label>
                </div>
              ) : null}

              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  <span className={styles.label}>Year built</span>
                  <WheelSafeNumberInput className={styles.input} min="1800" name="yearBuilt" placeholder="Optional" step="1" />
                </label>
                <div className={styles.field}>
                  <span className={styles.label}>Ownership</span>
                  <div className={styles.readOnly}>New units created here start owned by you.</div>
                </div>
              </div>

              <label className={styles.field}>
                <span className={styles.label}>Unit description</span>
                <textarea
                  className={styles.textarea}
                  name="description"
                  placeholder={`Optional notes for this ${getChildUnitKindLabel(property.propertyKind).toLowerCase()}.`}
                  rows={4}
                />
              </label>

              <div className={styles.actions}>
                <button className={styles.primaryAction} type="submit">
                  Register {getChildUnitKindLabel(property.propertyKind)}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  );
}
