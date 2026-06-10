import Link from "next/link";

import styles from "./footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.copy}>&copy; {new Date().getFullYear()} Amazuga / Mapiverse LLC</span>
        <nav className={styles.links}>
          <Link href="/terms">Terms of Service</Link>
        </nav>
      </div>
    </footer>
  );
}
