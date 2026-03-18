import Link from "next/link";

import { Button } from "@/components/ui/button";
import { currentUser, getAgencyApplicationByUserId } from "@/lib/mock-data";
import { routes } from "@/lib/routes";

import styles from "./advertise-chooser.module.css";

export function AdvertiseChooser() {
  const agencyApplication = getAgencyApplicationByUserId(currentUser.id);

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Advertise</div>
        <h1 className={styles.title}>How are you advertising?</h1>
        <div className={styles.body}>
          Choose the path that matches your situation. If you already work with an approved agency, continue through the
          agent flow. If you want to submit a new agency for approval, continue through agency registration.
        </div>

        <div className={styles.choices}>
          <div className={styles.choice}>
            <div className={styles.choiceTitle}>I belong to an agency</div>
            <div className={styles.choiceBody}>
              Continue into agent onboarding. This path is for people who need approval as an agent before joining or
              switching to an agency.
            </div>
            <div className={styles.actions}>
              <Link href={routes.onboarding.agentStatus}>
                <Button>Continue as agent</Button>
              </Link>
            </div>
          </div>

          {agencyApplication ? (
            <div className={styles.choice}>
              <div className={styles.statusPill}>Agency registration under review</div>
              <div className={styles.choiceTitle}>{agencyApplication.businessName}</div>
              <div className={styles.choiceBody}>
                Your agency registration has already been submitted and is currently under review.
              </div>
              <div className={styles.actions}>
                <Link href={routes.onboarding.agencyStatus}>
                  <Button>View submission status</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className={styles.choice}>
              <div className={styles.choiceTitle}>I want to register my agency</div>
              <div className={styles.choiceBody}>
                Continue into agency registration. This path is for people submitting a new agency with a business name and
                TIN for admin approval.
              </div>
              <div className={styles.actions}>
                <Link href={routes.onboarding.agency}>
                  <Button>Register agency</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions} style={{ marginTop: 24 }}>
          <Link className={styles.secondaryAction} href={routes.app.portal}>
            Already approved? Go to portal
          </Link>
        </div>
      </div>
    </div>
  );
}
