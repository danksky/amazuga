import { notFound } from "next/navigation";

import { ApplicationStatus } from "@/features/auth/application-status";
import { requireCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getAgentApplicationById, listAgenciesFromDb } from "@/lib/server/workflows";

function getStatusCopy(status: "pending" | "approved" | "denied") {
  if (status === "approved") {
    return {
      body: "Your agent application has been approved.",
      nextStepsBody: "Your selected approved agency membership is now active, so you can continue with listing activity.",
      primaryHref: routes.onboarding.advertise,
      primaryLabel: "Back to applications",
    };
  }

  if (status === "denied") {
    return {
      body: "Your agent application was denied.",
      nextStepsBody: "Review the submission details, then start a new application when you are ready to try again.",
      primaryHref: routes.onboarding.agentApplicationNew,
      primaryLabel: "Apply again",
    };
  }

  return {
    body: "Your agent application has been submitted for review.",
    nextStepsBody:
      "Your National ID submission is being reviewed. Once approved, you can continue with agency membership and listing activity.",
    primaryHref: routes.onboarding.advertise,
    primaryLabel: "Back to applications",
  };
}

export const dynamic = "force-dynamic";

export default async function AgentApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const currentUser = await requireCurrentUser();
  const { applicationId } = await params;
  const [application, agencies] = await Promise.all([getAgentApplicationById(applicationId), listAgenciesFromDb()]);

  if (!application) {
    notFound();
  }

  if (application.userId !== currentUser.id) {
    notFound();
  }

  const selectedAgency = application.selectedAgencyId
    ? agencies.find((agency) => agency.id === application.selectedAgencyId)
    : undefined;
  const statusCopy = getStatusCopy(application.status);

  return (
    <ApplicationStatus
      body={statusCopy.body}
      details={[
        { label: "Applicant", value: currentUser.fullName },
        { label: "Selected agency", value: selectedAgency?.businessName ?? "Not selected" },
        {
          label: "Agency membership",
          value:
            application.status === "approved"
              ? selectedAgency?.status === "approved"
                ? "Active"
                : "Unavailable"
              : "Pending agent approval",
        },
        { label: "National ID photo", value: "Received" },
        { label: "Submitted", value: formatDate(application.createdAt) },
      ]}
      eyebrow="Agent application"
      nextStepsBody={statusCopy.nextStepsBody}
      nextStepsTitle="What happens next"
      primaryHref={statusCopy.primaryHref}
      primaryLabel={statusCopy.primaryLabel}
      secondaryHref={application.status === "denied" ? routes.public.buy : undefined}
      secondaryLabel={application.status === "denied" ? "Browse homes" : undefined}
      status={application.status === "pending" ? "Under review" : application.status === "approved" ? "Approved" : "Denied"}
      title="Your agent application"
    />
  );
}
