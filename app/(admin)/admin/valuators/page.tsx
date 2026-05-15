import { AdminReviewPage } from "@/features/admin/admin-review-page";
import { formatDate } from "@/lib/format";
import { listValuatorApplicationsFromDb } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function AdminValuatorsPage() {
  const items = (await listValuatorApplicationsFromDb())
    .filter((application) => application.status === "pending")
    .map((application) => ({
      id: application.id,
      kind: "valuator" as const,
      title: application.irpvRegistrationNumber,
      meta: [`Applicant ${application.userId}`, `Submitted ${formatDate(application.createdAt)}`],
      details: [
        { label: "Application ID", value: application.id },
        { label: "Applicant", value: application.userId },
        { label: "IRPV number", value: application.irpvRegistrationNumber },
      ],
      reviewNote:
        "Approving this application grants valuator recognition and unlocks valuation submission in the portal.",
    }));

  return (
    <AdminReviewPage
      active="valuators"
      body="Review valuator recognition submissions waiting for approval."
      empty="No pending valuator submissions."
      items={items}
      title="Valuator review"
    />
  );
}
