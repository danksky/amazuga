import { AdminReviewPage } from "@/features/admin/admin-review-page";
import { formatDate } from "@/lib/format";
import { listAgenciesFromDb, listAgentApplicationsFromDb } from "@/lib/server/workflows";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  const [agentApplications, agencies] = await Promise.all([listAgentApplicationsFromDb(), listAgenciesFromDb()]);
  const items = agentApplications
    .filter((application) => application.status === "pending")
    .map((application) => ({
      id: application.id,
      kind: "agent" as const,
      title: application.userId,
      meta: ["National ID photo received", `Submitted ${formatDate(application.createdAt)}`],
      details: [
        { label: "Application ID", value: application.id },
        {
          label: "Selected agency",
          value:
            agencies.find((agency) => agency.id === application.selectedAgencyId)?.businessName ??
            application.selectedAgencyId ??
            "Unknown",
        },
        { label: "National ID", value: "Received" },
      ],
      reviewNote:
        "Approving this application grants agent approval and activates membership in the selected approved agency. If this user is also the pending manager candidate for an approved agency, manager access activates at the same time.",
    }));

  return (
    <AdminReviewPage
      active="agents"
      body="Review agent applications waiting for approval."
      empty="No pending agent applications."
      items={items}
      title="Agent review"
    />
  );
}
