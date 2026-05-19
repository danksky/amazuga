"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  createPortalListingInDb,
  setPortalListingStatusInDb,
  updatePortalListingInDb,
} from "@/lib/server/portal-listing-editor";
import { createValuationSubmissionInDb } from "@/lib/server/workflows";
import { hasCapability } from "@/types/permissions";

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

function getRequiredListingStatus(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  if (value !== "active" && value !== "inactive") {
    throw new Error(`Invalid listing status: ${key}`);
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
    askingPrice: getRequiredNumber(formData, "askingPrice"),
    description: getOptionalString(formData, "description"),
  });

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  redirect(routes.app.portalListings);
}

export async function submitListingUpdateAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "edit_listing")) {
    throw new Error("Current user cannot edit listings");
  }

  const listing = await updatePortalListingInDb({
    userId: currentUser.id,
    listingId: getRequiredString(formData, "listingId"),
    agentUserId: getRequiredString(formData, "agentUserId"),
    marketingType: getRequiredListingMarketingType(formData, "marketingType"),
    askingPrice: getRequiredNumber(formData, "askingPrice"),
    description: getOptionalString(formData, "description"),
  });

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  redirect(routes.app.portalListings);
}

export async function setListingStatusAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.app.portalListings);

  if (!hasCapability(currentUser.roles, "deactivate_listing")) {
    throw new Error("Current user cannot change listing status");
  }

  const listing = await setPortalListingStatusInDb({
    userId: currentUser.id,
    listingId: getRequiredString(formData, "listingId"),
    status: getRequiredListingStatus(formData, "status"),
  });

  revalidateListingSurfaces({
    propertyRouteId: listing.propertyRouteId,
    marketingType: listing.marketingType,
  });
  redirect(routes.app.portalListings);
}
