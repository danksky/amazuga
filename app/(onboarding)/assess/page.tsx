import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function AssessPage() {
  redirect(routes.onboarding.advertise);
}
