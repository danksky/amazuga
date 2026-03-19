import { notFound } from "next/navigation";

import { ApplicationStatus } from "@/features/auth/application-status";
import { requireCurrentUser } from "@/lib/auth";
import { readAgencies, readAgencyApplications, readAgentApplications } from "@/lib/data-store";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

function getStatusCopy(
  status: "pending" | "approved" | "denied",
  options: { managerActivated: boolean; agentApproved: boolean },
) {
  if (status === "approved") {
    if (!options.agentApproved || !options.managerActivated) {
      return {
        body: "Your agency registration has been approved, but agency management is still locked until your agent approval is complete.",
        nextStepsBody:
          "Once your agent application is approved, your manager access will activate and you will be able to manage the agency in the portal.",
        primaryHref: routes.onboarding.agentApplicationNew,
        primaryLabel: options.agentApproved ? "Back" : "Apply as agent",
      };
    }

    return {
      body: "Your agency registration has been approved.",
      nextStepsBody: "You can continue into the portal to manage the agency and work with agents.",
      primaryHref: routes.app.portal,
      primaryLabel: "Go to portal",
    };
  }

  if (status === "denied") {
    return {
      body: "Your agency registration was denied.",
      nextStepsBody: "Review the submitted details, then start a new registration if you still want to create the agency.",
      primaryHref: routes.onboarding.agencyRegistrationNew,
      primaryLabel: "Register again",
    };
  }

  return {
    body: "Your agency registration has been submitted for review.",
    nextStepsBody:
      "You do not need to submit another registration while this one is under review. Once approved, the agency can become available for agent membership.",
    primaryHref: routes.onboarding.advertise,
    primaryLabel: "Back to advertise",
  };
}

export const dynamic = "force-dynamic";

export default async function AgencyRegistrationRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const currentUser = await requireCurrentUser();
  const { requestId } = await params;
  const [applications, agencies, agentApplications] = await Promise.all([
    readAgencyApplications(),
    readAgencies(),
    readAgentApplications(),
  ]);
  const application = applications.find((entry) => entry.id === requestId);

  if (!application) {
    notFound();
  }

  if (application.createdByUserId !== currentUser.id) {
    notFound();
  }

  const linkedAgency = agencies.find((agency) => agency.createdFromApplicationId === application.id);
  const latestAgentApplication = [...agentApplications]
    .reverse()
    .find((entry) => entry.userId === application.createdByUserId);
  const statusCopy = getStatusCopy(application.status, {
    managerActivated: linkedAgency?.managerUserId === application.createdByUserId,
    agentApproved: latestAgentApplication?.status === "approved",
  });

  return (
    <ApplicationStatus
      body={statusCopy.body}
      details={[
        { label: "Business name", value: application.businessName },
        { label: "TIN", value: application.tin },
        { label: "Submitted", value: formatDate(application.createdAt) },
        {
          label: "Manager activation",
          value:
            application.status !== "approved"
              ? "Pending agency approval"
              : linkedAgency?.managerUserId === application.createdByUserId
                ? "Active"
                : latestAgentApplication?.status === "approved"
                  ? "Pending activation"
                  : "Waiting for agent approval",
        },
      ]}
      eyebrow="Agency registration request"
      nextStepsBody={statusCopy.nextStepsBody}
      nextStepsTitle="What happens next"
      primaryHref={statusCopy.primaryHref}
      primaryLabel={statusCopy.primaryLabel}
      secondaryHref={application.status === "denied" ? routes.public.buy : undefined}
      secondaryLabel={application.status === "denied" ? "Browse homes" : undefined}
      status={application.status === "pending" ? "Under review" : application.status === "approved" ? "Approved" : "Denied"}
      title={application.businessName}
    />
  );
}
