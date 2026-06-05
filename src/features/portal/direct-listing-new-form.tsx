"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { routes } from "@/lib/routes";
import type { PropertyKind } from "@/types/domain";
import type { PortalListingAgencyOption } from "@/lib/server/portal-listing-editor";

import {
  submitNewDirectListingAction,
  type SubmitDirectListingResult,
} from "./actions";
import { VillageAutocomplete, type VillageSelection } from "./village-autocomplete";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";
import styles from "./upi-listing-form.module.css"; // reuse the same CSS

function flattenAgentOptions(agencies: PortalListingAgencyOption[]) {
  return agencies.flatMap((a) =>
    a.members.map((m) => ({ agencyId: a.agencyId, agencyName: a.businessName, userId: m.userId, fullName: m.fullName })),
  );
}

// ─── Property type config ─────────────────────────────────────────────────────

type PropertyType =
  | "house"
  | "apartment_building"
  | "land"
  | "apartment_unit"
  | "commercial_building"
  | "commercial_unit";

function needsInteriorArea(pt: PropertyType) { return pt !== "land"; }
function needsBedsBaths(pt: PropertyType) { return pt === "house" || pt === "apartment_unit"; }
function needsYearBuilt(pt: PropertyType) { return pt !== "land"; }
function getAreaLabel(pt: PropertyType) {
  if (pt === "apartment_building" || pt === "commercial_building") return "Built area (sqm)";
  if (pt === "commercial_unit") return "Floor area (sqm)";
  return "Interior area (sqm)";
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Type", "Location", "Privacy", "Facts", "Listing"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className={styles.steps} aria-label="Form progress">
      {STEP_LABELS.map((label, i) => (
        <div
          className={`${styles.step} ${
            i + 1 === current ? styles.stepActive : i + 1 < current ? styles.stepDone : ""
          }`}
          key={label}
        >
          <span className={styles.stepDot} aria-hidden="true">{i + 1 < current ? "✓" : i + 1}</span>
          <span className={styles.stepLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DirectListingNewForm({
  agencies = [],
  currentUserId,
}: {
  agencies?: PortalListingAgencyOption[];
  currentUserId: string;
}) {
  const [step, setStep] = useState(1);
  const [listingMode, setListingMode] = useState<"agency" | "self">("agency");
  const agentOptions = flattenAgentOptions(agencies);
  const hasAgency = agentOptions.length > 0;

  // Step 1 — property type
  const [propertyType, setPropertyType] = useState<PropertyType>("house");

  // Step 2 — location
  const [location, setLocation] = useState<VillageSelection | null>(null);

  // Step 4 — property facts
  const [interiorAreaSqm, setInteriorAreaSqm] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");

  // Step 5 — listing intent + submit
  const [marketingType, setMarketingType] = useState<"sale" | "rent">("rent");
  const [askingPrice, setAskingPrice] = useState("");
  const [submitResult, submitAction, isSubmitting] = useActionState<SubmitDirectListingResult | null, FormData>(
    submitNewDirectListingAction,
    null,
  );

  const locationReady = location != null;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>New listing · No UPI</div>

        {hasAgency && (
          <div className={styles.listingModeRow}>
            <span className={styles.listingModeLabel}>Listing as</span>
            <div className={styles.listingModeTabs}>
              <button
                className={`${styles.listingModeTab} ${listingMode === "agency" ? styles.listingModeTabActive : ""}`}
                onClick={() => setListingMode("agency")}
                type="button"
              >
                Agent · {agencies[0].businessName}
              </button>
              <button
                className={`${styles.listingModeTab} ${listingMode === "self" ? styles.listingModeTabActive : ""}`}
                onClick={() => setListingMode("self")}
                type="button"
              >
                Myself
              </button>
            </div>
          </div>
        )}

        <StepIndicator current={step} />

        {/* ─── Step 1: Property type ─── */}
        {step === 1 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>What kind of property?</h1>
            <p className={styles.body}>
              Choose the type that best describes your property.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="property-type">Property type</label>
              <select
                className={styles.select}
                id="property-type"
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                value={propertyType}
              >
                <option value="house">House</option>
                <option value="apartment_unit">Apartment unit</option>
                <option value="apartment_building">Apartment building</option>
                <option value="commercial_unit">Commercial unit</option>
                <option value="commercial_building">Commercial building</option>
                <option value="land">Land</option>
              </select>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryAction} onClick={() => setStep(2)} type="button">
                Continue →
              </button>
              <Link className={styles.secondaryAction} href={routes.app.portalPropertyNew}>← Back</Link>
            </div>
          </div>
        )}

        {/* ─── Step 2: Location ─── */}
        {step === 2 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>Where is the property?</h1>
            <p className={styles.body}>
              Type a village name and pick from the list. The cell, sector, and district are resolved
              automatically.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Village</label>
              <VillageAutocomplete onSelect={setLocation} />
              {!locationReady && (
                <span className={styles.hint}>Search and select a village to continue.</span>
              )}
            </div>

            <div className={styles.actions}>
              <button
                className={styles.primaryAction}
                disabled={!locationReady}
                onClick={() => setStep(3)}
                type="button"
              >
                Continue →
              </button>
              <button className={styles.secondaryAction} onClick={() => setStep(1)} type="button">← Back</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Location privacy note ─── */}
        {step === 3 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>About your listing&rsquo;s location</h1>

            <div className={styles.privacyNote}>
              <div className={styles.privacyIcon} aria-hidden="true">
                <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="22">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div>
                <div className={styles.privacyTitle}>Precise location will not be shown publicly</div>
                <div className={styles.privacyBody}>
                  Without a UPI, your listing appears in search results and the browse panel, but buyers will
                  only see the general area — {location ? `${[location.sector, location.district].filter(Boolean).join(", ")}` : "district / sector / cell"} — not
                  a map pin or exact address. Your full village detail is only used to place the listing in
                  the right area.
                </div>
              </div>
            </div>

            <div className={styles.upiPrompt}>
              <span>Actually have a UPI for this property?</span>
              <Link className={styles.upiPromptLink} href={routes.app.portalPropertyNewUpi}>
                Switch to the UPI flow →
              </Link>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryAction} onClick={() => setStep(4)} type="button">
                Continue →
              </button>
              <button className={styles.secondaryAction} onClick={() => setStep(2)} type="button">← Back</button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Property facts ─── */}
        {step === 4 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>Property details</h1>
            <p className={styles.body}>Add the key facts that help buyers understand the property.</p>

            {needsInteriorArea(propertyType) && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="interior-area">{getAreaLabel(propertyType)}</label>
                <WheelSafeNumberInput
                  className={styles.input}
                  id="interior-area"
                  min="1"
                  onChange={(e) => setInteriorAreaSqm(e.target.value)}
                  placeholder="Optional"
                  step="0.01"
                  value={interiorAreaSqm}
                />
              </div>
            )}

            {needsBedsBaths(propertyType) && (
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="bedrooms">Bedrooms</label>
                  <WheelSafeNumberInput
                    className={styles.input}
                    id="bedrooms"
                    min="0"
                    onChange={(e) => setBedrooms(e.target.value)}
                    placeholder="Optional"
                    step="1"
                    value={bedrooms}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="bathrooms">Bathrooms</label>
                  <WheelSafeNumberInput
                    className={styles.input}
                    id="bathrooms"
                    min="0.5"
                    onChange={(e) => setBathrooms(e.target.value)}
                    placeholder="Optional"
                    step="0.5"
                    value={bathrooms}
                  />
                </div>
              </div>
            )}

            {needsYearBuilt(propertyType) && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="year-built">Year built</label>
                <WheelSafeNumberInput
                  className={styles.input}
                  id="year-built"
                  min="1800"
                  onChange={(e) => setYearBuilt(e.target.value)}
                  placeholder="Optional"
                  step="1"
                  value={yearBuilt}
                />
              </div>
            )}

            {!needsInteriorArea(propertyType) && !needsBedsBaths(propertyType) && (
              <p className={styles.body}>No additional facts are required for land parcels.</p>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryAction} onClick={() => setStep(5)} type="button">
                Continue →
              </button>
              <button className={styles.secondaryAction} onClick={() => setStep(3)} type="button">← Back</button>
            </div>
          </div>
        )}

        {/* ─── Step 5: Listing intent + submit ─── */}
        {step === 5 && location && (
          <form action={submitAction} className={styles.stepBody}>
            {/* Hidden fields passed through to server action */}
            {(!hasAgency || listingMode === "self") && (
              <input name="agentUserId" type="hidden" value={currentUserId} />
            )}
            <input name="assetType" type="hidden" value={propertyType as PropertyKind} />
            <input name="adminVillage" type="hidden" value={location.village} />
            <input name="adminCell" type="hidden" value={location.cell ?? ""} />
            <input name="adminSector" type="hidden" value={location.sector ?? ""} />
            <input name="adminDistrict" type="hidden" value={location.district ?? ""} />
            <input name="bedrooms" type="hidden" value={bedrooms} />
            <input name="bathrooms" type="hidden" value={bathrooms} />
            <input name="interiorAreaSqm" type="hidden" value={interiorAreaSqm} />
            <input name="yearBuilt" type="hidden" value={yearBuilt} />

            <h1 className={styles.title}>Listing details</h1>
            <p className={styles.body}>Last step — tell us how you&rsquo;re marketing this property.</p>

            <div className={styles.field}>
              <span className={styles.label}>Listing type</span>
              <div className={styles.radioGroup}>
                <label className={`${styles.radioOption} ${marketingType === "rent" ? styles.radioOptionSelected : ""}`}>
                  <input
                    checked={marketingType === "rent"}
                    className={styles.radioHidden}
                    name="marketingType"
                    onChange={() => setMarketingType("rent")}
                    type="radio"
                    value="rent"
                  />
                  For rent
                </label>
                <label className={`${styles.radioOption} ${marketingType === "sale" ? styles.radioOptionSelected : ""}`}>
                  <input
                    checked={marketingType === "sale"}
                    className={styles.radioHidden}
                    name="marketingType"
                    onChange={() => setMarketingType("sale")}
                    type="radio"
                    value="sale"
                  />
                  For sale
                </label>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="asking-price">
                Asking price (RWF)
              </label>
              <WheelSafeNumberInput
                className={styles.input}
                id="asking-price"
                min="1"
                name="askingPriceRwf"
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="Optional — you can add it later"
                step="1"
                value={askingPrice}
              />
            </div>

            {hasAgency && listingMode === "agency" && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="direct-agency">Agency</label>
                  <select className={styles.select} id="direct-agency" name="agencyId">
                    {agencies.map((a) => (
                      <option key={a.agencyId} value={a.agencyId}>{a.businessName}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="direct-agent">Assigned agent</label>
                  <select className={styles.select} defaultValue={currentUserId} id="direct-agent" name="agentUserId">
                    {agentOptions.map((a) => (
                      <option key={a.userId} value={a.userId}>{a.fullName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {submitResult?.type === "error" && (
              <div className={styles.alertWarn}>{submitResult.message}</div>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryAction} disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating listing…" : "Create listing →"}
              </button>
              <button
                className={styles.secondaryAction}
                disabled={isSubmitting}
                onClick={() => setStep(4)}
                type="button"
              >
                ← Back
              </button>
            </div>

            <p className={styles.submitNote}>
              Your listing is created as a draft. Add photos and publish from the next screen.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
