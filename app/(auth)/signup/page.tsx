import { redirect } from "next/navigation";

import { getCurrentUser, isOtpMode } from "@/lib/auth";
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
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const [currentUser, { next, error, step, phone, firstName, lastName }] = await Promise.all([
    getCurrentUser(),
    searchParams,
  ]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  const isVerifyStep = step === "verify";

  return (
    <SignupPage
      error={error}
      firstName={firstName}
      lastName={lastName}
      next={next}
      otpMode={isOtpMode()}
      phone={phone}
      step={isVerifyStep ? "verify" : "details"}
    />
  );
}
