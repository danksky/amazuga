"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  activateApprovedAgentMembershipInDb,
  activatePendingAgencyManagerInDb,
  ensureAgencyFromApprovedApplicationInDb,
  resolveOwnershipContestInDb,
  updatePropertyClaimRequestStatusInDb,
  updateValuationSubmissionStatusInDb,
  updateApplicationStatusInDb,
} from "@/lib/server/workflows";
import type { SubmissionStatus } from "@/types/domain";

const contestPaths = [routes.admin.contests, routes.admin.dashboard];

const reviewPaths = [
  routes.admin.dashboard,
  routes.admin.agencies,
  routes.admin.agents,
  routes.admin.valuators,
  routes.admin.valuations,
  routes.admin.properties,
  routes.app.portalProperties,
  routes.app.portalListings,
  routes.app.portalValuations,
  routes.app.portalValuationNew,
  routes.app.portalListingNew,
];

export async function resolveContestAction(formData: FormData) {
  await requireAdminUser();

  const contestId = formData.get("contestId");
  const resolution = formData.get("resolution");

  if (
    typeof contestId !== "string" ||
    (resolution !== "resolved_upheld" && resolution !== "resolved_overturned")
  ) {
    throw new Error("Invalid contest resolution payload");
  }

  const { claimedPropertyId } = await resolveOwnershipContestInDb(contestId, resolution);

  contestPaths.forEach((p) => revalidatePath(p));

  if (resolution === "resolved_overturned" && claimedPropertyId) {
    // Overturn removes the owner's listings — revalidate browse and the property page.
    revalidatePath(routes.app.portalProperties);
    revalidatePath(routes.public.buy);
    revalidatePath(routes.public.rent);
    revalidatePath(routes.public.property(claimedPropertyId));
  }
}

export async function reviewApplicationAction(formData: FormData) {
  await requireAdminUser();

  const kind = formData.get("kind");
  const applicationId = formData.get("applicationId");
  const decision = formData.get("decision");

  if (
    (kind !== "agency" && kind !== "agent" && kind !== "valuator" && kind !== "valuation" && kind !== "property_claim") ||
    typeof applicationId !== "string" ||
    (decision !== "approved" && decision !== "denied")
  ) {
    throw new Error("Invalid review payload");
  }

  if (kind === "valuation") {
    const submission = await updateValuationSubmissionStatusInDb(applicationId, decision as SubmissionStatus);

    reviewPaths.forEach((reviewPath) => {
      revalidatePath(reviewPath);
    });

    if (submission?.propertyRouteId) {
      revalidatePath(routes.public.property(submission.propertyRouteId));
    }

    revalidatePath(routes.public.buy);
    revalidatePath(routes.public.rent);
    return;
  }

  if (kind === "property_claim") {
    const claimRequest = await updatePropertyClaimRequestStatusInDb(applicationId, decision as SubmissionStatus);

    reviewPaths.forEach((reviewPath) => {
      revalidatePath(reviewPath);
    });

    if (claimRequest?.propertyId) {
      revalidatePath(routes.public.property(claimRequest.propertyId));
    }

    revalidatePath(routes.public.buy);
    revalidatePath(routes.public.rent);

    return;
  }

  await updateApplicationStatusInDb(kind, applicationId, decision as SubmissionStatus);

  if (kind === "agency" && decision === "approved") {
    await ensureAgencyFromApprovedApplicationInDb(applicationId);
  }

  if (kind === "agent" && decision === "approved") {
    const application = await activateApprovedAgentMembershipInDb(applicationId);
    if (application) {
      await activatePendingAgencyManagerInDb(application.userId);
    }
  }

  reviewPaths.forEach((reviewPath) => {
    revalidatePath(reviewPath);
  });
}
