import { Button } from "@/components/ui/button";
import {
  requestOtpAction,
  signInAction,
  signInAsUserAction,
  signOutAction,
  signOutOtpAction,
  signUpAction,
  verifyOtpAction,
} from "@/features/auth/session-actions";
import type { User } from "@/types/domain";

import styles from "./auth-page.module.css";

interface AuthPageProps {
  mode: "login" | "signup";
  next?: string;
  initialEmail?: string;
  error?: string;
  users?: User[];
  // OTP-specific
  otpMode?: boolean;
  otpStep?: "phone" | "verify";
  otpPhone?: string;
}

// --- Mock auth UI (dev only) ---

function getCopy(mode: "login" | "signup") {
  if (mode === "signup") {
    return {
      eyebrow: "Auth",
      title: "Create account",
      body: "Start with a standard user account. You can browse, save properties, and later apply for agent, agency manager, or valuator access.",
      buttonLabel: "Create account",
    };
  }

  return {
    eyebrow: "Auth",
    title: "Sign in",
    body: "Use a mock account to test protected areas like saved properties, onboarding flows, portal access, and admin review.",
    buttonLabel: "Sign in",
  };
}

function getErrorCopy(mode: "login" | "signup", error?: string) {
  if (!error) return null;
  if (mode === "login" && error === "not-found") return "We could not find an account for that email.";
  if (mode === "signup" && error === "email-taken") return "That email already belongs to an account. Try signing in instead.";
  return "Something went wrong. Try again.";
}

function MockAuthPage({ mode, next, initialEmail, error, users = [] }: AuthPageProps) {
  const copy = getCopy(mode);
  const errorMessage = getErrorCopy(mode, error);
  const primaryAction = mode === "signup" ? signUpAction : signInAction;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>{copy.eyebrow}</div>
          <h1 className={styles.title}>{copy.title}</h1>
          <div className={styles.body}>{copy.body}</div>
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={primaryAction} className={styles.form}>
            {mode === "signup" ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="full-name">
                  Full name
                </label>
                <input className={styles.input} id="full-name" name="fullName" placeholder="Enter your full name" />
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Email
              </label>
              <input
                className={styles.input}
                defaultValue={initialEmail}
                id="email"
                name="email"
                placeholder="name@example.com"
                type="email"
              />
            </div>

            <input name="next" type="hidden" value={next ?? ""} />

            <div className={styles.actions}>
              <Button type="submit">{copy.buttonLabel}</Button>
            </div>
          </form>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionTitle}>Quick mock sign-in</div>
          <div className={styles.body}>
            These accounts are available locally so we can test different parts of the app without a real auth provider yet.
          </div>
          <div className={styles.quickList}>
            {users.map((user) => (
              <form action={signInAsUserAction} className={styles.quickRow} key={user.id}>
                <div>
                  <div className={styles.quickTitle}>{user.fullName}</div>
                  {user.mockPersonaLabel ? <div className={styles.quickPersona}>{user.mockPersonaLabel}</div> : null}
                  <div className={styles.quickMeta}>
                    {user.email ?? user.phone ?? ""}
                    {user.roles.length > 0 ? ` · ${user.roles.join(", ")}` : ""}
                  </div>
                  {user.mockPersonaDescription ? <div className={styles.quickDescription}>{user.mockPersonaDescription}</div> : null}
                </div>
                <input name="userId" type="hidden" value={user.id} />
                <input name="next" type="hidden" value={next ?? ""} />
                <Button type="submit" variant="secondary">
                  Use this account
                </Button>
              </form>
            ))}
          </div>
        </div>

        {mode === "login" ? (
          <div className={styles.inlineAction}>
            Need a fresh test account?{" "}
            <a className={styles.link} href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
              Create account
            </a>
          </div>
        ) : (
          <div className={styles.inlineAction}>
            Already have an account?{" "}
            <a className={styles.link} href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
              Sign in
            </a>
          </div>
        )}

        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            Clear current session
          </Button>
        </form>
      </div>
    </div>
  );
}

// --- OTP auth UI (production) ---

function getOtpErrorCopy(error?: string) {
  if (!error) return null;
  if (error === "otp-send-failed") return "We couldn't send a code to that number. Check the number and try again.";
  if (error === "invalid-otp") return "That code is incorrect or has expired. Try again.";
  return "Something went wrong. Try again.";
}

function OtpPhoneStep({ next, error }: { next?: string; error?: string }) {
  const errorMessage = getOtpErrorCopy(error);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Sign in</div>
          <h1 className={styles.title}>Enter your phone number</h1>
          <div className={styles.body}>
            {"We'll send you a one-time code via SMS to sign in."}
          </div>
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={requestOtpAction} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">
                Phone number
              </label>
              <input
                autoComplete="tel"
                className={styles.input}
                id="phone"
                name="phone"
                placeholder="+250 788 000 000"
                type="tel"
              />
            </div>

            <input name="next" type="hidden" value={next ?? ""} />

            <div className={styles.actions}>
              <Button type="submit">Send code</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function OtpVerifyStep({ phone, next, error }: { phone: string; next?: string; error?: string }) {
  const errorMessage = getOtpErrorCopy(error);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Verify</div>
          <h1 className={styles.title}>Enter the code</h1>
          <div className={styles.body}>
            We sent a 6-digit code to <strong>{phone}</strong>.
          </div>
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={verifyOtpAction} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="token">
                Code
              </label>
              <input
                autoComplete="one-time-code"
                className={styles.input}
                id="token"
                inputMode="numeric"
                maxLength={6}
                name="token"
                pattern="\d{6}"
                placeholder="000000"
              />
            </div>

            <input name="phone" type="hidden" value={phone} />
            <input name="next" type="hidden" value={next ?? ""} />

            <div className={styles.actions}>
              <Button type="submit">Verify</Button>
            </div>
          </form>
        </div>

        <div className={styles.inlineAction}>
          Wrong number?{" "}
          <a className={styles.link} href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
            Start over
          </a>
        </div>

        <form action={signOutOtpAction}>
          <Button type="submit" variant="ghost">
            Cancel
          </Button>
        </form>
      </div>
    </div>
  );
}

// --- Main export ---

export function AuthPage({ mode, next, initialEmail, error, users = [], otpMode, otpStep, otpPhone }: AuthPageProps) {
  if (otpMode) {
    if (otpStep === "verify" && otpPhone) {
      return <OtpVerifyStep error={error} next={next} phone={otpPhone} />;
    }
    return <OtpPhoneStep error={error} next={next} />;
  }

  return <MockAuthPage error={error} initialEmail={initialEmail} mode={mode} next={next} users={users} />;
}
