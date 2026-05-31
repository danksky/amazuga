import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

import styles from "./agent-choose-path.module.css";

export function AgentChoosePath() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.hero}>
        <div className={styles.eyebrow}>Agent</div>
        <h1 className={styles.title}>How do you want to get started?</h1>
        <div className={styles.body}>
          You can register a new agency or apply to join one that is already approved on Amazuga. Both paths go through
          a short review before you can access the sell portal.
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardLabel}>New agency</div>
          <h2 className={styles.cardTitle}>Register an agency</h2>
          <div className={styles.cardBody}>
            Submit a registration request for your own agency. Once approved, you can add agents and manage listings
            under your agency account.
          </div>
          <div className={styles.cardActions}>
            <Link href={routes.onboarding.agencyRegistrationNew}>
              <Button>Register agency</Button>
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardLabel}>Existing agency</div>
          <h2 className={styles.cardTitle}>Join an agency</h2>
          <div className={styles.cardBody}>
            Apply as an agent under an agency that is already approved on Amazuga. Your application will be reviewed
            before you gain access to the sell portal.
          </div>
          <div className={styles.cardActions}>
            <Link href={routes.onboarding.agentApplicationNew}>
              <Button variant="secondary">Apply as agent</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
