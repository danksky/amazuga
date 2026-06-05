import Link from "next/link";

import { resolveContestAction } from "@/features/admin/actions";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { listOwnershipContestsFromDb } from "@/lib/server/workflows";

import styles from "@/features/admin/admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminContestsPage() {
  const contests = await listOwnershipContestsFromDb();

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Admin</div>
          <h1 className={styles.title}>Ownership disputes</h1>
          <div className={styles.body}>
            Review disputes from users who believe a UPI has been wrongly claimed by someone else.
            Dismiss = original owner keeps it, dispute is closed.
            Overturn = original owner&apos;s listings are archived and their ownership is removed;
            the UPI is freed so the disputing user (or anyone else) can re-claim it through the
            normal flow.
          </div>
        </div>

        <div className={styles.nav}>
          <Link className={styles.navLink} href={routes.admin.agencies}>Agencies</Link>
          <Link className={styles.navLink} href={routes.admin.agents}>Agents</Link>
          <Link className={styles.navLink} href={routes.admin.valuators}>Valuators</Link>
          <Link className={styles.navLink} href={routes.admin.valuations}>Valuations</Link>
          <Link className={styles.navLink} href={routes.admin.properties}>Properties</Link>
          <Link className={`${styles.navLink} ${styles.active}`} href={routes.admin.contests}>Contests</Link>
          <Link className={styles.navLink} href={routes.admin.dashboard}>Dashboard</Link>
        </div>

        <div className={styles.panel}>
          <div className={styles.list}>
            {contests.length > 0 ? (
              contests.map((contest) => (
                <div className={styles.item} key={contest.id}>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{contest.upi}</div>
                    <div className={styles.itemMeta}>
                      Contested by {contest.contestingUserName} · {formatDate(contest.createdAt)}
                    </div>

                    <div className={styles.detailList}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Contest ID</span>
                        <span className={styles.detailValue}>{contest.id}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>UPI</span>
                        <span className={styles.detailValue}>{contest.upi}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Registered property</span>
                        <span className={styles.detailValue}>
                          <a
                            href={routes.public.property(contest.claimedPropertyId)}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            {contest.claimedPropertyId} ↗
                          </a>
                        </span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Note from contesting user</span>
                        <span className={styles.detailValue}>{contest.note}</span>
                      </div>
                    </div>

                    <div className={styles.reviewNote}>
                      <div className={styles.reviewNoteLabel}>What each action does</div>
                      <div>
                        <strong>Dismiss</strong> — the original owner keeps the property; this dispute is
                        closed with no changes.
                        {" "}<strong>Overturn</strong> — the original owner&apos;s listings are archived and
                        their ownership record is removed. The UPI becomes free to claim; the disputing user
                        can then go through the normal UPI claim flow and will be approved immediately.
                      </div>
                    </div>
                  </div>

                  <div className={styles.itemActions}>
                    <form action={resolveContestAction}>
                      <input name="contestId" type="hidden" value={contest.id} />
                      <input name="resolution" type="hidden" value="resolved_upheld" />
                      <button className={styles.secondaryAction} type="submit">
                        Dismiss
                      </button>
                    </form>
                    <form action={resolveContestAction}>
                      <input name="contestId" type="hidden" value={contest.id} />
                      <input name="resolution" type="hidden" value="resolved_overturned" />
                      <button className={styles.primaryAction} type="submit">
                        Overturn
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No pending ownership disputes.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
