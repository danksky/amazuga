"use server";

import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createAgencyApplication, createAgentApplication, createValuatorApplication } from "@/lib/data-store";
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

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

export async function submitAgencyRegistrationAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.onboarding.agencyRegistrationNew);
  const application = await createAgencyApplication({
    createdByUserId: currentUser.id,
    businessName: getRequiredString(formData, "businessName"),
    tin: getRequiredString(formData, "tin"),
    websiteUrl: getOptionalString(formData, "website"),
    googleMapsUrl: getOptionalString(formData, "googleMapsListing"),
  });

  redirect(routes.onboarding.agencyRegistration(application.id));
}

export async function submitAgentApplicationAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.onboarding.agentApplicationNew);
  getRequiredString(formData, "fullName");
  getRequiredString(formData, "phoneNumber");
  const selectedAgencyId = getRequiredString(formData, "agencyId");

  const application = await createAgentApplication({
    userId: currentUser.id,
    nationalIdPhotoUrl: "/placeholders/property-generic.svg",
    selectedAgencyId,
  });

  redirect(routes.onboarding.agentApplication(application.id));
}

export async function submitValuatorApplicationAction(formData: FormData) {
  const currentUser = await requireCurrentUser(routes.onboarding.valuatorApplicationNew);
  getRequiredString(formData, "fullName");
  getRequiredString(formData, "phoneNumber");

  const application = await createValuatorApplication({
    userId: currentUser.id,
    irpvRegistrationNumber: getRequiredString(formData, "irpvRegistrationNumber"),
  });

  redirect(routes.onboarding.valuatorApplication(application.id));
}
