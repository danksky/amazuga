import { redirect } from "next/navigation";

import { getCurrentUser, isOtpMode } from "@/lib/auth";
import { AuthPage } from "@/features/auth/auth-page";
import { routes } from "@/lib/routes";
import { listUsersFromDb } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; step?: string; phone?: string }>;
}) {
  const [currentUser, { next, error, step, phone }] = await Promise.all([getCurrentUser(), searchParams]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  const otpMode = isOtpMode();
  const isVerifyStep = step === "verify";

  // In mock mode on the phone step, load users for the quick-switch panel
  const users = !otpMode && !isVerifyStep ? await listUsersFromDb() : [];

  return (
    <AuthPage
      error={error}
      mode="login"
      next={next}
      otpMode={otpMode}
      otpPhone={phone}
      otpStep={isVerifyStep ? "verify" : "phone"}
      users={users}
    />
  );
}
