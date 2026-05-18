import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import styles from "./sell-entry-page.module.css";

export function PrivateSalePage({ isSignedIn }: { isSignedIn: boolean }) {
  const nextHref = isSignedIn
    ? routes.app.portalProperties
    : `${routes.auth.signup}?next=${encodeURIComponent(routes.app.portalProperties)}`;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Private Sale</div>
        <h1 className={styles.title}>Owner-led selling starts with property claim</h1>
        <div className={styles.body}>
          The private-sale path now starts inside the properties workspace. Sign in, enter the parcel UPI, and submit
          a claim so Amazuga can verify that the property belongs to you before owner-led listing tools expand further.
        </div>
        <div className={styles.cardActions}>
          <Link href={nextHref}>
            <Button>{isSignedIn ? "Open properties workspace" : "Create account"}</Button>
          </Link>
          <Link href={routes.public.sell}>
            <Button type="button" variant="secondary">
              Back to sell options
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
