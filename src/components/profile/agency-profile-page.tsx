import { Fragment } from "react";

import { BrowseListingCard } from "@/components/property/browse-listing-card";
import type { PublicAgencyPageData } from "@/lib/server/agency-agent-pages";

import styles from "./profile-page.module.css";

interface AgencyProfilePageProps {
  data: PublicAgencyPageData;
}

export function AgencyProfilePage({ data }: AgencyProfilePageProps) {
  const { agency, listings } = data;
  const countLabel =
    listings.length === 0
      ? "No active listings"
      : `${listings.length} active listing${listings.length === 1 ? "" : "s"}`;

  const metaItems: { label: string; href: string }[] = [];
  if (agency.whatsappPhone) {
    const normalized = agency.whatsappPhone.replace(/\D/g, "");
    metaItems.push({ label: "WhatsApp", href: `https://wa.me/${normalized}` });
  }
  if (agency.websiteUrl) {
    metaItems.push({ label: "Website", href: agency.websiteUrl });
  }
  if (agency.instagramUrl) {
    metaItems.push({ label: "Instagram", href: agency.instagramUrl });
  }
  if (agency.googleMapsUrl) {
    metaItems.push({ label: "Find us", href: agency.googleMapsUrl });
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Agency</div>
        <h1 className={styles.title}>{agency.businessName}</h1>
        {metaItems.length > 0 ? (
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
          </div>
        ) : null}
      </div>

      <div className={styles.resultsCard}>
        <div className={styles.resultsHead}>
          <div className={styles.subtitle}>{countLabel}</div>
        </div>
        {listings.length === 0 ? (
          <div className={styles.empty}>This agency has no active listings.</div>
        ) : (
          <div className={styles.grid}>
            {listings.map((card) => (
              <BrowseListingCard key={card.listingId} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
