import "server-only";

import { cache } from "react";

import { portalNav } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import type { SubmissionStatus } from "@/types/domain";

import {
  listAgenciesFromDb,
  listAgencyApplicationsFromDb,
  listAgentApplicationsFromDb,
  listValuatorApplicationsFromDb,
} from "./workflows";

export interface PortalAccessState {
  agencyApplicationStatus?: SubmissionStatus;
  agentApplicationStatus?: SubmissionStatus;
  valuatorApplicationStatus?: SubmissionStatus;
  hasManagedAgencyAccess: boolean;
  hasAgencyMembership: boolean;
  hasAgencyPortalAccess: boolean;
  hasValuatorPortalAccess: boolean;
  hasAnyPortalAccess: boolean;
  hasPendingManagerActivation: boolean;
  primaryPortalHref: string | null;
  primaryPortalLabel: string | null;
  shouldShowApplicationsNav: boolean;
}

function getLatestAgencyApplicationStatus(
  items: Awaited<ReturnType<typeof listAgencyApplicationsFromDb>>,
  userId: string,
) {
  return [...items].reverse().find((item) => item.createdByUserId === userId)?.status;
}

function getLatestUserApplicationStatus<
  T extends {
    userId: string;
    status: SubmissionStatus;
  },
>(items: T[], userId: string) {
  return [...items].reverse().find((item) => item.userId === userId)?.status;
}

export const getPortalAccessState = cache(async (userId: string): Promise<PortalAccessState> => {
  const [agencies, agencyApplications, agentApplications, valuatorApplications] = await Promise.all([
    listAgenciesFromDb(),
    listAgencyApplicationsFromDb(),
    listAgentApplicationsFromDb(),
    listValuatorApplicationsFromDb(),
  ]);

  const hasManagedAgencyAccess = agencies.some((agency) => agency.managerUserId === userId);
  const hasAgencyMembership = agencies.some((agency) => agency.memberUserIds.includes(userId));
  const hasPendingManagerActivation = agencies.some(
    (agency) => agency.pendingManagerUserId === userId && agency.managerUserId !== userId,
  );

  const agencyApplicationStatus = getLatestAgencyApplicationStatus(agencyApplications, userId);
  const agentApplicationStatus = getLatestUserApplicationStatus(agentApplications, userId);
  const valuatorApplicationStatus = getLatestUserApplicationStatus(valuatorApplications, userId);

  const hasAgencyPortalAccess = hasManagedAgencyAccess || hasAgencyMembership;
  const hasValuatorPortalAccess = valuatorApplicationStatus === "approved";
  const hasAnyPortalAccess = hasAgencyPortalAccess || hasValuatorPortalAccess;
  const hasApplicationAttention = [agencyApplicationStatus, agentApplicationStatus, valuatorApplicationStatus].some(
    (status) => status === "pending" || status === "denied",
  );

  return {
    agencyApplicationStatus,
    agentApplicationStatus,
    valuatorApplicationStatus,
    hasManagedAgencyAccess,
    hasAgencyMembership,
    hasAgencyPortalAccess,
    hasValuatorPortalAccess,
    hasAnyPortalAccess,
    hasPendingManagerActivation,
    primaryPortalHref: hasAgencyPortalAccess
      ? routes.app.portalListings
      : hasValuatorPortalAccess
        ? routes.app.portalValuations
        : null,
    primaryPortalLabel: hasAgencyPortalAccess ? "Listings" : hasValuatorPortalAccess ? "Valuations" : null,
    shouldShowApplicationsNav: !hasAnyPortalAccess || hasPendingManagerActivation || hasApplicationAttention,
  };
});

export function getPortalEntryHref(access: PortalAccessState) {
  return access.primaryPortalHref ?? routes.onboarding.advertise;
}

export function getPortalNavItems(access: PortalAccessState) {
  const allowedHrefs = new Set<string>();

  if (access.hasAgencyPortalAccess) {
    allowedHrefs.add(routes.app.portalListings);
    allowedHrefs.add(routes.app.portalAgency);
    allowedHrefs.add(routes.app.portalAgents);
  }

  if (access.hasValuatorPortalAccess) {
    allowedHrefs.add(routes.app.portalValuations);
  }

  return portalNav.filter((item) => allowedHrefs.has(item.href));
}
