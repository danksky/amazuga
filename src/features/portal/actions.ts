"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { generateAndStoreOgImage } from "@/lib/server/og-image";
import { getPortalAccessState } from "@/lib/server/portal-access";
import {
  addListingAccessGrantInDb,
  createPortalListingInDb,
  removeListingAccessGrantInDb,
  setPortalListingStatusInDb,
  updatePortalListingInDb,
} from "@/lib/server/portal-listing-editor";
import { createDirectListingInDb } from "@/lib/server/portal-direct-listing";
import { registerPortalBuildingUnitInDb, updatePortalPropertyRecordInDb } from "@/lib/server/portal-properties";
import {
  addRoleToUser,
  createAndAutoApproveUpiClaim,
  createOwnershipContest,
  createOwnershipTransferRequestInDb,
  createValuationSubmissionInDb,
  respondToOwnershipTransferRequestInDb,
} from "@/lib/server/workflows";
import { getParcelDataForNewUpiListing } from "@/lib/server/portal-properties";
import type { PropertyKind, PropertyTenureType, PropertyTransferMode } from "@/types/domain";
import { hasCapability } from "@/types/permissions";

function getListingRedirectHref(hasAgencyPortalAccess: boolean) {
  return hasAgencyPortalAccess ? routes.app.portalListings : routes.app.portalProperties;
}

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`Missing field: ${key}`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Empty field: ${key}`);
  }

  return trimmed;
}

function getRequiredNumber(formData: FormData, key: string) {
  const value = Number(getRequiredString(formData, key));

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid number field: ${key}`);
  }

  return value;
}

function getOptionalNumber(formData: FormData, key: string) {
  const str = getOptionalString(formData, key);
  if (str === undefined) return undefined;
  const value = Number(str);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function getOptionalInteger(formData: FormData, key: string) {
  const str = getOptionalString(formData, key);
  if (str === undefined) return undefined;
  const value = Number(str);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function getRequiredListingMarketingType(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (value !== "sale" && value !== "rent") {
    throw new Error(`Invalid marketing type: ${key}`);
  }

  return value;
}

function getRequiredListingVisibility(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (value !== "public" && value !== "unlisted" && value !== "private") {
    throw new Error(`Invalid listing visibility: ${key}`);
  }

  return value;
}

function getRequiredListingStatus(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (value !== "active" && value !== "inactive" && value !== "archived") {
    throw new Error(`Invalid listing status: ${key}`);
  }

  return value;
}

function getRequiredTransferMode(formData: FormData, key: string): PropertyTransferMode {
  const value = getRequiredString(formData, key);

  if (value !== "sale" && value !== "transfer") {
    throw new Error(`Invalid transfer mode: ${key}`);
  }

  return value;
}

function revalidateListingSurfaces(input: { propertyRouteId?: string | null; marketingType?: "sale" | "rent" }) {
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalAgency);
  revalidatePath(routes.app.portalAgents);
  revalidatePath(routes.public.buy);
  revalidatePath(routes.public.rent);

  if (input.propertyRouteId) {
    revalidatePath(routes.public.property(input.propertyRouteId));
  }
}

function buildTransferStatusHref(input: {
  status:
    | "created"
    | "existing_pending"
    | "buyer_not_found"
    | "self"
    | "not_owner"
    | "error"
    | "accepted"
    | "declined";
  propertyRouteId?: string;
  buyerEmail?: string;
}) {
  const params = new URLSearchParams({
    transferStatus: input.status,
  });

  if (input.propertyRouteId) {
    params.set("transferProperty", input.propertyRouteId);
  }

  if (input.buyerEmail) {
    params.set("transferEmail", input.buyerEmail);
  }

  return `${routes.app.portalProperties}?${params.toString()}`;
}

function buildTransferPageHref(input: {
  propertyRouteId: string;
  status: "created" | "existing_pending" | "buyer_not_found" | "self" | "not_owner" | "error";
  buyerEmail?: string;
}) {
  const params = new URLSearchParams({
    transferStatus: input.status,
  });

  if (input.buyerEmail) {
    params.set("transferEmail", input.buyerEmail);
  }

  return `${routes.app.portalPropertyTransfer(input.propertyRouteId)}?${params.toString()}`;
}

export async function submitValuationSubmissionAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalValuationNew);

  if (!hasCapability(currentUser.roles, "submit_valuation")) {
    throw new Error("Current user cannot submit valuations");
  }

  await createValuationSubmissionInDb({
    userId: currentUser.id,
    propertyRouteId: getRequiredString(formData, "propertyRouteId"),
    effectiveDate: getRequiredString(formData, "effectiveDate"),
    estimatedValue: getRequiredNumber(formData, "estimatedValue"),
    isAnonymous: formData.get("isAnonymous") === "on",
  });

  revalidatePath(routes.app.portalValuations);
  redirect(routes.app.portalValuations);
}

export async function submitListingCreateAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListingNew);

  if (!hasCapability(currentUser.roles, "create_listing")) {
    throw new Error("Current user cannot create listings");
  }

  const listing = await createPortalListingInDb({
    userId: currentUser.id,
    agencyId: getOptionalString(formData, "agencyId"),
    propertyRouteId: getRequiredString(formData, "propertyRouteId"),
    agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
    marketingType: getRequiredListingMarketingType(formData, "marketingType"),
    visibility: getRequiredListingVisibility(formData, "visibility"),
  });

  revalidatePath(routes.app.portalProperties);
  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  redirect(routes.app.portalListingEdit(listing.listingId));
}

export async function submitDirectListingCreateAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListingNewDirect);

  if (!hasCapability(currentUser.roles, "create_listing")) {
    throw new Error("Current user cannot create listings");
  }

  const assetType = getRequiredString(formData, "assetType") as PropertyKind;
  const listing = await createDirectListingInDb({
    createdByUserId: currentUser.id,
    agencyId: getOptionalString(formData, "agencyId"),
    agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
    assetType,
    adminDistrict: getRequiredString(formData, "adminDistrict"),
    adminSector: getOptionalString(formData, "adminSector"),
    adminCell: getOptionalString(formData, "adminCell"),
    adminVillage: getOptionalString(formData, "adminVillage"),
    marketingType: getRequiredListingMarketingType(formData, "marketingType"),
    visibility: getRequiredListingVisibility(formData, "visibility"),
    bedrooms: getOptionalNumber(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
  });

  revalidatePath(routes.app.portalListings);
  redirect(routes.app.portalListingEdit(listing.listingId));
}

export async function submitFsboDirectListingCreateAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyListDirect);

  const assetType = getRequiredString(formData, "assetType") as PropertyKind;
  const listing = await createDirectListingInDb({
    createdByUserId: currentUser.id,
    agentUserId: currentUser.id,
    assetType,
    adminDistrict: getRequiredString(formData, "adminDistrict"),
    adminSector: getOptionalString(formData, "adminSector"),
    adminCell: getOptionalString(formData, "adminCell"),
    adminVillage: getOptionalString(formData, "adminVillage"),
    marketingType: getRequiredListingMarketingType(formData, "marketingType"),
    visibility: getRequiredListingVisibility(formData, "visibility"),
    bedrooms: getOptionalNumber(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
    createOwnershipForUser: currentUser.id,
  });

  await addRoleToUser(currentUser.id, "private_lister");

  revalidatePath(routes.app.portalProperties);
  redirect(routes.app.portalListingEdit(listing.listingId));
}

export async function submitListingUpdateAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    throw new Error("Current user cannot edit listings");
  }

  const [listing, access] = await Promise.all([
    updatePortalListingInDb({
      userId: currentUser.id,
      listingId: getRequiredString(formData, "listingId"),
      agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
      marketingType: getRequiredListingMarketingType(formData, "marketingType"),
      visibility: getRequiredListingVisibility(formData, "visibility"),
      askingPrice: getOptionalNumber(formData, "askingPrice"),
      locationHidden: formData.get("locationHidden") === "true" ? true : formData.get("locationHidden") === "false" ? false : undefined,
    }),
    getPortalAccessState(currentUser.id),
  ]);

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });

  generateAndStoreOgImage(listing.listingId).catch(console.error);

  redirect(getListingRedirectHref(access.hasAgencyPortalAccess));
}

export async function submitListingEditAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);
  const intent = formData.get("intent");
  const access = await getPortalAccessState(currentUser.id);
  const redirectHref = getListingRedirectHref(access.hasAgencyPortalAccess);

  if (intent === "publish" || intent === "discard") {
    if (!hasCapability(currentUser.roles, "deactivate_listing")) {
      throw new Error("Current user cannot change listing status");
    }

    const listingId = getRequiredString(formData, "listingId");

    if (intent === "publish") {
      // Save any form changes first so a freshly-typed asking price is persisted
      // before setPortalListingStatusInDb reads the price from the DB.
      if (!hasCapability(currentUser.roles, "edit_listing")) {
        throw new Error("Current user cannot edit listings");
      }
      await updatePortalListingInDb({
        userId: currentUser.id,
        listingId,
        agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
        marketingType: getRequiredListingMarketingType(formData, "marketingType"),
        visibility: getRequiredListingVisibility(formData, "visibility"),
        askingPrice: getOptionalNumber(formData, "askingPrice"),
        locationHidden: formData.get("locationHidden") === "true" ? true : formData.get("locationHidden") === "false" ? false : undefined,
      });
      generateAndStoreOgImage(listingId).catch(console.error);
    }

    const status = intent === "publish" ? "active" : "archived";
    const listing = await setPortalListingStatusInDb({
      allowDraftLifecycle: true,
      userId: currentUser.id,
      listingId,
      status,
    });

    revalidatePath(routes.app.portalProperties);
    revalidateListingSurfaces({
      propertyRouteId: listing.propertyRouteId,
      marketingType: listing.marketingType,
    });
    redirect(redirectHref);
  }

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    throw new Error("Current user cannot edit listings");
  }

  const listing = await updatePortalListingInDb({
    userId: currentUser.id,
    listingId: getRequiredString(formData, "listingId"),
    agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
    marketingType: getRequiredListingMarketingType(formData, "marketingType"),
    visibility: getRequiredListingVisibility(formData, "visibility"),
    askingPrice: getOptionalNumber(formData, "askingPrice"),
    locationHidden: formData.get("locationHidden") === "true" ? true : formData.get("locationHidden") === "false" ? false : undefined,
  });

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  generateAndStoreOgImage(listing.listingId).catch(console.error);
  redirect(redirectHref);
}

export async function setListingStatusAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "deactivate_listing")) {
    throw new Error("Current user cannot change listing status");
  }

  const [listing, access] = await Promise.all([
    setPortalListingStatusInDb({
      userId: currentUser.id,
      listingId: getRequiredString(formData, "listingId"),
      status: getRequiredListingStatus(formData, "status"),
    }),
    getPortalAccessState(currentUser.id),
  ]);

  revalidatePath(routes.app.portalProperties);
  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  redirect(getListingRedirectHref(access.hasAgencyPortalAccess));
}

export async function addListingAccessGrantAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    throw new Error("Current user cannot edit listings");
  }

  const listingId = getRequiredString(formData, "listingId");
  const grantedToEmail = getRequiredString(formData, "email");

  await addListingAccessGrantInDb({ userId: currentUser.id, listingId, grantedToEmail });
  revalidatePath(routes.app.portalListingEdit(listingId));
}

export async function removeListingAccessGrantAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    throw new Error("Current user cannot edit listings");
  }

  const listingId = getRequiredString(formData, "listingId");
  const grantId = getRequiredString(formData, "grantId");

  await removeListingAccessGrantInDb({ userId: currentUser.id, listingId, grantId });
  revalidatePath(routes.app.portalListingEdit(listingId));
}

export async function createOwnershipTransferAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const propertyInternalId = getRequiredString(formData, "propertyInternalId");
  const propertyRouteId = getRequiredString(formData, "propertyRouteId");
  const buyerEmail = getRequiredString(formData, "buyerEmail");
  const transferMode = getRequiredTransferMode(formData, "transferMode");
  const transferNote = getOptionalString(formData, "transferNote");

  try {
    const result = await createOwnershipTransferRequestInDb({
      sellerUserId: currentUser.id,
      propertyInternalId,
      buyerEmail,
      transferMode,
      transferNote,
    });

    revalidatePath(routes.app.portalProperties);
    revalidatePath(routes.admin.properties);
    redirect(
      buildTransferPageHref({
        status: result.outcome === "existing_pending" ? "existing_pending" : "created",
        propertyRouteId,
        buyerEmail,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create transfer request";
    const status =
      message === "No active Amazuga user exists for that email address yet"
        ? "buyer_not_found"
        : message === "You cannot transfer a property to yourself"
          ? "self"
          : message === "Current user no longer owns this property"
            ? "not_owner"
            : "error";

    redirect(
      buildTransferPageHref({
        status,
        propertyRouteId,
        buyerEmail,
      }),
    );
  }
}

export async function submitPropertyDetailsAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);

  const property = await updatePortalPropertyRecordInDb({
    userId: currentUser.id,
    propertyRouteId: getRequiredString(formData, "propertyRouteId"),
    unitLabel: getOptionalString(formData, "unitLabel"),
    bedrooms: getOptionalInteger(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
    yearBuilt: getOptionalInteger(formData, "yearBuilt"),
  });

  revalidatePath(routes.app.portalProperties);
  revalidatePath(routes.app.portalListingNew);

  if (property?.propertyRouteId) {
    revalidatePath(routes.public.property(property.propertyRouteId));
    revalidatePath(routes.app.portalPropertyEdit(property.propertyRouteId));
  }

  redirect(routes.app.portalProperties);
}

export async function registerBuildingUnitAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const buildingRouteId = getRequiredString(formData, "buildingRouteId");

  const property = await registerPortalBuildingUnitInDb({
    userId: currentUser.id,
    buildingRouteId,
    unitLabel: getRequiredString(formData, "unitLabel"),
    bedrooms: getOptionalInteger(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
    yearBuilt: getOptionalInteger(formData, "yearBuilt"),
  });

  revalidatePath(routes.app.portalProperties);
  revalidatePath(routes.app.portalListingNew);

  if (property?.propertyRouteId) {
    revalidatePath(routes.public.property(property.propertyRouteId));
    revalidatePath(routes.app.portalPropertyEdit(property.propertyRouteId));
  }

  redirect(routes.app.portalPropertyEdit(buildingRouteId));
}

// ─── Ownership contest flow ────────────────────────────────────────────────

export type SubmitContestResult =
  | { type: "success" }
  | { type: "error"; message: string };

export async function submitOwnershipContestAction(
  _prev: SubmitContestResult | null,
  formData: FormData,
): Promise<SubmitContestResult> {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyContest);

  const upi = getOptionalString(formData, "upi");
  const claimedPropertyAssetId = getOptionalString(formData, "claimedPropertyAssetId");
  const claimedPropertyId = getOptionalString(formData, "claimedPropertyId");
  const note = getOptionalString(formData, "note");

  if (!upi || !claimedPropertyId) {
    return { type: "error", message: "Missing contest target. Please go back and try again." };
  }
  if (!note || note.trim().length < 10) {
    return { type: "error", message: "Please provide a note of at least 10 characters explaining your claim." };
  }

  try {
    await createOwnershipContest({
      contestingUserId: currentUser.id,
      upi,
      claimedPropertyAssetId,
      claimedPropertyId,
      note: note.trim(),
    });
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "Failed to submit contest." };
  }

  return { type: "success" };
}

// ─── New direct listing flow (no UPI) ────────────────────────────────────

export type SubmitDirectListingResult =
  | { type: "error"; message: string };

/**
 * Called from the final step of the no-UPI listing form.
 * Creates a direct listing as a draft and redirects to the listing edit page.
 */
export async function submitNewDirectListingAction(
  _prev: SubmitDirectListingResult | null,
  formData: FormData,
): Promise<SubmitDirectListingResult> {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyNewDirect);

  const assetType = getOptionalString(formData, "assetType");
  const adminDistrict = getOptionalString(formData, "adminDistrict");
  const rawMarketingType = formData.get("marketingType");

  if (!assetType) return { type: "error", message: "Property type is required." };
  if (!adminDistrict) return { type: "error", message: "Village / location is required." };
  if (rawMarketingType !== "sale" && rawMarketingType !== "rent") {
    return { type: "error", message: "Please choose sale or rent." };
  }

  let listing;
  try {
    listing = await createDirectListingInDb({
      createdByUserId: currentUser.id,
      agencyId: getOptionalString(formData, "agencyId"),
      agentUserId: getOptionalString(formData, "agentUserId") ?? currentUser.id,
      assetType: assetType as PropertyKind,
      adminDistrict,
      adminSector: getOptionalString(formData, "adminSector"),
      adminCell: getOptionalString(formData, "adminCell"),
      adminVillage: getOptionalString(formData, "adminVillage"),
      marketingType: rawMarketingType,
      askingPriceRwf: getOptionalNumber(formData, "askingPriceRwf"),
      visibility: "public",
      bedrooms: getOptionalNumber(formData, "bedrooms"),
      bathrooms: getOptionalNumber(formData, "bathrooms"),
      interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
      createOwnershipForUser: currentUser.id,
    });
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "An unexpected error occurred." };
  }

  await addRoleToUser(currentUser.id, "private_lister");
  revalidatePath(routes.app.portalProperties);
  redirect(routes.app.portalListingEdit(listing.listingId));
}

// ─── New UPI listing flow ──────────────────────────────────────────────────

export type UpiParcelLookupResult = {
  parcelId: string;
  upi: string;
  district?: string;
  sector?: string;
  representativeSize?: number;
  zoning?: string;
} | null;

/** Called from step 1 of the UPI listing form to validate the UPI and load parcel data. */
export async function lookupParcelForNewListingAction(upi: string): Promise<UpiParcelLookupResult> {
  await requireCurrentUser(routes.app.portalPropertyNew);
  return getParcelDataForNewUpiListing(upi);
}

export type SubmitUpiListingResult =
  | { type: "already_owned" }
  | { type: "conflict_other_owner"; existingPropertyId: string | null; existingPropertyAssetId: string | null }
  | { type: "error"; message: string };

/** Called from step 4 of the UPI listing form to create the draft listing. Redirects on success. */
export async function submitUpiListingAction(
  _prev: SubmitUpiListingResult | null,
  formData: FormData,
): Promise<SubmitUpiListingResult> {
  const currentUser = await requireCurrentUser(routes.app.portalPropertyNew);

  const parcelId = formData.get("parcelId");
  const upi = formData.get("upi");
  const rawClaimScope = formData.get("claimScope");
  const rawDeclaredAssetType = formData.get("declaredAssetType");
  const rawTenureType = formData.get("tenureType");
  const rawMarketingType = formData.get("marketingType");

  if (
    typeof parcelId !== "string" || !parcelId ||
    typeof upi !== "string" || !upi ||
    typeof rawDeclaredAssetType !== "string" || !rawDeclaredAssetType ||
    typeof rawMarketingType !== "string" || (rawMarketingType !== "sale" && rawMarketingType !== "rent")
  ) {
    return { type: "error", message: "Missing required fields. Please start the form again." };
  }

  const claimScope = rawClaimScope === "unit_partial" ? "unit_partial" as const : "full_parcel" as const;
  const tenureType: PropertyTenureType =
    rawTenureType === "freehold" || rawTenureType === "emphyteutic_lease" ? rawTenureType : "unspecified";
  const unitLabel = getOptionalString(formData, "unitLabel");
  const askingPriceRwf = getOptionalNumber(formData, "askingPriceRwf");
  const locationHidden = formData.get("locationHidden") === "true";

  const propertyFacts = {
    bedrooms: getOptionalNumber(formData, "bedrooms"),
    bathrooms: getOptionalNumber(formData, "bathrooms"),
    interiorAreaSqm: getOptionalNumber(formData, "interiorAreaSqm"),
    yearBuilt: getOptionalNumber(formData, "yearBuilt"),
  };

  let result;
  try {
    result = await createAndAutoApproveUpiClaim({
      userId: currentUser.id,
      parcelId,
      upi,
      claimScope,
      unitLabel,
      declaredAssetType: rawDeclaredAssetType as PropertyKind,
      tenureType,
      tenureSource: tenureType === "unspecified" ? "unspecified" : "user_provided",
      propertyFacts,
      marketingType: rawMarketingType,
      askingPriceRwf,
      locationHidden,
      agencyId: getOptionalString(formData, "agencyId"),
    });
  } catch (err) {
    return { type: "error", message: err instanceof Error ? err.message : "An unexpected error occurred." };
  }

  if (result.outcome === "already_owned") {
    return { type: "already_owned" };
  }

  if (result.outcome === "conflict_other_owner") {
    return {
      type: "conflict_other_owner",
      existingPropertyId: result.existingPropertyId,
      existingPropertyAssetId: result.existingPropertyAssetId,
    };
  }

  // outcome === "created"
  revalidatePath(routes.app.portalProperties);
  revalidateListingSurfaces({ propertyRouteId: result.propertyId, marketingType: rawMarketingType });
  redirect(routes.app.portalListingEdit(result.listingId));
}

// ──────────────────────────────────────────────────────────────────────────────

export async function respondToOwnershipTransferAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalProperties);
  const decision = getRequiredString(formData, "decision");
  if (decision !== "accept" && decision !== "decline") {
    throw new Error("Invalid transfer decision");
  }

  const propertyRouteId = getOptionalString(formData, "propertyRouteId");
  await respondToOwnershipTransferRequestInDb({
    buyerUserId: currentUser.id,
    claimRequestId: getRequiredString(formData, "claimId"),
    decision,
  });

  revalidatePath(routes.app.portalProperties);
  revalidatePath(routes.admin.properties);
  if (propertyRouteId) {
    revalidatePath(routes.public.property(propertyRouteId));
  }

  redirect(
    buildTransferStatusHref({
      status: decision === "accept" ? "accepted" : "declined",
      propertyRouteId,
    }),
  );
}
