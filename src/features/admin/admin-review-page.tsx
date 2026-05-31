import Link from "next/link";

import { reviewApplicationAction } from "@/features/admin/actions";
import { routes } from "@/lib/routes";

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
  active: "agencies" | "agents" | "valuators" | "valuations" | "properties";
  items: ReviewItem[];
  empty: string;
}

export function AdminReviewPage({ title, body, active, items, empty }: AdminReviewPageProps) {
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
          <Link className={`${styles.navLink} ${active === "valuations" ? styles.active : ""}`} href={routes.admin.valuations}>
            Valuations
          </Link>
          <Link className={`${styles.navLink} ${active === "properties" ? styles.active : ""}`} href={routes.admin.properties}>
            Properties
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
                  <div className={styles.itemActions}>
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
