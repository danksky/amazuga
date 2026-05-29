import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { routes } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserByIdFromDb, getUserBySupabaseAuthIdFromDb } from "@/lib/server/users";
import type { User } from "@/types/domain";

export const AUTH_COOKIE_NAME = "amazuga_mock_auth";
const ADMIN_EMAIL = "daniel.kawalsky@gmail.com";

export const isOtpMode = () => process.env.AUTH_MODE === "otp";

export const getCurrentUser = cache(async () => {
  if (isOtpMode()) {
    return getCurrentUserOtp();
  }
  return getCurrentUserMock();
});

async function getCurrentUserMock() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!userId) return null;

  try {
    return await getUserByIdFromDb(userId);
  } catch {
    return null;
  }
}

async function getCurrentUserOtp() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return await getUserBySupabaseAuthIdFromDb(user.id);
  } catch {
    return null;
  }
}

export function isAdminUser(user: User | null | undefined) {
  return !!user?.email && user.email === ADMIN_EMAIL;
}

export async function requireCurrentUser(next?: string) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    const destination = next ? `${routes.auth.login}?next=${encodeURIComponent(next)}` : routes.auth.login;
    redirect(destination);
  }

  return currentUser;
}

export async function requireAdminUser(next?: string) {
  const currentUser = await requireCurrentUser(next);

  if (!isAdminUser(currentUser)) {
    redirect(routes.public.buy);
  }

  return currentUser;
}
