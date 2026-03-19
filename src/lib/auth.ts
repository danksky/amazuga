import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { readUsers } from "@/lib/data-store";
import { routes } from "@/lib/routes";
import type { User } from "@/types/domain";

export const AUTH_COOKIE_NAME = "amazuga_mock_auth";
const ADMIN_EMAIL = "daniel.kawalsky@gmail.com";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!userId) {
    return null;
  }

  const users = await readUsers();
  return users.find((user) => user.id === userId) ?? null;
});

export function isAdminUser(user: User | null | undefined) {
  return user?.email === ADMIN_EMAIL;
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
