"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./portal-section-nav.module.css";

interface PortalSectionNavItem {
  label: string;
  href: string;
}

function isLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSectionNav({ items }: { items: PortalSectionNavItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.label}>Portal</div>
        <div className={styles.links}>
          {items.map((item) => (
            <Link
              key={item.href}
              className={`${styles.link} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
