"use client";

import { useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { PortalListingAgencyOption } from "@/lib/server/portal-listing-editor";

import { VillageAutocomplete } from "./village-autocomplete";
import styles from "./listing-form.module.css";

const ALL_ASSET_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment_unit", label: "Apartment unit" },
  { value: "apartment_building", label: "Apartment building" },
  { value: "commercial_unit", label: "Commercial unit" },
  { value: "commercial_building", label: "Commercial building" },
  { value: "land", label: "Land" },
] as const;

const RENT_ASSET_TYPES = ALL_ASSET_TYPES.filter((t) =>
  t.value === "house" || t.value === "apartment_unit",
);

type AssetTypeValue = (typeof ALL_ASSET_TYPES)[number]["value"];

const SHOWS_BEDS_BATHS: ReadonlySet<AssetTypeValue> = new Set(["house", "apartment_unit"]);
const SHOWS_AREA: ReadonlySet<AssetTypeValue> = new Set([
  "house", "apartment_unit", "apartment_building", "commercial_unit", "commercial_building",
]);

function flattenAgents(agencies: PortalListingAgencyOption[]) {
  return agencies.flatMap((a) =>
    a.members.map((m) => ({
      agencyId: a.agencyId,
      agencyName: a.businessName,
      userId: m.userId,
      fullName: m.fullName,
    })),
  );
}

export function DirectListingForm({
  agencies,
  currentUserId,
  cancelHref,
  submitAction,
}: {
  agencies: PortalListingAgencyOption[];
  currentUserId: string;
  cancelHref: string;
  submitAction: (formData: FormData) => Promise<void>;
}) {
  const [marketingType, setMarketingType] = useState<"sale" | "rent">("rent");
  const [assetType, setAssetType] = useState<AssetTypeValue>("house");

  const assetTypeOptions = marketingType === "rent" ? RENT_ASSET_TYPES : ALL_ASSET_TYPES;
  const showBedsBaths = SHOWS_BEDS_BATHS.has(assetType);
  const showArea = SHOWS_AREA.has(assetType);

  const agentOptions = flattenAgents(agencies);
  const hasAgency = agentOptions.length > 0;

  return (
    <div className={styles.page}>
      <form action={submitAction}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>New listing · No UPI</div>
          <h1 className={styles.title}>Create a direct listing</h1>
          <p className={styles.body}>
            List a property without a UPI. The listing will be placed on the map using the village you select.
            The exact location is never shown publicly.
          </p>

          <div className={styles.form}>
            {/* ── Listing type ── */}
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Listing type</h2>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="marketingType">For sale or rent</label>
                <select
                  className={styles.select}
                  id="marketingType"
                  name="marketingType"
                  value={marketingType}
                  onChange={(e) => {
                    const next = e.target.value as "sale" | "rent";
                    setMarketingType(next);
                    if (next === "rent" && !SHOWS_BEDS_BATHS.has(assetType)) {
                      setAssetType("house");
                    }
                  }}
                >
                  <option value="rent">For rent</option>
                  <option value="sale">For sale</option>
                </select>
                <span className={styles.hint}>
                  Direct listings without UPI are most appropriate for rentals. Sale listings require
                  ownership verification via UPI.
                </span>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="visibility">Visibility</label>
                <select className={styles.select} id="visibility" name="visibility" defaultValue="public">
                  <option value="public">Public — visible on browse map</option>
                  <option value="unlisted">Unlisted — accessible via direct link only</option>
                </select>
              </div>
            </section>

            {/* ── Property type ── */}
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Property</h2>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="assetType">Property type</label>
                <select
                  className={styles.select}
                  id="assetType"
                  name="assetType"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as AssetTypeValue)}
                >
                  {assetTypeOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* ── Location ── */}
            <section className={styles.formSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Location</h2>
                <p className={styles.sectionBody}>
                  Type a village name and select from the list. The cell, sector, and district are resolved
                  automatically. The exact location is never shown publicly — only the village is used.
                </p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Village</label>
                <VillageAutocomplete />
              </div>
            </section>

            {/* ── Property details ── */}
            {(showBedsBaths || showArea) && (
              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Property details</h2>
                </div>
                {showBedsBaths && (
                  <div className={styles.split}>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="bedrooms">Bedrooms</label>
                      <input
                        className={styles.input}
                        id="bedrooms"
                        min={0}
                        name="bedrooms"
                        placeholder="e.g. 3"
                        required
                        type="number"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label} htmlFor="bathrooms">Bathrooms</label>
                      <input
                        className={styles.input}
                        id="bathrooms"
                        min={0}
                        name="bathrooms"
                        placeholder="e.g. 2"
                        required
                        step="0.5"
                        type="number"
                      />
                    </div>
                  </div>
                )}
                {showArea && (
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="interiorAreaSqm">Interior area (m²)</label>
                    <input
                      className={styles.input}
                      id="interiorAreaSqm"
                      min={1}
                      name="interiorAreaSqm"
                      placeholder="e.g. 120"
                      required
                      type="number"
                    />
                  </div>
                )}
              </section>
            )}

            {/* ── Agency / agent ── */}
            {hasAgency && (
              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Agency</h2>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="agencyId">Agency</label>
                  <select className={styles.select} id="agencyId" name="agencyId">
                    {agencies.map((a) => (
                      <option key={a.agencyId} value={a.agencyId}>
                        {a.businessName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="agentUserId">Assigned agent</label>
                  <select
                    className={styles.select}
                    defaultValue={currentUserId}
                    id="agentUserId"
                    name="agentUserId"
                  >
                    {agentOptions.map((a) => (
                      <option key={a.userId} value={a.userId}>
                        {a.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </section>
            )}

            {!hasAgency && <input name="agentUserId" type="hidden" value={currentUserId} />}

            <div className={styles.actions}>
              <Button type="submit">Create listing draft</Button>
              <Link href={cancelHref}>
                <Button type="button" variant="secondary">Cancel</Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
