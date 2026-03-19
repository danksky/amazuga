"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { createUser, readUsers } from "@/lib/data-store";
import { routes } from "@/lib/routes";

function getRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    throw new Error(`Missing field: ${key}`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Empty field: ${key}`);
  }

  return trimmed;
}

function getNextDestination(formData: FormData, fallback: string) {
  const next = formData.get("next");
  return typeof next === "string" && next.trim() ? next.trim() : fallback;
}

export async function signInAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);
  const users = await readUsers();
  const matchingUser = users.find((user) => user.email === email);

  if (!matchingUser) {
    redirect(`${routes.auth.login}?error=not-found&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, matchingUser.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next);
}

export async function signUpAction(formData: FormData) {
  const fullName = getRequiredString(formData, "fullName");
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);
  const users = await readUsers();
  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    redirect(`${routes.auth.signup}?error=email-taken&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  const createdUser = await createUser({ email, fullName });
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, createdUser.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next);
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  redirect(routes.public.buy);
}

export async function signInAsUserAction(formData: FormData) {
  const userId = getRequiredString(formData, "userId");
  const next = getNextDestination(formData, routes.public.buy);
  const users = await readUsers();
  const matchingUser = users.find((user) => user.id === userId);

  if (!matchingUser) {
    redirect(routes.auth.login);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, matchingUser.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next);
}
