import styles from "./shell.module.css";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <div className={`container ${styles.placeholderWrap}`}>
      <div className={styles.placeholderCard}>
        <div className={styles.placeholderEyebrow}>{eyebrow}</div>
        <h1 className={styles.placeholderTitle}>{title}</h1>
        <div className={styles.placeholderBody}>{description}</div>
      </div>
    </div>
  );
}
