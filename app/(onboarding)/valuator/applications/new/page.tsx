import { ValuatorApplicationForm } from "@/features/auth/valuator-application-form";
import { requireCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { listValuatorApplicationsFromDb } from "@/lib/server/workflows";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ValuatorApplicationNewPage() {
  const currentUser = await requireCurrentUser(routes.onboarding.valuatorApplicationNew);
  const existing = [...(await listValuatorApplicationsFromDb())]
    .reverse()
    .find((application) => application.userId === currentUser.id && application.status !== "denied");

  if (existing) {
    redirect(routes.onboarding.valuatorApplication(existing.id));
  }

  return <ValuatorApplicationForm />;
}
