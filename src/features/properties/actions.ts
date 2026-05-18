"use server";

import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { toggleSavedPropertyForUserInDb } from "@/lib/server/users";
import { createPropertyClaimRequestInDb } from "@/lib/server/workflows";
import { revalidatePath } from "next/cache";

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

export async function createPropertyClaimRequestAction(formData: FormData) {
  const propertyRouteId = getRequiredString(formData, "propertyRouteId");
  const propertyPath = getRequiredString(formData, "propertyPath");
  const propertyId = getRequiredString(formData, "propertyId");
  const propertyInternalId = getRequiredString(formData, "propertyInternalId");
  const parcelId = getRequiredString(formData, "parcelId");
  const currentUser = await requireCurrentUser(propertyPath);

  const result = await createPropertyClaimRequestInDb({
    userId: currentUser.id,
    propertyId,
    propertyInternalId,
    parcelId,
  });
  revalidatePath(routes.app.portal);
  revalidatePath(routes.app.portalListings);
  revalidatePath(routes.app.portalProperties);
  revalidatePath(propertyPath);

  const claimState =
    result.outcome === "already_owned"
      ? "owned"
      : result.outcome === "existing_pending"
        ? "pending"
        : "created";
  redirect(`${propertyPath}?claim=${claimState}`);
}
