import { Button } from "@/components/ui/button";
import {
  requestMockOtpAction,
  requestOtpAction,
  signInAsUserAction,
  verifyMockOtpAction,
  verifyOtpAction,
} from "@/features/auth/session-actions";
import type { User } from "@/types/domain";

import styles from "./auth-page.module.css";

interface AuthPageProps {
  mode: "login" | "signup";
  next?: string;
  error?: string;
  users?: User[];
  otpMode?: boolean;
  otpStep?: "phone" | "verify";
  otpPhone?: string;
}

// --- Shared helpers ---

function getPhoneErrorCopy(error?: string, isMock?: boolean) {
  if (!error) return null;
  if (error === "otp-send-failed") return "We couldn't send a code to that number. Check the number and try again.";
  if (error === "phone-not-found" && isMock) return "That number isn't a test account. Try one of the numbers listed below.";
  return "Something went wrong. Try again.";
}

function getVerifyErrorCopy(error?: string) {
  if (!error) return null;
  if (error === "invalid-otp") return "That code is incorrect or has expired. Try again.";
  return "Something went wrong. Try again.";
}

// --- Phone step ---

function PhoneStep({
  next,
  error,
  action,
  users = [],
  isMock,
}: {
  next?: string;
  error?: string;
  action: (formData: FormData) => Promise<void>;
  users?: User[];
  isMock?: boolean;
}) {
  const errorMessage = getPhoneErrorCopy(error, isMock);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Sign in</div>
          <h1 className={styles.title}>Enter your phone number</h1>
          <div className={styles.body}>{"We'll send you a one-time code via SMS to sign in."}</div>
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={action} className={styles.form}>
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

        {isMock && users.length > 0 ? (
          <div className={styles.card}>
            <div className={styles.sectionTitle}>Dev shortcuts</div>
            <div className={styles.body}>
              Sign in as a test persona instantly, or use their number above and enter <strong>000000</strong>.
            </div>
            <div className={styles.quickList}>
              {users.map((user) => (
                <form action={signInAsUserAction} className={styles.quickRow} key={user.id}>
                  <div>
                    <div className={styles.quickTitle}>{user.fullName}</div>
                    {user.mockPersonaLabel ? <div className={styles.quickPersona}>{user.mockPersonaLabel}</div> : null}
                    <div className={styles.quickMeta}>
                      {user.phone ?? ""}
                      {user.roles.length > 0 ? ` · ${user.roles.join(", ")}` : ""}
                    </div>
                    {user.mockPersonaDescription ? (
                      <div className={styles.quickDescription}>{user.mockPersonaDescription}</div>
                    ) : null}
                  </div>
                  <input name="userId" type="hidden" value={user.id} />
                  <input name="next" type="hidden" value={next ?? ""} />
                  <Button type="submit" variant="secondary">
                    Sign in
                  </Button>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// --- Verify step ---

function VerifyStep({
  phone,
  next,
  error,
  action,
  isMock,
}: {
  phone: string;
  next?: string;
  error?: string;
  action: (formData: FormData) => Promise<void>;
  isMock?: boolean;
}) {
  const errorMessage = getVerifyErrorCopy(error);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Verify</div>
          <h1 className={styles.title}>Enter the code</h1>
          <div className={styles.body}>
            We sent a 6-digit code to <strong>{phone}</strong>.
          </div>
          {isMock ? (
            <div className={styles.devHint}>
              Dev mode — use code <strong>000000</strong>
            </div>
          ) : null}
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={action} className={styles.form}>
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
      </div>
    </div>
  );
}

// --- Main export ---

export function AuthPage({ mode, next, error, users = [], otpMode, otpStep, otpPhone }: AuthPageProps) {
  const isVerifyStep = otpStep === "verify" && !!otpPhone;

  if (otpMode) {
    // Real Supabase OTP
    if (isVerifyStep) {
      return <VerifyStep action={verifyOtpAction} error={error} next={next} phone={otpPhone!} />;
    }
    return <PhoneStep action={requestOtpAction} error={error} next={next} />;
  }

  // Mock two-step flow
  if (isVerifyStep) {
    return <VerifyStep action={verifyMockOtpAction} error={error} isMock next={next} phone={otpPhone!} />;
  }
  return <PhoneStep action={requestMockOtpAction} error={error} isMock next={next} users={users} />;
}
