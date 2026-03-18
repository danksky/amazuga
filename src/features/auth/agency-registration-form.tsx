import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import styles from "./agency-registration-form.module.css";

export function AgencyRegistrationForm() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>Agency</div>
        <h1 className={styles.title}>Register your agency</h1>
        <div className={styles.body}>
          Submit your agency for approval. Provide the business name and TIN, and optionally include a website or Google
          Maps listing.
        </div>

        <form className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="business-name">
              Business name
            </label>
            <input className={styles.input} id="business-name" name="businessName" placeholder="Example: Kigali Homes Group" />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tin">
              TIN
            </label>
            <input className={styles.input} id="tin" name="tin" placeholder="Enter tax identification number" />
            <div className={styles.hint}>This is required to submit the agency for admin review.</div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="website">
              Website <span className={styles.optional}>(optional)</span>
            </label>
            <input className={styles.input} id="website" name="website" placeholder="https://example.com" />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="maps">
              Google Maps listing <span className={styles.optional}>(optional)</span>
            </label>
            <input className={styles.input} id="maps" name="googleMapsListing" placeholder="Paste Google Maps listing URL" />
          </div>

          <div className={styles.actions}>
            <Button type="button">Submit agency</Button>
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
