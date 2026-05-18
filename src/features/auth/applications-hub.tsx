import Link from "next/link";

import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { AgencyApplication, AgentApplication, ValuatorApplication } from "@/types/domain";

import styles from "./applications-hub.module.css";

type HubStatus = "not_started" | "pending" | "approved" | "denied";

interface ApplicationsHubProps {
  agencyApplication?: AgencyApplication;
  agentApplication?: AgentApplication;
  valuatorApplication?: ValuatorApplication;
  hasAgencyMembership: boolean;
  canManageAgency: boolean;
  canSubmitValuations: boolean;
}

function getApplicationStatusLabel(status: HubStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Under review";
    case "denied":
      return "Denied";
    default:
      return "Not started";
  }
}

function getAgencyCard(props: ApplicationsHubProps) {
  const { agencyApplication, canManageAgency, agentApplication } = props;
  const status = (agencyApplication?.status ?? "not_started") as HubStatus;

  if (!agencyApplication) {
    return {
      label: "Agency registration",
      title: "Register your agency",
      body: "Submit a business name and TIN if you want to create and manage a new agency.",
      details: [
        { label: "Current state", value: "No agency registration" },
        { label: "Manager access", value: "Not available" },
      ],
      primaryHref: routes.onboarding.agencyRegistrationNew,
      primaryLabel: "Register agency",
      secondaryHref: routes.onboarding.agentApplicationNew,
      secondaryLabel: "Apply as agent",
      status,
    };
  }

  if (agencyApplication.status === "approved" && canManageAgency) {
    return {
      label: "Agency registration",
      title: agencyApplication.businessName,
      body: "Your agency is approved and manager access is active in the portal.",
      details: [
        { label: "Current state", value: "Approved" },
        { label: "Manager access", value: "Active" },
      ],
      primaryHref: routes.app.portalAgency,
      primaryLabel: "Open agency",
      secondaryHref: routes.app.portalListings,
      secondaryLabel: "Open listings",
      status,
    };
  }

  if (agencyApplication.status === "approved") {
    return {
      label: "Agency registration",
      title: agencyApplication.businessName,
      body: "Your agency is approved, but manager access still depends on completing your agent approval.",
      details: [
        { label: "Current state", value: "Approved" },
        { label: "Agent approval", value: agentApplication?.status === "approved" ? "Approved" : "Still required" },
      ],
      primaryHref:
        agentApplication?.status === "approved"
          ? routes.onboarding.agencyRegistration(agencyApplication.id)
          : routes.onboarding.agentApplicationNew,
      primaryLabel: agentApplication?.status === "approved" ? "View status" : "Complete agent approval",
      secondaryHref: routes.onboarding.agencyRegistration(agencyApplication.id),
      secondaryLabel: "View request",
      status,
    };
  }

  return {
    label: "Agency registration",
    title: agencyApplication.businessName,
    body:
      agencyApplication.status === "pending"
        ? "Your agency submission is already in review."
        : "Your last agency registration was denied. You can review it and submit a new one.",
    details: [
      { label: "Current state", value: getApplicationStatusLabel(status) },
      { label: "Submitted", value: formatDate(agencyApplication.createdAt) },
    ],
    primaryHref: routes.onboarding.agencyRegistration(agencyApplication.id),
    primaryLabel: "View request",
    secondaryHref: agencyApplication.status === "denied" ? routes.onboarding.agencyRegistrationNew : undefined,
    secondaryLabel: agencyApplication.status === "denied" ? "Register again" : undefined,
    status,
  };
}

function getAgentCard(props: ApplicationsHubProps) {
  const { agentApplication, hasAgencyMembership } = props;
  const status = (agentApplication?.status ?? "not_started") as HubStatus;

  if (!agentApplication) {
    return {
      label: "Agent approval",
      title: "Join an approved agency",
      body: "Apply as an agent to activate membership in an approved agency and unlock internal listing access.",
      details: [
        { label: "Current state", value: "No agent application" },
        { label: "Agency membership", value: "Not active" },
      ],
      primaryHref: routes.onboarding.agentApplicationNew,
      primaryLabel: "Apply as agent",
      secondaryHref: routes.onboarding.agencyRegistrationNew,
      secondaryLabel: "Register agency instead",
      status,
    };
  }

  if (agentApplication.status === "approved") {
    return {
      label: "Agent approval",
      title: "Agent access active",
      body: hasAgencyMembership
        ? "Your agent approval and agency membership are active. You can now work from the portal."
        : "Your agent approval is active, but your agency membership still needs attention.",
      details: [
        { label: "Current state", value: "Approved" },
        { label: "Agency membership", value: hasAgencyMembership ? "Active" : "Missing" },
      ],
      primaryHref: hasAgencyMembership ? routes.app.portalListings : routes.onboarding.agentApplication(agentApplication.id),
      primaryLabel: hasAgencyMembership ? "Open listings" : "View application",
      secondaryHref: routes.onboarding.agentApplication(agentApplication.id),
      secondaryLabel: "View application",
      status,
    };
  }

  return {
    label: "Agent approval",
    title: "Agent application",
    body:
      agentApplication.status === "pending"
        ? "Your National ID submission is under review."
        : "Your last agent application was denied. You can review it and try again.",
    details: [
      { label: "Current state", value: getApplicationStatusLabel(status) },
      { label: "Submitted", value: formatDate(agentApplication.createdAt) },
    ],
    primaryHref: routes.onboarding.agentApplication(agentApplication.id),
    primaryLabel: "View application",
    secondaryHref: agentApplication.status === "denied" ? routes.onboarding.agentApplicationNew : undefined,
    secondaryLabel: agentApplication.status === "denied" ? "Apply again" : undefined,
    status,
  };
}

function getValuatorCard(props: ApplicationsHubProps) {
  const { valuatorApplication, canSubmitValuations } = props;
  const status = (valuatorApplication?.status ?? "not_started") as HubStatus;

  if (!valuatorApplication) {
    return {
      label: "Valuator recognition",
      title: "Apply as a valuator",
      body: "Submit your IRPV registration number if you want to add valuation workspaces to your account.",
      details: [
        { label: "Current state", value: "No valuator application" },
        { label: "Valuation access", value: "Not active" },
      ],
      primaryHref: routes.onboarding.valuatorApplicationNew,
      primaryLabel: "Apply as valuator",
      secondaryHref: routes.public.buy,
      secondaryLabel: "Browse homes",
      status,
    };
  }

  if (valuatorApplication.status === "approved") {
    return {
      label: "Valuator recognition",
      title: "Valuation access active",
      body: "Your valuator recognition is approved and the valuations workspace is available in the portal.",
      details: [
        { label: "Current state", value: "Approved" },
        { label: "Valuation access", value: canSubmitValuations ? "Active" : "Expected active" },
      ],
      primaryHref: routes.app.portalValuations,
      primaryLabel: "Open valuations",
      secondaryHref: routes.onboarding.valuatorApplication(valuatorApplication.id),
      secondaryLabel: "View application",
      status,
    };
  }

  return {
    label: "Valuator recognition",
    title: "Valuator application",
    body:
      valuatorApplication.status === "pending"
        ? "Your valuator recognition request is currently under review."
        : "Your last valuator recognition request was denied. You can review it and apply again.",
    details: [
      { label: "Current state", value: getApplicationStatusLabel(status) },
      { label: "Submitted", value: formatDate(valuatorApplication.createdAt) },
    ],
    primaryHref: routes.onboarding.valuatorApplication(valuatorApplication.id),
    primaryLabel: "View application",
    secondaryHref: valuatorApplication.status === "denied" ? routes.onboarding.valuatorApplicationNew : undefined,
    secondaryLabel: valuatorApplication.status === "denied" ? "Apply again" : undefined,
    status,
  };
}

export function ApplicationsHub(props: ApplicationsHubProps) {
  const cards = [getAgencyCard(props), getAgentCard(props), getValuatorCard(props)];
  const inProgressCount = cards.filter((card) => card.status === "pending").length;
  const approvedCount = cards.filter((card) => card.status === "approved").length;
  const notStartedCount = cards.filter((card) => card.status === "not_started").length;

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <h1 className={styles.title}>Applications</h1>
          <div className={styles.body}>
            This hub keeps your agency, agent, and valuator application state in one place so the next step in your
            professional access path is always clear. Once approvals are active, the related portal workspaces open from
            here too.
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Applications in review</div>
            <div className={styles.statValue}>{inProgressCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Approvals active</div>
            <div className={styles.statValue}>{approvedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Not started</div>
            <div className={styles.statValue}>{notStartedCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Portal areas unlocked</div>
            <div className={styles.statValue}>
              {[props.hasAgencyMembership, props.canManageAgency, props.canSubmitValuations].filter(Boolean).length}
            </div>
          </div>
        </div>

        <div className={styles.grid}>
          {cards.map((card) => (
            <section className={styles.card} key={card.label}>
              <div className={styles.cardLabel}>{card.label}</div>
              <div className={styles.cardTitle}>{card.title}</div>
              <div className={styles.cardBody}>{card.body}</div>
              <div className={styles.statusPill}>{getApplicationStatusLabel(card.status)}</div>

              <div className={styles.detailList}>
                {card.details.map((detail) => (
                  <div className={styles.detailRow} key={`${card.label}-${detail.label}`}>
                    <span className={styles.detailLabel}>{detail.label}</span>
                    <span className={styles.detailValue}>{detail.value}</span>
                  </div>
                ))}
              </div>

              <div className={styles.actions}>
                <Link className={styles.primaryAction} href={card.primaryHref}>
                  {card.primaryLabel}
                </Link>
                {card.secondaryHref && card.secondaryLabel ? (
                  <Link className={styles.secondaryAction} href={card.secondaryHref}>
                    {card.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className={styles.note}>
          Agency invitations, join requests, and manager-transfer actions still need dedicated workflow tables. This hub
          focuses on the Preview-backed application states that already exist and connects them to the portal workspaces
          we have now built.
        </div>
      </div>
    </div>
  );
}
