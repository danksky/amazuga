import Link from "next/link";

import { routes } from "@/lib/routes";

import styles from "./new-listing-fork-page.module.css";

export function NewListingForkPage() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>New listing</div>
        <h1 className={styles.title}>How would you like to add your property?</h1>
        <p className={styles.body}>
          If you have the official land-title UPI for this property, use it — we can pull the parcel record and
          register your ownership automatically. If not, you can still list without one.
        </p>

        <div className={styles.forkGrid}>
          <Link className={styles.option} href={routes.app.portalPropertyNewUpi}>
            <div className={styles.optionIcon} aria-hidden="true">
              <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="28">
                <rect height="16" rx="2" ry="2" width="16" x="4" y="4" />
                <line x1="4" x2="20" y1="9" y2="9" />
                <line x1="9" x2="9" y1="9" y2="20" />
              </svg>
            </div>
            <div className={styles.optionContent}>
              <div className={styles.optionTitle}>I have a UPI</div>
              <div className={styles.optionBody}>
                Use the official land-title identifier to claim the parcel, confirm the property details, and
                publish your listing — all in one flow.
              </div>
            </div>
            <div className={styles.optionArrow} aria-hidden="true">→</div>
          </Link>

          <Link className={styles.option} href={routes.app.portalPropertyNewDirect}>
            <div className={styles.optionIcon} aria-hidden="true">
              <svg fill="none" height="28" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="28">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className={styles.optionContent}>
              <div className={styles.optionTitle}>I don&rsquo;t have a UPI</div>
              <div className={styles.optionBody}>
                List your property without a land-title reference. Your precise location will not be shown
                publicly — only the village or sector.
              </div>
            </div>
            <div className={styles.optionArrow} aria-hidden="true">→</div>
          </Link>
        </div>

        <div className={styles.backRow}>
          <Link className={styles.backLink} href={routes.app.portalProperties}>
            ← Back to portfolio
          </Link>
        </div>
      </div>
    </div>
  );
}
