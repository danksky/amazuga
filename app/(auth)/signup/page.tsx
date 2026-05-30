import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export const dynamic = "force-dynamic";

// Signup as a separate flow no longer exists — phone OTP creates accounts on
// first sign-in. Redirect to login so old links don't 404.
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = next ? `${routes.auth.login}?next=${encodeURIComponent(next)}` : routes.auth.login;
  redirect(destination);
}
