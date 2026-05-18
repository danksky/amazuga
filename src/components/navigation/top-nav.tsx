"use client";

import { useEffect, useRef, useState } from "react";

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
  if (href === routes.public.sell) {
    return (
      pathname === routes.public.sell ||
      pathname === routes.public.sellPrivate ||
      pathname.startsWith("/sell/") ||
      pathname === "/advertise" ||
      pathname === routes.onboarding.assess ||
      pathname.startsWith("/agent/") ||
      pathname.startsWith("/agency/") ||
      pathname.startsWith("/valuator/") ||
      pathname.startsWith("/portal/")
    );
  }

  if (href === routes.admin.dashboard) {
    return pathname.startsWith("/admin/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ currentUser, isAdmin = false, marketingLinks, signedInLinks }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const pathname = usePathname();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const signedInLabel = currentUser?.fullName ?? "Account";

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

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
            <div className={styles.accountMenuWrap} ref={accountMenuRef}>
              <button
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
                className={styles.accountMenuButton}
                aria-label="Open account menu"
                onClick={() => setAccountMenuOpen((current) => !current)}
                type="button"
              >
                <span className={styles.accountMenuIcon} aria-hidden="true">
                  <span className={styles.menuLine} />
                  <span className={styles.menuLine} />
                  <span className={styles.menuLine} />
                </span>
              </button>
              {accountMenuOpen ? (
                <div className={styles.accountDropdown} role="menu">
                  <div className={styles.accountIdentity}>
                    <div className={styles.accountHeading}>Signed in as {signedInLabel}</div>
                    <div className={styles.accountFooter}>
                      <span className={styles.accountFooterLabel}>Not you?</span>
                      <form action={signOutAction}>
                        <button className={styles.signOutLink} type="submit">
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                  <div className={styles.accountLinkList}>
                    {signedInLinks.map((item) => (
                      <Link
                        key={item.href}
                        className={`${styles.dropdownLink} ${isLinkActive(pathname, item.href) ? styles.active : ""}`}
                        href={item.href}
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    {isAdmin ? (
                      <Link
                        className={`${styles.dropdownLink} ${isLinkActive(pathname, routes.admin.dashboard) ? styles.active : ""}`}
                        href={routes.admin.dashboard}
                        onClick={() => setAccountMenuOpen(false)}
                      >
                        Admin
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
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
                    <div className={styles.mobileSignOutRow}>
                      <span className={styles.mobileUserLabel}>Not you?</span>
                      <form action={signOutAction} onSubmit={() => setMenuOpen(false)}>
                        <button className={styles.signOutLink} type="submit">
                          Sign out
                        </button>
                      </form>
                    </div>
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
