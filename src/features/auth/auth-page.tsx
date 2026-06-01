import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/features/auth/phone-input";
import {
  requestMockOtpAction,
  requestMockSignUpOtpAction,
  requestOtpAction,
  requestSignUpOtpAction,
  signInAsUserAction,
  verifyMockOtpAction,
  verifyMockSignUpOtpAction,
  verifyOtpAction,
  verifySignUpOtpAction,
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
  if (error === "otp-send-failed") return "Something went wrong sending your code. Please try again.";
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
  phone,
  action,
  users = [],
  isMock,
}: {
  next?: string;
  error?: string;
  phone?: string;
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
              <PhoneInput initialValue={phone} />
            </div>
            <input name="next" type="hidden" value={next ?? ""} />
            <div className={styles.actions}>
              <Button type="submit">Send code</Button>
            </div>
          </form>
        </div>

        <div className={styles.inlineAction}>
          {"Don't have an account? "}
          <a className={styles.link} href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
            Sign up
          </a>
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

// --- Sign-up steps ---

function SignupDetailsStep({
  next,
  error,
  action,
  isMock,
  phone,
}: {
  next?: string;
  error?: string;
  action: (formData: FormData) => Promise<void>;
  isMock?: boolean;
  phone?: string;
}) {
  const phoneExistsError = error === "phone-exists";
  const errorMessage = phoneExistsError
    ? null
    : error === "otp-send-failed"
      ? "Something went wrong sending your code. Please try again."
      : error
        ? "Something went wrong. Try again."
        : null;

  const loginHref = phone
    ? `${next ? `/login?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}` : `/login?phone=${encodeURIComponent(phone)}`}`
    : next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Create account</div>
          <h1 className={styles.title}>Sign up</h1>
          <div className={styles.body}>{"We'll send a one-time code to verify your number."}</div>
          {phoneExistsError ? (
            <div className={styles.phoneExistsNotice}>
              <span>An account already exists for this number.</span>
              <a className={styles.phoneExistsLink} href={loginHref}>Sign in instead</a>
            </div>
          ) : null}
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}
          {isMock ? <div className={styles.devHint}>Dev mode — use code <strong>000000</strong> on the next step</div> : null}

          <form action={action} className={styles.form}>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="firstName">First name</label>
                <input autoComplete="given-name" className={styles.input} id="firstName" name="firstName" placeholder="Amara" type="text" />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="lastName">Last name</label>
                <input autoComplete="family-name" className={styles.input} id="lastName" name="lastName" placeholder="Ndiaye" type="text" />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="phone">Phone number</label>
              <PhoneInput initialValue={phone} />
            </div>
            <input name="next" type="hidden" value={next ?? ""} />
            <div className={styles.actions}>
              <Button type="submit">Send code</Button>
            </div>
          </form>
        </div>

        <div className={styles.inlineAction}>
          Already have an account?{" "}
          <a className={styles.link} href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
}

function SignupVerifyStep({
  phone,
  firstName,
  lastName,
  next,
  error,
  action,
  isMock,
}: {
  phone: string;
  firstName: string;
  lastName: string;
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
          {isMock ? <div className={styles.devHint}>Dev mode — use code <strong>000000</strong></div> : null}
          {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}

          <form action={action} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="token">Code</label>
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
            <input name="firstName" type="hidden" value={firstName} />
            <input name="lastName" type="hidden" value={lastName} />
            <input name="next" type="hidden" value={next ?? ""} />
            <div className={styles.actions}>
              <Button type="submit">Verify</Button>
            </div>
          </form>
        </div>

        <div className={styles.inlineAction}>
          Wrong number?{" "}
          <a className={styles.link} href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>
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
    return <PhoneStep action={requestOtpAction} error={error} next={next} phone={otpPhone} />;
  }

  // Mock two-step flow
  if (isVerifyStep) {
    return <VerifyStep action={verifyMockOtpAction} error={error} isMock next={next} phone={otpPhone!} />;
  }
  return <PhoneStep action={requestMockOtpAction} error={error} isMock next={next} phone={otpPhone} users={users} />;
}

interface SignupPageProps {
  next?: string;
  error?: string;
  otpMode?: boolean;
  step?: "details" | "verify";
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export function SignupPage({ next, error, otpMode, step, phone, firstName, lastName }: SignupPageProps) {
  const isVerifyStep = step === "verify" && !!phone && !!firstName && !!lastName;

  if (isVerifyStep) {
    return (
      <SignupVerifyStep
        action={otpMode ? verifySignUpOtpAction : verifyMockSignUpOtpAction}
        error={error}
        firstName={firstName!}
        isMock={!otpMode}
        lastName={lastName!}
        next={next}
        phone={phone!}
      />
    );
  }

  return (
    <SignupDetailsStep
      action={otpMode ? requestSignUpOtpAction : requestMockSignUpOtpAction}
      error={error}
      isMock={!otpMode}
      next={next}
      phone={phone}
    />
  );
}
