"use client";

import { useActionState } from "react";
import Link from "next/link";

import { routes } from "@/lib/routes";

import { submitOwnershipContestAction, type SubmitContestResult } from "./actions";
import styles from "./contest-form.module.css";

export function ContestForm({
  claimedPropertyId,
  claimedPropertyAssetId,
  upi,
}: {
  claimedPropertyId: string;
  claimedPropertyAssetId: string;
  upi: string;
}) {
  const [result, submitAction, isPending] = useActionState<SubmitContestResult | null, FormData>(
    submitOwnershipContestAction,
    null,
  );

  if (result?.type === "success") {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.card}>
          <div className={styles.eyebrow}>Ownership dispute</div>
          <h1 className={styles.title}>Dispute submitted</h1>
          <p className={styles.body}>
            Your dispute for property <strong>{claimedPropertyId}</strong> has been received. Our team will
            review it and follow up with you. This process is manual — expect a response within a few business
            days.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href={routes.app.portalProperties}>
              Back to my portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Ownership dispute</div>
        <h1 className={styles.title}>Contest this claim</h1>
        <p className={styles.body}>
          Property <strong>{claimedPropertyId}</strong> is currently registered to another user. If you
          believe this property is yours, explain your claim below. An admin will review both sides and follow
          up with you.
        </p>

        <div className={styles.warningBox}>
          <strong>Before submitting</strong> — make sure you have your land title documents ready. Admin may
          request them during the review process.
        </div>

        <form action={submitAction} className={styles.form}>
          <input name="upi" type="hidden" value={upi} />
          <input name="claimedPropertyAssetId" type="hidden" value={claimedPropertyAssetId} />
          <input name="claimedPropertyId" type="hidden" value={claimedPropertyId} />

          <div className={styles.field}>
            <label className={styles.label} htmlFor="contest-note">
              Why do you believe you own this property?
            </label>
            <textarea
              className={styles.textarea}
              id="contest-note"
              minLength={10}
              name="note"
              placeholder="Describe your relationship to the property, when you acquired it, and any other relevant context..."
              required
              rows={6}
            />
            <span className={styles.hint}>Minimum 10 characters. Be as specific as possible.</span>
          </div>

          {result?.type === "error" && (
            <div className={styles.alertWarn}>{result.message}</div>
          )}

          <div className={styles.actions}>
            <button className={styles.primaryAction} disabled={isPending} type="submit">
              {isPending ? "Submitting…" : "Submit dispute"}
            </button>
            <Link className={styles.secondaryAction} href={routes.app.portalProperties}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
