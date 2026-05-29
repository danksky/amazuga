import { redirect } from "next/navigation";

import { getCurrentUser, isOtpMode } from "@/lib/auth";
import { AuthPage } from "@/features/auth/auth-page";
import { routes } from "@/lib/routes";
import { listUsersFromDb } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; error?: string; step?: string; phone?: string }>;
}) {
  const [currentUser, { next, email, error, step, phone }] = await Promise.all([getCurrentUser(), searchParams]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  const otpMode = isOtpMode();

  if (otpMode) {
    return (
      <AuthPage
        error={error}
        mode="login"
        next={next}
        otpMode
        otpPhone={phone}
        otpStep={step === "verify" ? "verify" : "phone"}
      />
    );
  }

  const users = await listUsersFromDb();

  return <AuthPage error={error} initialEmail={email} mode="login" next={next} users={users} />;
}
