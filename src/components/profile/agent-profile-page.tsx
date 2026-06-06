import Link from "next/link";

import { BrowseListingCard } from "@/components/property/browse-listing-card";
import type { PublicAgentPageData } from "@/lib/server/agency-agent-pages";
import { routes } from "@/lib/routes";

import styles from "./profile-page.module.css";

interface AgentProfilePageProps {
  data: PublicAgentPageData;
}

export function AgentProfilePage({ data }: AgentProfilePageProps) {
  const { agent, agency, listings } = data;
  const countLabel =
    listings.length === 0
      ? "No active listings"
      : `${listings.length} active listing${listings.length === 1 ? "" : "s"}`;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div className={styles.eyebrow}>Agent</div>
        <h1 className={styles.title}>{agent.fullName}</h1>
        <div className={styles.meta}>
          <Link className={styles.metaLink} href={routes.public.agency(agency.slug)}>
            {agency.businessName}
          </Link>
          {agent.phone ? (
            <>
              <span className={styles.metaSep}>·</span>
              <a
                className={styles.metaLink}
                href={`https://wa.me/${agent.phone.replace(/\D/g, "")}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                WhatsApp
              </a>
            </>
          ) : null}
        </div>
      </div>

      <div className={styles.resultsCard}>
        <div className={styles.resultsHead}>
          <div className={styles.subtitle}>{countLabel}</div>
        </div>
        {listings.length === 0 ? (
          <div className={styles.empty}>This agent has no active listings.</div>
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
