"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
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
  createOwnershipTransferRequestInDb,
  createValuationSubmissionInDb,
  respondToOwnershipTransferRequestInDb,
} from "@/lib/server/workflows";
import type { PropertyKind, PropertyTransferMode } from "@/types/domain";
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

  await addRoleToUser(currentUser.id, "direct_lister");

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
    }),
    getPortalAccessState(currentUser.id),
  ]);

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
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
      });
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
  });

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
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
