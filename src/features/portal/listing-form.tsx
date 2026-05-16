import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import type {
  PortalEditableListing,
  PortalListingAgencyOption,
  PortalListingPropertyOption,
} from "@/lib/server/portal-listing-editor";

import styles from "./listing-form.module.css";

function getPropertyKindLabel(kind?: string) {
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

function flattenAgentOptions(agencies: PortalListingAgencyOption[]) {
  return agencies.flatMap((agency) =>
    agency.members.map((member) => ({
      agencyId: agency.agencyId,
      agencyName: agency.businessName,
      userId: member.userId,
      fullName: member.fullName,
      membershipRole: member.membershipRole,
    })),
  );
}

export function ListingForm({
  agencies,
  listing,
  mode,
  propertyOptions = [],
  submitAction,
}: {
  agencies: PortalListingAgencyOption[];
  listing?: PortalEditableListing;
  mode: "create" | "edit";
  propertyOptions?: PortalListingPropertyOption[];
  submitAction: (formData: FormData) => void | Promise<void>;
}) {
  const selectedAgency =
    agencies.find((agency) => agency.agencyId === listing?.agencyId) ?? agencies[0];
  const agentAgencies =
    mode === "edit" && selectedAgency ? [selectedAgency] : agencies;
  const flattenedAgents = flattenAgentOptions(agentAgencies);
  const selectedProperty =
    propertyOptions.find((property) => property.propertyRouteId === listing?.propertyRouteId) ??
    (listing
      ? {
          propertyAssetId: listing.propertyAssetId,
          propertyRouteId: listing.propertyRouteId,
          propertyTitle: listing.propertyTitle,
          propertyKind: listing.propertyKind,
          district: listing.district,
          sector: listing.sector,
        }
      : propertyOptions[0]);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Portal</div>
        <h1 className={styles.title}>{mode === "create" ? "Create a listing" : "Edit listing"}</h1>
        <div className={styles.body}>
          {mode === "create"
            ? "Create a new active listing for one of the current Preview-backed properties and attach it to the right agency and agent."
            : "Update listing details, assignment, and marketing posture while keeping the existing property attachment intact."}
        </div>
        {mode === "create" && propertyOptions.length === 0 ? (
          <div className={styles.notice}>
            Every currently available Preview-backed property already has an active listing. Deactivate an existing
            listing or wait until another property becomes available to create a new one.
          </div>
        ) : null}

        <form action={submitAction} className={styles.form}>
          {listing ? <input name="listingId" type="hidden" value={listing.id} /> : null}

          <div className={styles.split}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="agency-id">
                Agency
              </label>
              <select
                className={styles.select}
                defaultValue={listing?.agencyId || selectedAgency?.agencyId}
                disabled={mode === "edit"}
                id="agency-id"
                name="agencyId"
              >
                {agencies.map((agency) => (
                  <option key={agency.agencyId} value={agency.agencyId}>
                    {agency.businessName}
                  </option>
                ))}
              </select>
              {mode === "edit" ? (
                <div className={styles.hint}>Agency changes are not part of this first edit flow.</div>
              ) : (
                <div className={styles.hint}>Choose the agency that should own this listing in the portal.</div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="agent-user-id">
                Assigned agent
              </label>
              <select
                className={styles.select}
                defaultValue={listing?.agentUserId || flattenedAgents[0]?.userId}
                id="agent-user-id"
                name="agentUserId"
              >
                {agentAgencies.map((agency) => (
                  <optgroup key={agency.agencyId} label={agency.businessName}>
                    {agency.members.map((agent) => (
                      <option key={`${agency.agencyId}-${agent.userId}-${agent.membershipRole}`} value={agent.userId}>
                        {agent.fullName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className={styles.hint}>
                {mode === "create"
                  ? "Choose an active member of the same agency you selected above."
                  : "Only active members of this listing's agency can be assigned here."}
              </div>
            </div>
          </div>

          {mode === "create" ? (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="property-route-id">
                Property to list
              </label>
              <select
                className={styles.select}
                defaultValue={selectedProperty?.propertyRouteId}
                id="property-route-id"
                name="propertyRouteId"
                disabled={propertyOptions.length === 0}
              >
                {propertyOptions.map((property) => (
                  <option key={property.propertyRouteId} value={property.propertyRouteId}>
                    {property.propertyTitle} - {property.propertyRouteId}
                  </option>
                ))}
              </select>
              <div className={styles.hint}>
                This first create flow only offers properties that do not currently have an active listing.
              </div>
            </div>
          ) : null}

          {selectedProperty ? (
            <div className={styles.propertyMeta}>
              <h2 className={styles.propertyMetaTitle}>{selectedProperty.propertyTitle}</h2>
              <div className={styles.propertyMetaBody}>
                {selectedProperty.sector ? `${selectedProperty.sector}, ` : ""}
                {selectedProperty.district}. Public route: {selectedProperty.propertyRouteId}
              </div>
              <div className={styles.propertyMetaFacts}>
                <div className={styles.pill}>{getPropertyKindLabel(selectedProperty.propertyKind)}</div>
                <div className={styles.pill}>{selectedProperty.propertyRouteId}</div>
              </div>
            </div>
          ) : null}

          <div className={styles.split}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="marketing-type">
                Marketing type
              </label>
              <select
                className={styles.select}
                defaultValue={listing?.marketingType || "sale"}
                id="marketing-type"
                name="marketingType"
              >
                <option value="sale">For sale</option>
                <option value="rent">For rent</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="asking-price">
                Asking price (RWF)
              </label>
              <input
                className={styles.input}
                defaultValue={listing?.askingPrice}
                id="asking-price"
                inputMode="numeric"
                min="1"
                name="askingPrice"
                placeholder="Example: 185000000"
                step="1"
                type="number"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="headline">
              Headline
            </label>
            <input
              className={styles.input}
              defaultValue={listing?.headline}
              id="headline"
              name="headline"
              placeholder="Example: Kimihurura family home with garden frontage"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">
              Description
            </label>
            <textarea
              className={styles.textarea}
              defaultValue={listing?.description}
              id="description"
              name="description"
              placeholder="Add listing copy, context, and useful details for the public property page."
            />
          </div>

          <div className={styles.actions}>
            <Button disabled={mode === "create" && propertyOptions.length === 0} type="submit">
              {mode === "create" ? "Create listing" : "Save changes"}
            </Button>
            <Link href={routes.app.portalListings}>
              <Button type="button" variant="secondary">
                Back to listings
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
