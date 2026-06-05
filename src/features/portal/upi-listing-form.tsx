"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

import { routes } from "@/lib/routes";
import type { PropertyKind } from "@/types/domain";
import type { PortalListingAgencyOption } from "@/lib/server/portal-listing-editor";

import {
  lookupParcelForNewListingAction,
  submitUpiListingAction,
  type UpiParcelLookupResult,
  type SubmitUpiListingResult,
} from "./actions";
import { WheelSafeNumberInput } from "./wheel-safe-number-input";
import styles from "./upi-listing-form.module.css";

// ─── UPI input helpers ────────────────────────────────────────────────────────

const UPI_PATTERN = /^[1-5]\/\d{2}\/\d{2}\/\d{2}\/\d+$/;
const UPI_EXAMPLE = "1/03/08/06/78899";

function formatUpiInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const segmentLengths = [1, 2, 2, 2];
  const segments: string[] = [];
  let cursor = 0;

  for (const len of segmentLengths) {
    const seg = digits.slice(cursor, cursor + len);
    if (!seg) break;
    segments.push(seg);
    cursor += seg.length;
    if (seg.length < len) break;
  }

  const parcelNumber = digits.slice(cursor);
  if (parcelNumber) segments.push(parcelNumber);
  return segments.join("/");
}

function getUpiValidity(value: string, hasInvalidChars: boolean) {
  if (!value) return { ok: false, message: `Format: ${UPI_EXAMPLE}`, severity: "info" as const };
  if (hasInvalidChars) return { ok: false, message: "Numbers only — slashes appear automatically.", severity: "warn" as const };

  const digits = value.replace(/\D/g, "");
  if (!digits) return { ok: false, message: `Format: ${UPI_EXAMPLE}`, severity: "info" as const };
  if (!/[1-5]/.test(digits[0])) return { ok: false, message: "UPI starts with 1–5 for the province.", severity: "warn" as const };
  if (digits.length < 8) return { ok: false, message: "Keep going: P/DD/SS/CC/parcel-number.", severity: "info" as const };
  if (!UPI_PATTERN.test(value)) return { ok: false, message: `Use the format ${UPI_EXAMPLE}.`, severity: "warn" as const };
  return { ok: true, message: "Format looks valid.", severity: "ok" as const };
}

// ─── Property-type helpers ────────────────────────────────────────────────────

type PropertyType =
  | "house"
  | "apartment_building"
  | "land"
  | "apartment_unit"
  | "commercial_building"
  | "commercial_unit";

const UNIT_TYPES: PropertyType[] = ["apartment_unit", "commercial_unit"];

function deriveClaimScope(pt: PropertyType) {
  return UNIT_TYPES.includes(pt) ? "unit_partial" : "full_parcel";
}
function needsInteriorArea(pt: PropertyType) { return pt !== "land"; }
function needsBedsBaths(pt: PropertyType) { return pt === "house" || pt === "apartment_unit"; }
function needsYearBuilt(pt: PropertyType) { return pt !== "land"; }
function getAreaLabel(pt: PropertyType) {
  if (pt === "apartment_building" || pt === "commercial_building") return "Built area (sqm)";
  if (pt === "commercial_unit") return "Floor area (sqm)";
  return "Interior area (sqm)";
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["UPI", "Parcel", "Property facts", "Listing"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className={styles.steps} aria-label="Form progress">
      {STEP_LABELS.map((label, i) => (
        <div
          className={`${styles.step} ${i + 1 === current ? styles.stepActive : i + 1 < current ? styles.stepDone : ""}`}
          key={label}
        >
          <span className={styles.stepDot} aria-hidden="true">{i + 1 < current ? "✓" : i + 1}</span>
          <span className={styles.stepLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function flattenAgentOptions(agencies: PortalListingAgencyOption[]) {
  return agencies.flatMap((a) =>
    a.members.map((m) => ({ agencyId: a.agencyId, agencyName: a.businessName, userId: m.userId, fullName: m.fullName })),
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UpiListingForm({
  agencies = [],
  currentUserId,
}: {
  agencies?: PortalListingAgencyOption[];
  currentUserId: string;
}) {
  // Listing mode — only relevant when user is a member of an agency
  const [listingMode, setListingMode] = useState<"agency" | "self">("agency");

  // Navigation
  const [step, setStep] = useState(1);

  // Step 1 — UPI
  const [upiInput, setUpiInput] = useState("");
  const [upiHasInvalidChars, setUpiHasInvalidChars] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [parcel, setParcel] = useState<UpiParcelLookupResult>(null);
  const [lookupPending, startLookup] = useTransition();

  // Step 2 — parcel confirm
  const [locationHidden, setLocationHidden] = useState(false);

  // Step 3 — property facts
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [tenureType, setTenureType] = useState("unspecified");
  const [unitLabel, setUnitLabel] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [interiorAreaSqm, setInteriorAreaSqm] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");

  // Step 4 — listing intent + submit
  const [marketingType, setMarketingType] = useState<"sale" | "rent">("sale");
  const [askingPrice, setAskingPrice] = useState("");
  const [submitResult, submitAction, isSubmitting] = useActionState<SubmitUpiListingResult | null, FormData>(
    submitUpiListingAction,
    null,
  );

  const upiValidity = getUpiValidity(upiInput, upiHasInvalidChars);
  const claimScope = deriveClaimScope(propertyType);
  const agentOptions = flattenAgentOptions(agencies);
  const hasAgency = agentOptions.length > 0;

  // Step 3 is valid when every shown required field has a value (year built is optional).
  const step3Valid =
    (!needsInteriorArea(propertyType) || interiorAreaSqm !== "") &&
    (!needsBedsBaths(propertyType) || (bedrooms !== "" && bathrooms !== "")) &&
    (!UNIT_TYPES.includes(propertyType) || unitLabel.trim() !== "");

  // Step 1 → 2: look up parcel
  function handleUpiContinue() {
    if (!upiValidity.ok) return;
    setLookupError(null);
    startLookup(async () => {
      const data = await lookupParcelForNewListingAction(upiInput);
      if (!data) {
        setLookupError(`No parcel found for UPI ${upiInput}. Check the number and try again.`);
        return;
      }
      setParcel(data);
      setStep(2);
    });
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>New listing · UPI</div>

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

        {/* ─── Step 1: UPI entry ─── */}
        {step === 1 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>Enter your UPI</h1>
            <p className={styles.body}>
              Enter the official land-title identifier for your parcel. We pull the parcel record and register
              your ownership automatically — no admin wait.
            </p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="upi-input">UPI</label>
              <input
                aria-describedby="upi-hint"
                aria-invalid={upiValidity.severity === "warn" ? true : undefined}
                autoComplete="off"
                className={styles.input}
                id="upi-input"
                inputMode="numeric"
                onChange={(e) => {
                  setUpiHasInvalidChars(/[^0-9/\s]/.test(e.target.value));
                  setUpiInput(formatUpiInput(e.target.value));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUpiContinue(); } }}
                placeholder={UPI_EXAMPLE}
                type="text"
                value={upiInput}
              />
              <span
                className={`${styles.hint} ${
                  upiValidity.severity === "warn" ? styles.hintWarn : upiValidity.severity === "ok" ? styles.hintOk : ""
                }`}
                id="upi-hint"
              >
                {upiValidity.message}
              </span>
            </div>

            {lookupError && <div className={styles.alertWarn}>{lookupError}</div>}

            <div className={styles.actions}>
              <button
                className={styles.primaryAction}
                disabled={!upiValidity.ok || lookupPending}
                onClick={handleUpiContinue}
                type="button"
              >
                {lookupPending ? "Checking…" : "Continue →"}
              </button>
              <Link className={styles.secondaryAction} href={routes.app.portalPropertyNew}>← Back</Link>
            </div>
          </div>
        )}

        {/* ─── Step 2: Parcel confirm + location toggle ─── */}
        {step === 2 && parcel && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>Confirm your parcel</h1>
            <p className={styles.body}>We found this parcel. Review the details, then set your location preference.</p>

            <div className={styles.parcelCard}>
              <div className={styles.parcelRow}>
                <span className={styles.parcelKey}>UPI</span>
                <span className={styles.parcelVal}>{parcel.upi}</span>
              </div>
              {(parcel.sector || parcel.district) && (
                <div className={styles.parcelRow}>
                  <span className={styles.parcelKey}>Location</span>
                  <span className={styles.parcelVal}>{[parcel.sector, parcel.district].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {parcel.representativeSize != null && (
                <div className={styles.parcelRow}>
                  <span className={styles.parcelKey}>Parcel size</span>
                  <span className={styles.parcelVal}>{parcel.representativeSize.toLocaleString()} sqm</span>
                </div>
              )}
              {parcel.zoning && (
                <div className={styles.parcelRow}>
                  <span className={styles.parcelKey}>Zoning</span>
                  <span className={styles.parcelVal}>{parcel.zoning}</span>
                </div>
              )}
            </div>

            <label className={styles.toggleRow}>
              <input
                checked={locationHidden}
                className={styles.checkbox}
                onChange={(e) => setLocationHidden(e.target.checked)}
                type="checkbox"
              />
              <div className={styles.toggleContent}>
                <span className={styles.toggleLabel}>Hide my precise location from buyers</span>
                <span className={styles.toggleHint}>
                  When on, the listing shows only district / sector / cell — no map pin or parcel outline.
                  You can change this any time from listing settings.
                </span>
              </div>
            </label>

            <div className={styles.actions}>
              <button className={styles.primaryAction} onClick={() => setStep(3)} type="button">Continue →</button>
              <button className={styles.secondaryAction} onClick={() => setStep(1)} type="button">← Back</button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Property facts ─── */}
        {step === 3 && (
          <div className={styles.stepBody}>
            <h1 className={styles.title}>Property details</h1>
            <p className={styles.body}>Tell us what kind of property this is and add the key structural facts.</p>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="property-type">Property type</label>
              <select
                className={styles.select}
                id="property-type"
                onChange={(e) => { setPropertyType(e.target.value as PropertyType); setUnitLabel(""); }}
                value={propertyType}
              >
                <option value="house">House</option>
                <option value="apartment_building">Apartment building</option>
                <option value="land">Land</option>
                <option value="apartment_unit">Apartment unit</option>
                <option value="commercial_building">Commercial building</option>
                <option value="commercial_unit">Commercial unit</option>
              </select>
            </div>

            {UNIT_TYPES.includes(propertyType) && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="unit-label">Unit / apartment identifier</label>
                <input
                  className={styles.input}
                  id="unit-label"
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="e.g. A-201, Flat 3B, Suite G-08"
                  type="text"
                  value={unitLabel}
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="tenure-type">Land tenure</label>
              <select
                className={styles.select}
                id="tenure-type"
                onChange={(e) => setTenureType(e.target.value)}
                value={tenureType}
              >
                <option value="unspecified">Not sure</option>
                <option value="freehold">Freehold</option>
                <option value="emphyteutic_lease">Emphyteutic lease</option>
              </select>
              <span className={styles.hint}>Optional — kept separate from any future dataset enrichment.</span>
            </div>

            {needsInteriorArea(propertyType) && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="interior-area">{getAreaLabel(propertyType)}</label>
                <WheelSafeNumberInput
                  className={styles.input}
                  id="interior-area"
                  min="1"
                  onChange={(e) => setInteriorAreaSqm(e.target.value)}
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

            <div className={styles.actions}>
              <button
                className={styles.primaryAction}
                disabled={!step3Valid}
                onClick={() => setStep(4)}
                type="button"
              >
                Continue →
              </button>
              <button className={styles.secondaryAction} onClick={() => setStep(2)} type="button">← Back</button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Listing intent ─── */}
        {step === 4 && parcel && (
          <form action={submitAction} className={styles.stepBody}>
            {/* Hidden passthrough fields for the server action */}
            {(!hasAgency || listingMode === "self") && (
              <input name="agentUserId" type="hidden" value={currentUserId} />
            )}
            <input name="parcelId" type="hidden" value={parcel.parcelId} />
            <input name="upi" type="hidden" value={parcel.upi} />
            <input name="claimScope" type="hidden" value={claimScope} />
            <input name="declaredAssetType" type="hidden" value={propertyType as PropertyKind} />
            <input name="tenureType" type="hidden" value={tenureType} />
            <input name="unitLabel" type="hidden" value={unitLabel} />
            <input name="bedrooms" type="hidden" value={bedrooms} />
            <input name="bathrooms" type="hidden" value={bathrooms} />
            <input name="interiorAreaSqm" type="hidden" value={interiorAreaSqm} />
            <input name="yearBuilt" type="hidden" value={yearBuilt} />
            <input name="locationHidden" type="hidden" value={String(locationHidden)} />

            <h1 className={styles.title}>Listing details</h1>
            <p className={styles.body}>Last step — tell us how you&rsquo;re marketing this property.</p>

            <div className={styles.field}>
              <span className={styles.label}>Listing type</span>
              <div className={styles.radioGroup}>
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
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="asking-price">Asking price (RWF)</label>
              <WheelSafeNumberInput
                className={styles.input}
                id="asking-price"
                min="1"
                name="askingPriceRwf"
                onChange={(e) => setAskingPrice(e.target.value)}
                placeholder="e.g. 45000000"
                step="1"
                value={askingPrice}
              />
            </div>

            {hasAgency && listingMode === "agency" && (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="upi-agency">Agency</label>
                  <select className={styles.select} id="upi-agency" name="agencyId">
                    {agencies.map((a) => (
                      <option key={a.agencyId} value={a.agencyId}>{a.businessName}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="upi-agent">Assigned agent</label>
                  <select className={styles.select} defaultValue={currentUserId} id="upi-agent" name="agentUserId">
                    {agentOptions.map((a) => (
                      <option key={a.userId} value={a.userId}>{a.fullName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {submitResult?.type === "already_owned" && (
              <div className={styles.alertInfo}>
                This property is already in your portfolio.{" "}
                <Link href={routes.app.portalProperties}>View your portfolio →</Link>
              </div>
            )}

            {submitResult?.type === "conflict_other_owner" && (
              <div className={styles.alertWarn}>
                <strong>This UPI is already registered to another user.</strong>{" "}
                If you believe this is your property, you can{" "}
                {submitResult.existingPropertyId ? (
                  <Link
                    href={`${routes.app.portalPropertyContest}?property=${encodeURIComponent(submitResult.existingPropertyId)}${submitResult.existingPropertyAssetId ? `&assetId=${encodeURIComponent(submitResult.existingPropertyAssetId)}` : ""}`}
                  >
                    contest the ownership
                  </Link>
                ) : (
                  <Link href={routes.app.portalPropertyContest}>contest the ownership</Link>
                )}
                .
              </div>
            )}

            {submitResult?.type === "error" && (
              <div className={styles.alertWarn}>{submitResult.message}</div>
            )}

            <div className={styles.actions}>
              <button className={styles.primaryAction} disabled={isSubmitting || !askingPrice} type="submit">
                {isSubmitting ? "Creating listing…" : "Create listing →"}
              </button>
              <button
                className={styles.secondaryAction}
                disabled={isSubmitting}
                onClick={() => setStep(3)}
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
