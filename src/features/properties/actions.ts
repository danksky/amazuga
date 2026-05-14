"use server";

import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createPropertyClaimRequest, toggleSavedPropertyForUser } from "@/lib/data-store";
import { routes } from "@/lib/routes";

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
  const result = await toggleSavedPropertyForUser({
    userId: currentUser.id,
    propertyRouteId,
  });

  redirect(`${routes.public.property(propertyRouteId)}?saved=${result.didSave ? "1" : "0"}`);
}

export async function createPropertyClaimRequestAction(formData: FormData) {
  const propertyRouteId = getRequiredString(formData, "propertyRouteId");
  const propertyPath = getRequiredString(formData, "propertyPath");
  const propertyId = getRequiredString(formData, "propertyId");
  const propertyInternalId = getRequiredString(formData, "propertyInternalId");
  const parcelId = getRequiredString(formData, "parcelId");
  const currentUser = await requireCurrentUser(propertyPath);

  await createPropertyClaimRequest({
    userId: currentUser.id,
    propertyId,
    propertyInternalId,
    parcelId,
  });

  redirect(`${routes.public.property(propertyRouteId)}?claim=1`);
}
