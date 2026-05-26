import Link from "next/link";

import { Button } from "@/components/ui/button";
import { submitValuationSubmissionAction } from "@/features/portal/actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { PortalValuationPropertyOption } from "@/lib/server/portal-valuations";

import styles from "./valuation-submission-form.module.css";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";

function getPropertyKindLabel(kind: PortalValuationPropertyOption["propertyKind"]) {
  switch (kind) {
    case "house":
      return "House";
    case "land":
      return "Parcel";
    case "building":
      return "Building";
    case "apartment_unit":
      return "Apartment";
    case "commercial_unit":
      return "Commercial";
    case "mixed_use":
      return "Mixed use";
    case "other":
      return "Other";
    default:
      return "Property";
  }
}

export function ValuationSubmissionForm({
  properties,
  preselectedPropertyId,
}: {
  properties: PortalValuationPropertyOption[];
  preselectedPropertyId?: string;
}) {
  const selectedProperty =
    properties.find((property) => property.routeId === preselectedPropertyId) ?? properties[0];

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Portal</div>
        <h1 className={styles.title}>Submit a valuation</h1>
        <div className={styles.body}>
          Create a new valuation record against a live Preview-backed property. Submissions enter the review queue first,
          and only approved valuations become public property history.
        </div>

        <form action={submitValuationSubmissionAction} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="property-route-id">
              Property
            </label>
            <select
              className={styles.select}
              defaultValue={selectedProperty?.routeId}
              id="property-route-id"
              name="propertyRouteId"
            >
              {properties.map((property) => (
                <option key={property.routeId} value={property.routeId}>
                  {property.propertyTitle} - {property.routeId}
                </option>
              ))}
            </select>
            <div className={styles.hint}>
              Use the current public property route ID so the final approved record can appear in the correct property history.
            </div>
          </div>

          {selectedProperty ? (
            <div className={styles.propertyMeta}>
              <h2 className={styles.propertyMetaTitle}>{selectedProperty.propertyTitle}</h2>
              <div className={styles.propertyMetaBody}>
                {selectedProperty.sector ? `${selectedProperty.sector}, ` : ""}
                {selectedProperty.district}. Public page ID: {selectedProperty.routeId}
              </div>
              <div className={styles.propertyMetaFacts}>
                <div className={styles.pill}>{getPropertyKindLabel(selectedProperty.propertyKind)}</div>
                <div className={styles.pill}>
                  {selectedProperty.listingMarketingType
                    ? selectedProperty.listingMarketingType === "rent"
                      ? "Listed for rent"
                      : "Listed for sale"
                    : "No active listing"}
                </div>
                {selectedProperty.askingPrice ? (
                  <div className={styles.pill}>{formatCurrency(selectedProperty.askingPrice, selectedProperty.currency)}</div>
                ) : null}
                {selectedProperty.latestApprovedValue ? (
                  <div className={styles.pill}>
                    Latest approved {formatCurrency(selectedProperty.latestApprovedValue, selectedProperty.currency)} on{" "}
                    {selectedProperty.latestApprovedEffectiveDate
                      ? formatDate(selectedProperty.latestApprovedEffectiveDate)
                      : "record"}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={styles.split}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="effective-date">
                Effective date
              </label>
              <input className={styles.input} id="effective-date" name="effectiveDate" type="date" />
              <div className={styles.hint}>Use the valuation date that should appear in public history if approved.</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="estimated-value">
                Estimated value (RWF)
              </label>
              <WheelSafeNumberInput
                className={styles.input}
                id="estimated-value"
                inputMode="numeric"
                min="1"
                name="estimatedValue"
                placeholder="Example: 176000000"
                step="1"
              />
              <div className={styles.hint}>Whole-number RWF only for the current v1 workflow.</div>
            </div>
          </div>

          <label className={styles.checkboxRow} htmlFor="is-anonymous">
            <input className={styles.checkbox} id="is-anonymous" name="isAnonymous" type="checkbox" />
            <div className={styles.checkboxCopy}>
              <div className={styles.checkboxTitle}>Hide your name on the public property page</div>
              <div className={styles.hint}>
                Admins will still review the full record, but approved public valuation history will show this entry as
                anonymous.
              </div>
            </div>
          </label>

          <div className={styles.actions}>
            <Button type="submit">Submit valuation</Button>
            <Link href={routes.app.portalValuations}>
              <Button type="button" variant="secondary">
                Back to valuations
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
