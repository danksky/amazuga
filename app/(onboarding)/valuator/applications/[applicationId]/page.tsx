import { notFound } from "next/navigation";

import { ApplicationStatus } from "@/features/auth/application-status";
import { requireCurrentUser } from "@/lib/auth";
import { readValuatorApplications } from "@/lib/data-store";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";

function getStatusCopy(status: "pending" | "approved" | "denied") {
  if (status === "approved") {
    return {
      body: "Your valuator recognition has been approved.",
      nextStepsBody: "You can now submit property valuations.",
      primaryHref: routes.app.portalValuations,
      primaryLabel: "Open valuations",
    };
  }

  if (status === "denied") {
    return {
      body: "Your valuator recognition request was denied.",
      nextStepsBody: "Review the details, then start a new application if you want to apply again.",
      primaryHref: routes.onboarding.valuatorApplicationNew,
      primaryLabel: "Apply again",
    };
  }

  return {
    body: "Your valuator recognition request has been submitted for review.",
    nextStepsBody:
      "Your registration number is being reviewed before valuator recognition is granted. Once approved, you will be able to submit property valuations.",
    primaryHref: routes.public.buy,
    primaryLabel: "Back",
  };
}

export const dynamic = "force-dynamic";

export default async function ValuatorApplicationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const currentUser = await requireCurrentUser();
  const { applicationId } = await params;
  const application = (await readValuatorApplications()).find((entry) => entry.id === applicationId);

  if (!application) {
    notFound();
  }

  if (application.userId !== currentUser.id) {
    notFound();
  }

  const statusCopy = getStatusCopy(application.status);

  return (
    <ApplicationStatus
      body={statusCopy.body}
      details={[
        { label: "Applicant", value: currentUser.fullName },
        { label: "IRPV registration number", value: application.irpvRegistrationNumber },
        { label: "Submitted", value: formatDate(application.createdAt) },
      ]}
      eyebrow="Valuator application"
      nextStepsBody={statusCopy.nextStepsBody}
      nextStepsTitle="What happens next"
      primaryHref={statusCopy.primaryHref}
      primaryLabel={statusCopy.primaryLabel}
      secondaryHref={application.status === "denied" ? routes.public.buy : undefined}
      secondaryLabel={application.status === "denied" ? "Back" : undefined}
      status={application.status === "pending" ? "Under review" : application.status === "approved" ? "Approved" : "Denied"}
      title="Your valuator recognition"
    />
  );
}
