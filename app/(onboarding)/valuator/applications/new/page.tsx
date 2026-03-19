import { ValuatorApplicationForm } from "@/features/auth/valuator-application-form";
import { requireCurrentUser } from "@/lib/auth";
import { readValuatorApplications } from "@/lib/data-store";
import { routes } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ValuatorApplicationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.valuatorApplicationNew);
  const existing = [...(await readValuatorApplications())]
    .reverse()
    .find((application) => application.userId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.valuatorApplication(existing.id));
  }

  return <ValuatorApplicationForm />;
}
