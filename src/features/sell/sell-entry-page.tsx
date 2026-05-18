import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import styles from "./sell-entry-page.module.css";

export function SellEntryPage({
  isSignedIn,
}: {
  isSignedIn: boolean;
}) {
  const privateSaleHref = isSignedIn ? routes.public.sellPrivate : `${routes.auth.signup}?next=${encodeURIComponent(routes.public.sellPrivate)}`;
  const agentHref = isSignedIn
    ? routes.onboarding.agentApplicationNew
    : `${routes.auth.signup}?next=${encodeURIComponent(routes.onboarding.agentApplicationNew)}`;

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
          <div className={styles.cardLabel}>Professional route</div>
          <h2 className={styles.cardTitle}>List with an agent</h2>
          <div className={styles.cardBody}>
            Apply as an agent if you want to represent properties through an agency and manage listings inside the sell
            portal.
          </div>
          <div className={styles.cardActions}>
            <Link href={agentHref}>
              <Button>Become an agent</Button>
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardLabel}>Owner route</div>
          <h2 className={styles.cardTitle}>Private sale</h2>
          <div className={styles.cardBody}>
            Start a private-sale path if you want to claim a property and prepare it for owner-led selling rather than
            agency representation.
          </div>
          <div className={styles.cardActions}>
            <Link href={privateSaleHref}>
              <Button variant="secondary">Private sale</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
