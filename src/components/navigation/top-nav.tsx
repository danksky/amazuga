"use client";

import { useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/features/auth/session-actions";
import { routes } from "@/lib/routes";
import type { User } from "@/types/domain";

import { Button } from "../ui/button";
import styles from "./top-nav.module.css";

interface NavLinkItem {
  label: string;
  href: string;
}

interface TopNavProps {
  currentUser?: User | null;
  isAdmin?: boolean;
  marketingLinks: NavLinkItem[];
  signedInLinks: NavLinkItem[];
}

function isLinkActive(pathname: string, href: string) {
  if (href === routes.onboarding.advertise) {
    return (
      pathname === routes.onboarding.advertise ||
      pathname === routes.onboarding.assess ||
      pathname.startsWith("/agent/") ||
      pathname.startsWith("/agency/") ||
      pathname.startsWith("/valuator/")
    );
  }

  if (href === routes.admin.dashboard) {
    return pathname.startsWith("/admin/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ currentUser, isAdmin = false, marketingLinks, signedInLinks }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const signedInLabel = currentUser?.fullName?.split(" ")[0] ?? "Account";

  return (
    <div className={styles.navWrap}>
      <div className={`container ${styles.nav}`}>
        <Link className={styles.brand} href={routes.public.buy}>
          Amazuga
        </Link>
        <div className={styles.links}>
          {marketingLinks.map((item) => (
            <Link
              key={item.href}
              className={`${styles.link} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <button
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          className={styles.menuButton}
          onClick={() => setMenuOpen((current) => !current)}
          type="button"
        >
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
          <span className={styles.menuLine} />
        </button>
        <div className={styles.actions}>
          {currentUser ? (
            <>
              {signedInLinks.map((item) => (
                <Link
                  key={item.href}
                  className={`${styles.link} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin ? (
                <Link
                  className={`${styles.link} ${isLinkActive(pathname, routes.admin.dashboard) ? styles.active : ""}`}
                  href={routes.admin.dashboard}
                >
                  Admin
                </Link>
              ) : null}
              <span className={styles.userLabel}>{signedInLabel}</span>
              <form action={signOutAction}>
                <Button variant="secondary">Sign out</Button>
              </form>
            </>
          ) : (
            <>
              <Link className={styles.link} href={routes.auth.login}>
                Sign in
              </Link>
              <Link href={routes.auth.signup}>
                <Button variant="secondary">Create account</Button>
              </Link>
            </>
          )}
        </div>
        {menuOpen ? (
          <div className={styles.mobileOverlay}>
            <div className={styles.mobileOverlayHeader}>
              <div className={styles.brand}>Amazuga</div>
              <button
                aria-label="Close navigation menu"
                className={styles.menuButton}
                onClick={() => setMenuOpen(false)}
                type="button"
              >
                <span className={styles.closeLineOne} />
                <span className={styles.closeLineTwo} />
              </button>
            </div>
            <div className={styles.mobileOverlayBody}>
              <div className={styles.mobileMenuLinks}>
                {marketingLinks.map((item) => (
                  <Link
                    key={item.href}
                    className={`${styles.mobileMenuLink} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className={styles.mobileMenuActions}>
                {currentUser ? (
                  <>
                    {signedInLinks.map((item) => (
                      <Link
                        key={item.href}
                        className={`${styles.mobileMenuLink} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    {isAdmin ? (
                      <Link
                        className={`${styles.mobileMenuLink} ${isLinkActive(pathname, routes.admin.dashboard) ? styles.active : ""}`}
                        href={routes.admin.dashboard}
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    ) : null}
                    <div className={styles.mobileUserLabel}>Signed in as {signedInLabel}</div>
                    <form action={signOutAction} onSubmit={() => setMenuOpen(false)}>
                      <Button variant="secondary">Sign out</Button>
                    </form>
                  </>
                ) : (
                  <>
                    <Link className={styles.mobileMenuLink} href={routes.auth.login} onClick={() => setMenuOpen(false)}>
                      Sign in
                    </Link>
                    <Link href={routes.auth.signup} onClick={() => setMenuOpen(false)}>
                      <Button variant="secondary">Create account</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
