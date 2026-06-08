import Link from "next/link";

import { routes } from "@/lib/routes";

import styles from "./admin.module.css";

export type AdminNavItem = "dashboard" | "agencies" | "agents" | "valuators" | "valuations" | "properties" | "contests";

const navItems: Array<{ key: AdminNavItem; label: string; href: string }> = [
  { key: "dashboard", label: "Dashboard", href: routes.admin.dashboard },
  { key: "agencies", label: "Agencies", href: routes.admin.agencies },
  { key: "agents", label: "Agents", href: routes.admin.agents },
  { key: "valuators", label: "Valuators", href: routes.admin.valuators },
  { key: "valuations", label: "Valuations", href: routes.admin.valuations },
  { key: "properties", label: "Properties", href: routes.admin.properties },
  { key: "contests", label: "Contests", href: routes.admin.contests },
];

export function AdminNav({ active }: { active: AdminNavItem }) {
  return (
    <nav aria-label="Admin sections" className={styles.nav}>
      {navItems.map((item) => (
        <Link
          aria-current={active === item.key ? "page" : undefined}
          className={`${styles.navLink} ${active === item.key ? styles.active : ""}`}
          href={item.href}
          key={item.key}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
