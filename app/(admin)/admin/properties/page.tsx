import { AdminReviewPage } from "@/features/admin/admin-review-page";
import { formatDate } from "@/lib/format";
import { listPropertyClaimRequestsFromDb } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function AdminPropertiesPage() {
  const items = (await listPropertyClaimRequestsFromDb())
    .filter((claim) => claim.status === "pending")
    .map((claim) => ({
      id: claim.id,
      kind: "property_claim" as const,
      title: claim.propertyTitle,
      meta: [
        `Claimant ${claim.userFullName}`,
        `Submitted ${formatDate(claim.createdAt)}`,
      ],
      details: [
        { label: "Claim request ID", value: claim.id },
        { label: "Property route", value: claim.propertyRouteId ?? claim.propertyId },
        { label: "Scope", value: claim.propertyKind === "apartment_unit" || claim.propertyKind === "commercial_unit" ? "Unit ownership" : "Full property ownership" },
        { label: "Location", value: `${claim.sector ? `${claim.sector}, ` : ""}${claim.district}` },
      ],
      reviewNote:
        "Approving this claim creates an active ownership record for the user, makes the property appear in their portal properties workspace, and unlocks listing creation against that owned property.",
    }));

  return (
    <AdminReviewPage
      active="properties"
      body="Review ownership claims before a user can treat the property as theirs in the portal."
      empty="No pending property claims."
      items={items}
      title="Property claims"
    />
  );
}
