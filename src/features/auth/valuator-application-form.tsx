import Link from "next/link";

import { Button } from "@/components/ui/button";
import { submitValuatorApplicationAction } from "@/features/auth/actions";
import { routes } from "@/lib/routes";

import styles from "./valuator-application-form.module.css";

export function ValuatorApplicationForm() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Assess</div>
        <h1 className={styles.title}>Apply as a recognized valuator</h1>
        <div className={styles.body}>
          Submit your valuator application to be recognized for valuation submissions. IRPV registration number is required
          before the application can be reviewed.
        </div>

        <form action={submitValuatorApplicationAction} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="full-name">
              Full name
            </label>
            <input className={styles.input} id="full-name" name="fullName" placeholder="Enter your full name" />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="phone-number">
              Phone number
            </label>
            <div className={styles.phoneField}>
              <div className={styles.phonePrefix}>+250</div>
              <input className={styles.input} id="phone-number" name="phoneNumber" placeholder="7XXXXXXXX" />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="irpv-number">
              IRPV registration number
            </label>
            <input className={styles.input} id="irpv-number" name="irpvRegistrationNumber" placeholder="Enter registration number" />
            <div className={styles.hint}>
              This number is used to review and recognize valuators before they can submit valuations.
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="submit">Submit application</Button>
            <Link href={routes.onboarding.assess}>
              <Button type="button" variant="secondary">
                Back
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
