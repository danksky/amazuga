import Link from "next/link";

import { Button } from "@/components/ui/button";
import { submitAgentApplicationAction } from "@/features/auth/actions";
import { AgencyPicker } from "@/features/auth/agency-picker";
import { routes } from "@/lib/routes";
import type { Agency } from "@/types/domain";

import styles from "./agent-application-form.module.css";

export function AgentApplicationForm({ agencies }: { agencies: Agency[] }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Agent</div>
        <h1 className={styles.title}>Apply as an agent</h1>
        <div className={styles.body}>
          Submit your agent application to work with an approved agency. National ID photo is required before the
          application can be reviewed.
        </div>

        <form action={submitAgentApplicationAction} className={styles.form}>
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
            <div className={styles.label}>Which agency do you belong to?</div>
            <div className={styles.hint}>
              Select the approved agency you intend to join. Agency selection is required for agent review.
            </div>
            <AgencyPicker agencies={agencies} />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>National ID photo</div>
            <div className={styles.uploadBox}>
              <div className={styles.uploadTitle}>Upload required document</div>
              <div className={styles.uploadBody}>
                Add a clear photo of your National ID. This is required for admin review and agent approval.
              </div>
              <Button type="button" variant="secondary">
                Upload ID photo
              </Button>
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="submit">Submit application</Button>
            <Link href={routes.onboarding.advertise}>
              <Button type="button" variant="secondary">
                Back to applications
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
