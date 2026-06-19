import { redirect } from "next/navigation";

import { getCurrentUser, isEmailMode, isMockEmailMode, isOtpMode } from "@/lib/auth";
import { AuthPage } from "@/features/auth/auth-page";
import { routes } from "@/lib/routes";
import { listUsersFromDb } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; step?: string; phone?: string; email?: string }>;
}) {
  const [currentUser, { next, error, step, phone, email }] = await Promise.all([getCurrentUser(), searchParams]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  const otpMode = isOtpMode();
  const emailMode = isEmailMode();
  const mockEmailMode = isMockEmailMode();
  const isVerifyStep = step === "verify";

  // Load users for the quick-switch panel in mock modes (phone or email)
  const users = (!otpMode && !emailMode && !mockEmailMode && !isVerifyStep) || (mockEmailMode && !isVerifyStep)
    ? await listUsersFromDb()
    : [];

  return (
    <AuthPage
      emailMode={emailMode}
      error={error}
      mockEmailMode={mockEmailMode}
      mode="login"
      next={next}
      otpEmail={email}
      otpMode={otpMode}
      otpPhone={phone}
      otpStep={isVerifyStep ? "verify" : "phone"}
      users={users}
    />
  );
}
