import { reviewApplicationAction } from "@/features/admin/actions";

import { AdminNav, type AdminNavItem } from "./admin-nav";
import styles from "./admin.module.css";

interface ReviewItem {
  id: string;
  title: string;
  meta: string[];
  kind: "agency" | "agent" | "valuator" | "valuation" | "property_claim";
  details: Array<{ label: string; value: string }>;
  documentLinks?: Array<{ label: string; url: string }>;
  reviewNote: string;
  approvalBlockedReason?: string;
}

interface AdminReviewPageProps {
  title: string;
  body: string;
  active: Exclude<AdminNavItem, "dashboard">;
  items: ReviewItem[];
  empty: string;
}

export function AdminReviewPage({ title, body, active, items, empty }: AdminReviewPageProps) {
  const pendingLabel = `${items.length} pending ${items.length === 1 ? "entry" : "entries"}`;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Admin</div>
          <AdminNav active={active} />
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.body}>{body}</div>
        </div>

        <div className={styles.panel}>
          <div className={styles.reviewQueueHeader}>
            <div>
              <h2 className={styles.panelTitle}>Review queue</h2>
              <p className={styles.panelBody}>Work through the oldest pending submissions first, then approve or deny from the decision rail.</p>
            </div>
            <div className={styles.queueCount}>{pendingLabel}</div>
          </div>

          <div className={styles.reviewList}>
            {items.length > 0 ? (
              items.map((item, index) => (
                <article className={styles.reviewItem} key={item.id}>
                  <div className={styles.itemContent}>
                    <div className={styles.reviewItemHeader}>
                      <div className={styles.reviewIndex}>#{index + 1}</div>
                      <div>
                        <div className={styles.itemTitle}>{item.title}</div>
                        <div className={styles.metaList}>
                          {item.meta.map((line) => (
                            <span className={styles.metaPill} key={line}>
                              {line}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={styles.detailList}>
                      {item.details.map((detail) => (
                        <div className={styles.detailRow} key={`${item.id}-${detail.label}`}>
                          <span className={styles.detailLabel}>{detail.label}</span>
                          <span className={styles.detailValue}>{detail.value}</span>
                        </div>
                      ))}
                    </div>
                    {item.documentLinks && item.documentLinks.length > 0 ? (
                      <div className={styles.docList}>
                        {item.documentLinks.map((doc) => (
                          <div className={styles.docItem} key={doc.label}>
                            <div className={styles.docLabel}>{doc.label}</div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={doc.label} className={styles.docImg} src={doc.url} />
                            <a
                              className={styles.docLink}
                              href={doc.url}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              Open full size ↗
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className={styles.reviewNote}>
                      <div className={styles.reviewNoteLabel}>Approval effect</div>
                      <div>{item.reviewNote}</div>
                    </div>
                    {item.approvalBlockedReason ? (
                      <div className={styles.blockerNote}>
                        <div className={styles.reviewNoteLabel}>Approval blocked</div>
                        <div>{item.approvalBlockedReason}</div>
                      </div>
                    ) : null}
                  </div>

                  <aside className={styles.decisionRail} aria-label={`Decision controls for ${item.title}`}>
                    <div>
                      <div className={styles.decisionLabel}>Decision</div>
                      <div className={styles.decisionCopy}>Resolve this entry and remove it from the pending queue.</div>
                    </div>
                    <div className={styles.decisionActions}>
                      <form action={reviewApplicationAction}>
                        <input name="kind" type="hidden" value={item.kind} />
                        <input name="applicationId" type="hidden" value={item.id} />
                        <input name="decision" type="hidden" value="approved" />
                        <button
                          className={styles.primaryAction}
                          disabled={Boolean(item.approvalBlockedReason)}
                          type="submit"
                        >
                          {item.approvalBlockedReason ? "Cannot approve" : "Approve"}
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
                  </aside>
                </article>
              ))
            ) : (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>All clear</div>
                <div className={styles.empty}>{empty}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
