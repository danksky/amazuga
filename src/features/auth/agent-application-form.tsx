import Link from "next/link";

import { Button } from "@/components/ui/button";
import { agencies } from "@/lib/mock-data";
import { routes } from "@/lib/routes";

import styles from "./agent-application-form.module.css";

export function AgentApplicationForm() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Agent</div>
        <h1 className={styles.title}>Apply as an agent</h1>
        <div className={styles.body}>
          Submit your agent application to work with an approved agency. National ID photo is required before the
          application can be reviewed.
        </div>

        <form className={styles.form}>
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
            <input className={styles.input} id="phone-number" name="phoneNumber" placeholder="Enter your phone number" />
          </div>

          <div className={styles.field}>
            <div className={styles.label}>Which agency do you belong to?</div>
            <div className={styles.hint}>
              Select the approved agency you intend to join. If you are applying first and want to choose later, you can
              leave this open for now.
            </div>
            <div className={styles.optionList}>
              {agencies
                .filter((agency) => agency.status === "approved")
                .map((agency) => (
                  <label className={styles.option} key={agency.id}>
                    <input name="agencyId" type="radio" value={agency.id} />
                    <div>
                      <div className={styles.optionTitle}>{agency.businessName}</div>
                      <div className={styles.optionBody}>Approved agency</div>
                    </div>
                  </label>
                ))}
              <label className={styles.option}>
                <input name="agencyId" type="radio" value="" />
                <div>
                  <div className={styles.optionTitle}>I will choose an agency later</div>
                  <div className={styles.optionBody}>Continue with agent approval first.</div>
                </div>
              </label>
            </div>
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
            <Button type="button">Submit application</Button>
            <Link href={routes.onboarding.agent}>
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
