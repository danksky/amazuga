"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { submitAgentApplicationAction } from "@/features/auth/actions";
import { AgencyPicker } from "@/features/auth/agency-picker";
import { IdPhotoUploader } from "@/features/auth/id-photo-uploader";
import { routes } from "@/lib/routes";
import type { Agency } from "@/types/domain";

import styles from "./agent-application-form.module.css";

export function AgentApplicationForm({ agencies }: { agencies: Agency[] }) {
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [agencyId, setAgencyId] = useState("");
  const [photoKey, setPhotoKey] = useState("");

  const agencyMissing = submitAttempted && !agencyId;
  const photoMissing = submitAttempted && !photoKey;

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
            <div className={styles.label}>Which agency do you belong to?</div>
            <div className={styles.hint}>
              Select the approved agency you intend to join. Agency selection is required for agent review.
            </div>
            <div className={agencyMissing ? styles.fieldError : undefined}>
              <AgencyPicker agencies={agencies} onChange={setAgencyId} />
            </div>
            {agencyMissing ? <div className={styles.errorMessage}>Please select an agency.</div> : null}
            <div className={styles.hint}>
              Don&apos;t see your agency?{" "}
              <Link className={styles.inlineLink} href={routes.onboarding.agencyRegistrationNew}>
                Register one
              </Link>
              .
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.label}>National ID photo</div>
            <IdPhotoUploader onChange={setPhotoKey} />
            {photoMissing ? <div className={styles.errorMessage}>Please upload your National ID photo.</div> : null}
          </div>

          <div className={styles.actions}>
            <Button
              onClick={(e) => {
                if (!agencyId || !photoKey) {
                  e.preventDefault();
                  setSubmitAttempted(true);
                }
              }}
              type="submit"
            >
              Submit application
            </Button>
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
