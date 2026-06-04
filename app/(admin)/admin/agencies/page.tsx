import { AdminReviewPage } from "@/features/admin/admin-review-page";
import { formatDate } from "@/lib/format";
import { listAgencyApplicationsFromDb } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage() {
  const items = (await listAgencyApplicationsFromDb())
    .filter((application) => application.status === "pending")
    .map((application) => ({
      id: application.id,
      kind: "agency" as const,
      title: application.businessName,
      meta: [`TIN ${application.tin}`, `Submitted ${formatDate(application.createdAt)}`],
      details: [
        { label: "Request ID", value: application.id },
        { label: "Created by", value: application.createdByUserId },
        { label: "Website", value: application.websiteUrl ?? "Not provided" },
        { label: "Instagram", value: application.instagramUrl ?? "Not provided" },
        { label: "Google Maps", value: application.googleMapsUrl ?? "Not provided" },
      ],
      reviewNote:
        "Approving this request creates the agency record. The creator becomes the pending manager candidate and only gains active manager access after agent approval.",
    }));

  return (
    <AdminReviewPage
      active="agencies"
      body="Review agency submissions that are waiting for approval."
      empty="No pending agency submissions."
      items={items}
      title="Agency review"
    />
  );
}
