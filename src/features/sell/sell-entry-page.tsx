import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import styles from "./sell-entry-page.module.css";

export function SellEntryPage({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const privateSaleHref = isSignedIn
    ? routes.app.portalProperties
    : `${routes.auth.signup}?next=${encodeURIComponent(routes.app.portalProperties)}`;
  const agentHref = isSignedIn
    ? routes.onboarding.agentApplicationChoosePath
    : `${routes.auth.signup}?next=${encodeURIComponent(routes.onboarding.agentApplicationChoosePath)}`;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Sell</div>
        <h1 className={styles.title}>Choose how you want to sell</h1>
        <div className={styles.body}>
          Amazuga can route you toward agency representation or a future private-sale path. If you are already approved
          as an agent or valuator, this entry point will redirect you into the right sell workspace automatically.
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardLabel}>Owner route</div>
          <h2 className={styles.cardTitle}>List privately</h2>
          <div className={styles.cardBody}>
            List your own property for sale or rent. If you have a UPI, submit a claim to verify ownership. For
            rentals without a UPI, you can list directly with approximate location only.
          </div>
          <div className={styles.cardActions}>
            <Link href={privateSaleHref}>
              <Button variant="secondary">List privately</Button>
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardLabel}>Owner route · Coming soon</div>
          <h2 className={styles.cardTitle}>List with an agent</h2>
          <div className={styles.cardBody}>
            Hand your property to a verified agent who will manage the listing on your behalf. Agent matching is not yet
            available.
          </div>
          <div className={styles.cardActions}>
            <Button disabled>Coming soon</Button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardLabel}>Professional route</div>
          <h2 className={styles.cardTitle}>Become an agent</h2>
          <div className={styles.cardBody}>
            Apply as an agent to represent properties through an agency and manage listings inside the sell portal.
          </div>
          <div className={styles.cardActions}>
            <Link href={agentHref}>
              <Button>Become an agent</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
