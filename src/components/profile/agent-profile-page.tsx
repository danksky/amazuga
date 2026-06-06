import Link from "next/link";

import type { PublicAgentPageData } from "@/lib/server/agency-agent-pages";
import { routes } from "@/lib/routes";

import { ListingsGrid } from "./listings-grid";
import styles from "./profile-page.module.css";

interface AgentProfilePageProps {
  data: PublicAgentPageData;
}

export function AgentProfilePage({ data }: AgentProfilePageProps) {
  const { agent, agency, listings } = data;

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
      <ListingsGrid listings={listings} />
    </div>
  );
}
