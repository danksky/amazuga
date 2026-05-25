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
      title: claim.kind === "transfer" ? claim.propertyTitle : claim.upi,
      meta: [
        claim.kind === "transfer" ? `Buyer ${claim.userFullName}` : `Claimant ${claim.userFullName}`,
        `Submitted ${formatDate(claim.createdAt)}`,
      ],
      details: [
        { label: "Claim request ID", value: claim.id },
        { label: "Request type", value: claim.kind === "transfer" ? "Ownership transfer" : "Ownership claim" },
        { label: "UPI", value: claim.upi },
        { label: "Resolved property route", value: claim.propertyRouteId ?? "Not resolved yet" },
        ...(claim.kind === "transfer"
          ? [{ label: "Current owner", value: claim.transferFromUserFullName ?? "Unknown owner" }]
          : []),
        ...(claim.kind === "transfer"
          ? [{ label: "Transfer type", value: claim.transferMode === "sale" ? "Sale" : "Transfer" }]
          : []),
        ...(claim.kind === "transfer"
          ? [{ label: "Buyer confirmed", value: claim.buyerConfirmedAt ? "Yes" : "No" }]
          : []),
        { label: "Declared asset type", value: claim.declaredAssetType ?? "Not provided" },
        { label: "Scope", value: claim.claimScope === "unit_partial" ? "Unit or apartment" : "Whole parcel" },
        { label: "Unit label", value: claim.unitLabel ?? "Not provided" },
        {
          label: "Land tenure",
          value:
            claim.tenureType === "freehold"
              ? "Freehold"
              : claim.tenureType === "emphyteutic_lease"
                ? "Emphyteutic lease"
                : "Unspecified",
        },
        { label: "Location", value: `${claim.sector ? `${claim.sector}, ` : ""}${claim.district}` },
      ],
      approvalBlockedReason: claim.approvalBlockedReason,
      reviewNote: claim.kind === "transfer"
        ? "Approving this transfer moves ownership to the buyer and archives any open listings currently attached to this property."
        :
        claim.claimScope === "unit_partial" && !claim.propertyInternalId
          ? "This claim is for a specific unit. Approval will only work after the request is matched to an existing Preview unit asset, then an active ownership record can be created for the user."
          : claim.declaredAssetType && !claim.propertyInternalId
          ? `Approving this claim will create a new ${claim.declaredAssetType} asset on this parcel, then create an active ownership record for the user.`
          : "Approving this claim creates an active ownership record for the user and makes the property appear in their portal properties workspace.",
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
