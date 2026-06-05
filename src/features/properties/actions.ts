"use server";

import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";
import { toggleSavedPropertyForUserInDb } from "@/lib/server/users";

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

export async function toggleSavePropertyAction(formData: FormData) {
  const propertyRouteId = getRequiredString(formData, "propertyRouteId");
  const propertyPath = getRequiredString(formData, "propertyPath");
  const currentUser = await requireCurrentUser(propertyPath);
  const result = await toggleSavedPropertyForUserInDb({
    userId: currentUser.id,
    propertyRouteId,
  });

  redirect(`${propertyPath}?saved=${result.didSave ? "1" : "0"}`);
}

export async function startPropertyClaimAction(formData: FormData) {
  const propertyRouteId = getRequiredString(formData, "propertyRouteId");
  const propertyPath = getRequiredString(formData, "propertyPath");
  const currentUser = await requireCurrentUser(propertyPath);
  const propertyPageData = await getPublicPropertyPageData(propertyRouteId, currentUser.id);

  if (!propertyPageData) {
    redirect(propertyPath);
  }

  const params = new URLSearchParams({ upi: propertyPageData.property.upi ?? "" });
  redirect(`${routes.app.portalPropertyClaim}?${params.toString()}`);
}
