import "server-only";

import { cache } from "react";

import { portalNav } from "@/lib/navigation";
import { routes } from "@/lib/routes";
import type { SubmissionStatus } from "@/types/domain";

import {
  getLatestAgencyApplicationStatusForUser,
  getLatestAgentApplicationStatusForUser,
  getLatestValuatorApplicationStatusForUser,
  listAgenciesForUser,
  listPropertyClaimRequestsForUser,
  listPropertyOwnershipsForUser,
} from "./workflows";

export interface PortalAccessState {
  agencyApplicationStatus?: SubmissionStatus;
  agentApplicationStatus?: SubmissionStatus;
  valuatorApplicationStatus?: SubmissionStatus;
  hasManagedAgencyAccess: boolean;
  hasAgencyMembership: boolean;
  hasAgencyPortalAccess: boolean;
  hasPropertyWorkspaceAccess: boolean;
  hasValuatorPortalAccess: boolean;
  hasAnyPortalAccess: boolean;
  hasPendingManagerActivation: boolean;
  hasApplicationAttention: boolean;
  hasProfessionalExpansionOptions: boolean;
  primaryPortalHref: string | null;
  primaryPortalLabel: string | null;
  shouldShowApplicationsNav: boolean;
}

export const getPortalAccessState = cache(async (userId: string): Promise<PortalAccessState> => {
  const [agencies, agencyApplicationStatus, agentApplicationStatus, valuatorApplicationStatus, propertyOwnerships, propertyClaims] =
    await Promise.all([
      listAgenciesForUser(userId),
      getLatestAgencyApplicationStatusForUser(userId),
      getLatestAgentApplicationStatusForUser(userId),
      getLatestValuatorApplicationStatusForUser(userId),
      listPropertyOwnershipsForUser(userId),
      listPropertyClaimRequestsForUser(userId),
    ]);

  const hasManagedAgencyAccess = agencies.some((agency) => agency.managerUserId === userId);
  const hasAgencyMembership = agencies.some((agency) => agency.memberUserIds.includes(userId));
  const hasPendingManagerActivation = agencies.some(
    (agency) => agency.pendingManagerUserId === userId && agency.managerUserId !== userId,
  );

  const hasAgencyPortalAccess = hasManagedAgencyAccess || hasAgencyMembership;
  const hasPropertyWorkspaceAccess =
    propertyOwnerships.length > 0 || propertyClaims.some((claim) => claim.status === "pending" || claim.status === "approved");
  const hasValuatorPortalAccess = valuatorApplicationStatus === "approved";
  const hasAnyPortalAccess = hasAgencyPortalAccess || hasValuatorPortalAccess || hasPropertyWorkspaceAccess;
  const hasApplicationAttention = [agencyApplicationStatus, agentApplicationStatus, valuatorApplicationStatus].some(
    (status) => status === "pending" || status === "denied",
  );
  const hasProfessionalExpansionOptions = !hasAgencyPortalAccess || !hasValuatorPortalAccess;
  const shouldShowApplicationsNav =
    !hasAnyPortalAccess || hasPendingManagerActivation || hasApplicationAttention || hasProfessionalExpansionOptions;

  return {
    agencyApplicationStatus,
    agentApplicationStatus,
    valuatorApplicationStatus,
    hasManagedAgencyAccess,
    hasAgencyMembership,
    hasAgencyPortalAccess,
    hasPropertyWorkspaceAccess,
    hasValuatorPortalAccess,
    hasAnyPortalAccess,
    hasPendingManagerActivation,
    hasApplicationAttention,
    hasProfessionalExpansionOptions,
    primaryPortalHref: hasAgencyPortalAccess
      ? routes.app.portalListings
      : hasPropertyWorkspaceAccess
        ? routes.app.portalProperties
      : hasValuatorPortalAccess
        ? routes.app.portalValuations
        : null,
    primaryPortalLabel: hasAgencyPortalAccess
      ? "Listings"
      : hasPropertyWorkspaceAccess
        ? "Properties"
      : hasValuatorPortalAccess
          ? "Valuations"
          : null,
    shouldShowApplicationsNav,
  };
});

export function getPortalEntryHref(access: PortalAccessState) {
  if (access.primaryPortalHref) {
    return access.primaryPortalHref;
  }

  if (access.hasPendingManagerActivation || access.hasApplicationAttention) {
    return routes.app.portalApplications;
  }

  return routes.public.sell;
}

export function getPortalNavItems(access: PortalAccessState) {
  const allowedHrefs = new Set<string>();

  if (access.shouldShowApplicationsNav) {
    allowedHrefs.add(routes.app.portalApplications);
  }

  allowedHrefs.add(routes.app.portalProperties);

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
