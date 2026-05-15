import { AgencyRegistrationForm } from "@/features/auth/agency-registration-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { listAgencyApplicationsFromDb } from "@/lib/server/workflows";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgencyRegistrationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.agencyRegistrationNew);
  const existing = [...(await listAgencyApplicationsFromDb())]
    .reverse()
    .find((application) => application.createdByUserId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.agencyRegistration(existing.id));
  }

  return <AgencyRegistrationForm />;
}
