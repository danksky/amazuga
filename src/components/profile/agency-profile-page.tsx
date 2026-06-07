import { Fragment } from "react";

import type { PublicAgencyPageData } from "@/lib/server/agency-agent-pages";

import { ListingsGrid } from "./listings-grid";
import styles from "./profile-page.module.css";

interface AgencyProfilePageProps {
  data: PublicAgencyPageData;
}

export function AgencyProfilePage({ data }: AgencyProfilePageProps) {
  const { agency, listings } = data;

  const metaItems: { label: string; href: string }[] = [];
  if (agency.whatsappPhone) {
    const normalized = agency.whatsappPhone.replace(/\D/g, "");
    metaItems.push({ label: "WhatsApp", href: `https://wa.me/${normalized}` });
  }
  if (agency.websiteUrl) {
    metaItems.push({ label: "Website", href: agency.websiteUrl });
  }
  if (agency.googleMapsUrl) {
    metaItems.push({ label: "Find us", href: agency.googleMapsUrl });
  }

  const hasAnyMeta = metaItems.length > 0 || !!agency.instagramUrl;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        {agency.logoUrl ? (
          <img alt={agency.businessName} className={styles.agencyLogo} src={agency.logoUrl} />
        ) : null}
        <div className={styles.eyebrow}>Agency</div>
        <h1 className={styles.title}>{agency.businessName}</h1>
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
            {agency.instagramUrl ? (
              <a
                className={styles.instagramButton}
                href={agency.instagramUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <i className="bi bi-instagram" />
                Instagram
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <ListingsGrid listings={listings} />
    </div>
  );
}
