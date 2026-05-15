import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { AuthPage } from "@/features/auth/auth-page";
import { routes } from "@/lib/routes";
import { listUsersFromDb } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; email?: string; error?: string }>;
}) {
  const [currentUser, { next, email, error }, users] = await Promise.all([getCurrentUser(), searchParams, listUsersFromDb()]);

  if (currentUser) {
    redirect(next ?? routes.public.buy);
  }

  return <AuthPage error={error} initialEmail={email} mode="signup" next={next} users={users} />;
}
