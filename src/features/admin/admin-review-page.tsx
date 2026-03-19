import Link from "next/link";

import { reviewApplicationAction } from "@/features/admin/actions";
import { isCurrentUserAdmin } from "@/lib/mock-data";
import { routes } from "@/lib/routes";

import styles from "./admin.module.css";

interface ReviewItem {
  id: string;
  title: string;
  meta: string[];
  kind: "agency" | "agent" | "valuator";
  details: Array<{ label: string; value: string }>;
  reviewNote: string;
}

interface AdminReviewPageProps {
  title: string;
  body: string;
  active: "agencies" | "agents" | "valuators";
  items: ReviewItem[];
  empty: string;
}

export function AdminReviewPage({ title, body, active, items, empty }: AdminReviewPageProps) {
  if (!isCurrentUserAdmin()) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={styles.unauthorized}>This area is restricted to the current admin user.</div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Admin</div>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.body}>{body}</div>
        </div>

        <div className={styles.nav}>
          <Link className={`${styles.navLink} ${active === "agencies" ? styles.active : ""}`} href={routes.admin.agencies}>
            Agencies
          </Link>
          <Link className={`${styles.navLink} ${active === "agents" ? styles.active : ""}`} href={routes.admin.agents}>
            Agents
          </Link>
          <Link className={`${styles.navLink} ${active === "valuators" ? styles.active : ""}`} href={routes.admin.valuators}>
            Valuators
          </Link>
          <Link className={styles.navLink} href={routes.admin.dashboard}>
            Dashboard
          </Link>
        </div>

        <div className={styles.panel}>
          <div className={styles.list}>
            {items.length > 0 ? (
              items.map((item) => (
                <div className={styles.item} key={item.id}>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{item.title}</div>
                    {item.meta.map((line) => (
                      <div className={styles.itemMeta} key={line}>
                        {line}
                      </div>
                    ))}
                    <div className={styles.detailList}>
                      {item.details.map((detail) => (
                        <div className={styles.detailRow} key={`${item.id}-${detail.label}`}>
                          <span className={styles.detailLabel}>{detail.label}</span>
                          <span className={styles.detailValue}>{detail.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.reviewNote}>
                      <div className={styles.reviewNoteLabel}>Approval effect</div>
                      <div>{item.reviewNote}</div>
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <form action={reviewApplicationAction}>
                      <input name="kind" type="hidden" value={item.kind} />
                      <input name="applicationId" type="hidden" value={item.id} />
                      <input name="decision" type="hidden" value="approved" />
                      <button className={styles.primaryAction} type="submit">
                        Approve
                      </button>
                    </form>
                    <form action={reviewApplicationAction}>
                      <input name="kind" type="hidden" value={item.kind} />
                      <input name="applicationId" type="hidden" value={item.id} />
                      <input name="decision" type="hidden" value="denied" />
                      <button className={styles.secondaryAction} type="submit">
                        Deny
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.empty}>{empty}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
