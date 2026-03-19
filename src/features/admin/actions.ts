"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/auth";
import { activatePendingAgencyManager, ensureAgencyFromApprovedApplication, updateApplicationStatus } from "@/lib/data-store";
import { readAgentApplications } from "@/lib/data-store";
import { routes } from "@/lib/routes";
import type { SubmissionStatus } from "@/types/domain";

const reviewPaths = [
  routes.admin.dashboard,
  routes.admin.agencies,
  routes.admin.agents,
  routes.admin.valuators,
];

export async function reviewApplicationAction(formData: FormData) {
  await requireAdminUser();

  const kind = formData.get("kind");
  const applicationId = formData.get("applicationId");
  const decision = formData.get("decision");

  if (
    (kind !== "agency" && kind !== "agent" && kind !== "valuator") ||
    typeof applicationId !== "string" ||
    (decision !== "approved" && decision !== "denied")
  ) {
    throw new Error("Invalid review payload");
  }

  await updateApplicationStatus(kind, applicationId, decision as SubmissionStatus);

  if (kind === "agency" && decision === "approved") {
    await ensureAgencyFromApprovedApplication(applicationId);
  }

  if (kind === "agent" && decision === "approved") {
    const applications = await readAgentApplications();
    const application = applications.find((entry) => entry.id === applicationId);
    if (application) {
      await activatePendingAgencyManager(application.userId);
    }
  }

  reviewPaths.forEach((reviewPath) => {
    revalidatePath(reviewPath);
  });
}
