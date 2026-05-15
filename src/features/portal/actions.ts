"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
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
