"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import {
  activateApprovedAgentMembershipInDb,
  activatePendingAgencyManagerInDb,
  ensureAgencyFromApprovedApplicationInDb,
  updateValuationSubmissionStatusInDb,
  updateApplicationStatusInDb,
} from "@/lib/server/workflows";
import type { SubmissionStatus } from "@/types/domain";

const reviewPaths = [
  routes.admin.dashboard,
  routes.admin.agencies,
  routes.admin.agents,
  routes.admin.valuators,
  routes.admin.valuations,
  routes.app.portalValuations,
  routes.app.portalValuationNew,
];

export async function reviewApplicationAction(formData: FormData) {
  await requireAdminUser();

  const kind = formData.get("kind");
  const applicationId = formData.get("applicationId");
  const decision = formData.get("decision");

  if (
    (kind !== "agency" && kind !== "agent" && kind !== "valuator" && kind !== "valuation") ||
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
