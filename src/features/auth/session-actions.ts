"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPhoneUserInDb, createUserInDb, getUserByEmailFromDb, getUserByIdFromDb, getUserByPhoneFromDb, upsertEmailUserInDb, upsertOtpUserInDb } from "@/lib/server/users";


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
  const matchingUser = await getUserByEmailFromDb(email);

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
  const existingUser = await getUserByEmailFromDb(email);

  if (existingUser) {
    redirect(`${routes.auth.signup}?error=email-taken&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  const createdUser = await createUserInDb({ email, fullName });

  if (!createdUser) {
    throw new Error("Failed to create user");
  }

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
  const matchingUser = await getUserByIdFromDb(userId);

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

// --- Mock OTP actions (used when AUTH_MODE=mock) ---
// Simulates the two-step phone OTP flow without hitting Supabase or sending SMS.
// Any test number accepts code 000000.

export async function requestMockOtpAction(formData: FormData) {
  const rawPhone = getRequiredString(formData, "phone");
  const next = getNextDestination(formData, routes.public.buy);
  const phone = normalizeRwandaPhone(rawPhone);

  const user = await getUserByPhoneFromDb(phone);
  if (!user) {
    redirect(`${routes.auth.login}?error=phone-not-found&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
  }

  redirect(`${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
}

export async function verifyMockOtpAction(formData: FormData) {
  const phone = getRequiredString(formData, "phone");
  const token = getRequiredString(formData, "token");
  const next = getNextDestination(formData, routes.public.buy);

  if (token !== "000000") {
    redirect(
      `${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&error=invalid-otp&next=${encodeURIComponent(next)}`,
    );
  }

  const user = await getUserByPhoneFromDb(phone);
  if (!user) {
    redirect(routes.auth.login);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(next);
}

// --- OTP actions (used when AUTH_MODE=otp) ---

function normalizeRwandaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("250")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+250${digits.slice(1)}`;
  if (digits.length === 9) return `+250${digits}`;
  return `+${digits}`;
}

export async function requestOtpAction(formData: FormData) {
  const rawPhone = getRequiredString(formData, "phone");
  const next = getNextDestination(formData, routes.public.buy);
  const phone = normalizeRwandaPhone(rawPhone);

  const existingUser = await getUserByPhoneFromDb(phone);
  if (!existingUser) {
    redirect(`${routes.auth.signup}?phone=${encodeURIComponent(phone)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    redirect(
      `${routes.auth.login}?error=otp-send-failed&next=${encodeURIComponent(next)}`,
    );
  }

  redirect(
    `${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`,
  );
}

export async function verifyOtpAction(formData: FormData) {
  const phone = getRequiredString(formData, "phone");
  const token = getRequiredString(formData, "token");
  const next = getNextDestination(formData, routes.public.buy);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });

  if (error || !data.user) {
    redirect(
      `${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&error=invalid-otp&next=${encodeURIComponent(next)}`,
    );
  }

  // Ensure the user exists in our app_user table
  await upsertOtpUserInDb({ supabaseAuthId: data.user.id, phone: data.user.phone ?? phone });

  redirect(next);
}

// --- Sign-up actions (OTP mode) ---

export async function requestSignUpOtpAction(formData: FormData) {
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const rawPhone = getRequiredString(formData, "phone");
  const next = getNextDestination(formData, routes.public.buy);
  const phone = normalizeRwandaPhone(rawPhone);

  const existing = await getUserByPhoneFromDb(phone);
  const supabase = await createSupabaseServerClient();

  if (existing) {
    // Account already exists — send an OTP and drop them into the sign-in verify step.
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      console.error("[requestSignUpOtpAction] signInWithOtp error (existing user):", error.status, error.message, error.code);
      redirect(`${routes.auth.login}?error=otp-send-failed&next=${encodeURIComponent(next)}`);
    }
    redirect(`${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    console.error("[requestSignUpOtpAction] signInWithOtp error:", error.status, error.message, error.code);
    redirect(`${routes.auth.signup}?error=otp-send-failed&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `${routes.auth.signup}?step=verify&phone=${encodeURIComponent(phone)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&next=${encodeURIComponent(next)}`,
  );
}

export async function verifySignUpOtpAction(formData: FormData) {
  const phone = getRequiredString(formData, "phone");
  const token = getRequiredString(formData, "token");
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const next = getNextDestination(formData, routes.public.buy);
  const fullName = `${firstName} ${lastName}`.trim();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });

  if (error || !data.user) {
    console.error("[verifySignUpOtpAction] verifyOtp failed:", error?.status, error?.message, error?.code, "phone:", phone);
    redirect(
      `${routes.auth.signup}?step=verify&phone=${encodeURIComponent(phone)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&error=invalid-otp&next=${encodeURIComponent(next)}`,
    );
  }

  await upsertOtpUserInDb({ supabaseAuthId: data.user.id, phone: data.user.phone ?? phone, fullName });

  redirect(next);
}

// --- Sign-up actions (mock mode) ---

export async function requestMockSignUpOtpAction(formData: FormData) {
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const rawPhone = getRequiredString(formData, "phone");
  const next = getNextDestination(formData, routes.public.buy);
  const phone = normalizeRwandaPhone(rawPhone);

  const existing = await getUserByPhoneFromDb(phone);
  if (existing) {
    redirect(`${routes.auth.login}?step=verify&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `${routes.auth.signup}?step=verify&phone=${encodeURIComponent(phone)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&next=${encodeURIComponent(next)}`,
  );
}

export async function verifyMockSignUpOtpAction(formData: FormData) {
  const phone = getRequiredString(formData, "phone");
  const token = getRequiredString(formData, "token");
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const next = getNextDestination(formData, routes.public.buy);
  const fullName = `${firstName} ${lastName}`.trim();

  if (token !== "000000") {
    redirect(
      `${routes.auth.signup}?step=verify&phone=${encodeURIComponent(phone)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&error=invalid-otp&next=${encodeURIComponent(next)}`,
    );
  }

  const existing = await getUserByPhoneFromDb(phone);
  if (existing) {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, existing.id, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(next);
  }

  const newUser = await createPhoneUserInDb({ phone, fullName });
  if (!newUser) throw new Error("Failed to create user");

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, newUser.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next);
}

// --- Mock email actions (used when AUTH_MODE=mock-email) ---
// Any email accepts code 000000. Mirrors the mock phone flow.

export async function requestMockEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);

  const user = await getUserByEmailFromDb(email);
  if (!user) {
    redirect(`${routes.auth.login}?error=email-not-found&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export async function verifyMockEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const token = getRequiredString(formData, "token");
  const next = getNextDestination(formData, routes.public.buy);

  if (token !== "000000") {
    redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&error=invalid-otp&next=${encodeURIComponent(next)}`);
  }

  const user = await getUserByEmailFromDb(email);
  if (!user) {
    redirect(routes.auth.login);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next);
}

export async function requestMockSignUpEmailOtpAction(formData: FormData) {
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);

  const existing = await getUserByEmailFromDb(email);
  if (existing) {
    redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `${routes.auth.signup}?step=verify&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&next=${encodeURIComponent(next)}`,
  );
}

export async function verifyMockSignUpEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const token = getRequiredString(formData, "token");
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const next = getNextDestination(formData, routes.public.buy);
  const fullName = `${firstName} ${lastName}`.trim();

  if (token !== "000000") {
    redirect(`${routes.auth.signup}?step=verify&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&error=invalid-otp&next=${encodeURIComponent(next)}`);
  }

  const existing = await getUserByEmailFromDb(email);
  if (existing) {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, existing.id, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect(next);
  }

  const newUser = await createUserInDb({ email, fullName });
  if (!newUser) throw new Error("Failed to create user");

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, newUser.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next);
}

// --- Email OTP actions (used when AUTH_MODE=email) ---

export async function requestEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);

  const existingUser = await getUserByEmailFromDb(email);
  if (!existingUser) {
    redirect(`${routes.auth.signup}?email=${encodeURIComponent(email)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    console.error("[requestEmailOtpAction] signInWithOtp error:", error.status, error.message, error.code);
    redirect(`${routes.auth.login}?error=otp-send-failed&next=${encodeURIComponent(next)}`);
  }

  redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
}

export async function verifyEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const token = getRequiredString(formData, "token");
  const next = getNextDestination(formData, routes.public.buy);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) {
    console.error("[verifyEmailOtpAction] verifyOtp failed:", error.status, error.message, error.code, "email:", email);
    redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&error=invalid-otp&next=${encodeURIComponent(next)}`);
  }

  const user = await getUserByEmailFromDb(email);
  if (!user) {
    redirect(`${routes.auth.signup}?email=${encodeURIComponent(email)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next);
}

export async function requestSignUpEmailOtpAction(formData: FormData) {
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const email = getRequiredString(formData, "email").toLowerCase();
  const next = getNextDestination(formData, routes.public.buy);

  const existing = await getUserByEmailFromDb(email);
  const supabase = await createSupabaseServerClient();

  if (existing) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      console.error("[requestSignUpEmailOtpAction] signInWithOtp error (existing user):", error.status, error.message, error.code);
      redirect(`${routes.auth.login}?error=otp-send-failed&next=${encodeURIComponent(next)}`);
    }
    redirect(`${routes.auth.login}?step=verify&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) {
    console.error("[requestSignUpEmailOtpAction] signInWithOtp error:", error.status, error.message, error.code);
    redirect(`${routes.auth.signup}?error=otp-send-failed&next=${encodeURIComponent(next)}`);
  }

  redirect(
    `${routes.auth.signup}?step=verify&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&next=${encodeURIComponent(next)}`,
  );
}

export async function verifySignUpEmailOtpAction(formData: FormData) {
  const email = getRequiredString(formData, "email").toLowerCase();
  const token = getRequiredString(formData, "token");
  const firstName = getRequiredString(formData, "firstName");
  const lastName = getRequiredString(formData, "lastName");
  const next = getNextDestination(formData, routes.public.buy);
  const fullName = `${firstName} ${lastName}`.trim();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user) {
    console.error("[verifySignUpEmailOtpAction] verifyOtp failed:", error?.status, error?.message, error?.code, "email:", email);
    redirect(
      `${routes.auth.signup}?step=verify&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}&error=invalid-otp&next=${encodeURIComponent(next)}`,
    );
  }

  const user = await upsertEmailUserInDb({ supabaseAuthId: data.user.id, email, fullName });
  if (!user) throw new Error("Failed to upsert user after email OTP verification");

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(next);
}

export async function signOutOtpAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(routes.auth.login);
}
