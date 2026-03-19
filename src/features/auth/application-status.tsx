import Link from "next/link";

import { Button } from "@/components/ui/button";

import styles from "./application-status.module.css";

interface DetailItem {
  label: string;
  value: string;
}

interface ApplicationStatusProps {
  eyebrow: string;
  title: string;
  body: string;
  status: string;
  details: DetailItem[];
  nextStepsTitle: string;
  nextStepsBody: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function ApplicationStatus({
  eyebrow,
  title,
  body,
  status,
  details,
  nextStepsTitle,
  nextStepsBody,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: ApplicationStatusProps) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.body}>{body}</div>
        <div className={styles.statusPill}>{status}</div>

        <div className={styles.details}>
          {details.map((detail) => (
            <div className={styles.detailRow} key={detail.label}>
              <span>{detail.label}</span>
              <span>{detail.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.nextSteps}>
          <div className={styles.nextStepsTitle}>{nextStepsTitle}</div>
          <div className={styles.nextStepsBody}>{nextStepsBody}</div>
        </div>

        <div className={styles.actions}>
          <Link href={primaryHref}>
            <Button>{primaryLabel}</Button>
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link href={secondaryHref}>
              <Button variant="secondary">{secondaryLabel}</Button>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
