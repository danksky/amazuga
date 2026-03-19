import { AgencyRegistrationForm } from "@/features/auth/agency-registration-form";
import { requireCurrentUser } from "@/lib/auth";
import { readAgencyApplications } from "@/lib/data-store";
import { routes } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgencyRegistrationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.agencyRegistrationNew);
  const existing = [...(await readAgencyApplications())]
    .reverse()
    .find((application) => application.createdByUserId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.agencyRegistration(existing.id));
  }

  return <AgencyRegistrationForm />;
}
