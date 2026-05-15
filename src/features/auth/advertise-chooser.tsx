import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { listAgencyApplicationsFromDb } from "@/lib/server/workflows";
import type { AgencyApplication } from "@/types/domain";

import styles from "./advertise-chooser.module.css";

function getAgencyStatusCopy(application: AgencyApplication) {
  if (application.status === "approved") {
    return {
      pill: "Agency registration approved",
      body: "Your agency registration has been approved. You can continue into the portal to manage the agency.",
      href: routes.app.portal,
      cta: "Go to portal",
    };
  }

  if (application.status === "denied") {
    return {
      pill: "Agency registration denied",
      body: "Your last agency registration was denied. You can review the submission status or start a new registration.",
      href: routes.onboarding.agencyRegistration(application.id),
      cta: "View submission status",
    };
  }

  return {
    pill: "Agency registration under review",
    body: "Your agency registration has already been submitted and is currently under review.",
    href: routes.onboarding.agencyRegistration(application.id),
    cta: "View submission status",
  };
}

export async function AdvertiseChooser({ userId }: { userId: string }) {
  const agencyApplications = await listAgencyApplicationsFromDb();
  const agencyApplication = [...agencyApplications]
    .reverse()
    .find((application) => application.createdByUserId === userId);
  const agencyStatusCopy = agencyApplication ? getAgencyStatusCopy(agencyApplication) : null;

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
              <Link href={routes.onboarding.agentApplicationNew}>
                <Button>Continue as agent</Button>
              </Link>
            </div>
          </div>

          {agencyApplication ? (
            <div className={styles.choice}>
              <div className={styles.statusPill}>{agencyStatusCopy?.pill}</div>
              <div className={styles.choiceTitle}>{agencyApplication.businessName}</div>
              <div className={styles.choiceBody}>{agencyStatusCopy?.body}</div>
              <div className={styles.actions}>
                <Link href={agencyStatusCopy?.href ?? routes.onboarding.agencyRegistration(agencyApplication.id)}>
                  <Button>{agencyStatusCopy?.cta ?? "View submission status"}</Button>
                </Link>
                {agencyApplication.status === "denied" ? (
                  <Link href={routes.onboarding.agencyRegistrationNew}>
                    <Button variant="secondary">Register again</Button>
                  </Link>
                ) : null}
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
                <Link href={routes.onboarding.agencyRegistrationNew}>
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
