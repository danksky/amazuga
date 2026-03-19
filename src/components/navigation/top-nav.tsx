"use client";

import { useState } from "react";

import Link from "next/link";

import { signOutAction } from "@/features/auth/session-actions";
import { publicTopNav } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import type { User } from "@/types/domain";

import { Button } from "../ui/button";
import styles from "./top-nav.module.css";

interface TopNavProps {
  currentPath?: string;
  currentUser?: User | null;
  isAdmin?: boolean;
}

export function TopNav({ currentPath, currentUser, isAdmin = false }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const signedInLabel = currentUser?.fullName?.split(" ")[0] ?? "Account";

  return (
    <div className={styles.navWrap}>
      <div className={`container ${styles.nav}`}>
        <Link className={styles.brand} href={routes.public.buy}>
          Amazuga
        </Link>
        <div className={styles.links}>
          {publicTopNav.map((item) => (
            <Link
              key={item.href}
              className={`${styles.link} ${currentPath === item.href ? styles.active : ""}`}
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
              <Link className={styles.link} href={routes.app.saved}>
                Saved
              </Link>
              <Link className={styles.link} href={routes.app.portal}>
                Portal
              </Link>
              {isAdmin ? (
                <Link className={styles.link} href={routes.admin.dashboard}>
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
                {publicTopNav.map((item) => (
                  <Link
                    key={item.href}
                    className={`${styles.mobileMenuLink} ${currentPath === item.href ? styles.active : ""}`}
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
                    <Link className={styles.mobileMenuLink} href={routes.app.saved} onClick={() => setMenuOpen(false)}>
                      Saved
                    </Link>
                    <Link className={styles.mobileMenuLink} href={routes.app.portal} onClick={() => setMenuOpen(false)}>
                      Portal
                    </Link>
                    {isAdmin ? (
                      <Link className={styles.mobileMenuLink} href={routes.admin.dashboard} onClick={() => setMenuOpen(false)}>
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
