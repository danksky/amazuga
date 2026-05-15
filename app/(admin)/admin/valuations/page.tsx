import { AdminReviewPage } from "@/features/admin/admin-review-page";
import { formatCurrency, formatDate } from "@/lib/format";
import { listValuationSubmissionsFromDb } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function AdminValuationsPage() {
  const items = (await listValuationSubmissionsFromDb())
    .filter((submission) => submission.status === "pending")
    .map((submission) => ({
      id: submission.id,
      kind: "valuation" as const,
      title: submission.propertyTitle,
      meta: [
        `${formatCurrency(submission.estimatedValue, submission.currency)} effective ${formatDate(submission.effectiveDate)}`,
        `Submitted by ${submission.submittedByUserId} on ${formatDate(submission.createdAt)}`,
      ],
      details: [
        { label: "Submission ID", value: submission.id },
        { label: "Property route", value: submission.propertyRouteId ?? submission.propertyId },
        { label: "Location", value: `${submission.sector ? `${submission.sector}, ` : ""}${submission.district}` },
        { label: "Visibility", value: submission.isAnonymous ? "Anonymous on public page" : "Named valuator" },
      ],
      reviewNote:
        "Approving this submission makes it part of the public valuation history for the property page and visible in the valuator portal as an approved record.",
    }));

  return (
    <AdminReviewPage
      active="valuations"
      body="Review pending valuation submissions before they become public property history."
      empty="No pending valuation submissions."
      items={items}
      title="Valuation review"
    />
  );
}
