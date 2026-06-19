import { redirect } from "next/navigation";

import { getCurrentUser, isEmailMode, isMockEmailMode, isOtpMode } from "@/lib/auth";
import { SignupPage } from "@/features/auth/auth-page";
import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function SignupPageRoute({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string;
    error?: string;
    step?: string;
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const [currentUser, { next, error, step, phone, email, firstName, lastName }] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  const isVerifyStep = step === "verify";

  return (
    <SignupPage
      email={email}
      emailMode={isEmailMode()}
      error={error}
      firstName={firstName}
      lastName={lastName}
      mockEmailMode={isMockEmailMode()}
      next={next}
      otpMode={isOtpMode()}
      phone={phone}
      step={isVerifyStep ? "verify" : "details"}
    />
  );
}
