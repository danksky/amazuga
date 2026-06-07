"use client";

import { Fragment, useState } from "react";

import type { PublicAgencyPageData } from "@/lib/server/agency-agent-pages";

import { ListingsGrid } from "./listings-grid";
import styles from "./profile-page.module.css";

interface AgencyProfilePageProps {
  data: PublicAgencyPageData;
}

export function AgencyProfilePage({ data }: AgencyProfilePageProps) {
  const { agency, listings } = data;
  const [shareCopied, setShareCopied] = useState(false);

  async function shareAgency() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: agency.businessName, url });
      } catch {
        // user cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  const metaItems: { label: string; href: string }[] = [];
  if (agency.whatsappPhone) {
    const normalized = agency.whatsappPhone.replace(/\D/g, "");
    metaItems.push({ label: "WhatsApp", href: `https://wa.me/${normalized}` });
  }
  if (agency.googleMapsUrl) {
    metaItems.push({ label: "Find us", href: agency.googleMapsUrl });
  }

  const hasAnyMeta = true;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Agency</div>
        <div className={styles.titleRow}>
          {agency.logoUrl ? (
            <img alt={agency.businessName} className={styles.agencyLogo} src={agency.logoUrl} />
          ) : null}
          <h1 className={styles.title}>{agency.businessName}</h1>
        </div>
        {hasAnyMeta ? (
          <div className={styles.meta}>
            {metaItems.map((item, i) => (
              <Fragment key={item.href}>
                {i > 0 ? <span className={styles.metaSep}>·</span> : null}
                <a
                  className={styles.metaLink}
                  href={item.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {item.label}
                </a>
              </Fragment>
            ))}
            {agency.websiteUrl ? (
              <a
                className={styles.socialButton}
                href={agency.websiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <i className="bi bi-globe" />
                Website
              </a>
            ) : null}
            {agency.instagramUrl ? (
              <a
                className={styles.socialButton}
                href={agency.instagramUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <i className="bi bi-instagram" />
                Instagram
              </a>
            ) : null}
            <button className={styles.socialButton} onClick={shareAgency} type="button">
              <i className={shareCopied ? "bi bi-check2" : "bi bi-share"} />
              {shareCopied ? "Link copied!" : "Share"}
            </button>
          </div>
        ) : null}
      </div>
      <ListingsGrid listings={listings} />
    </div>
  );
}
