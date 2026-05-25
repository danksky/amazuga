import { buildPublicPropertyPath } from "./property-slug";
import type { PropertyKind } from "@/types/domain";

export const routes = {
  public: {
    home: "/",
    buy: "/buy",
    rent: "/rent",
    sell: "/sell",
    sellPrivate: "/sell/private",
    property: (
      propertyId: string,
      propertyContext?:
        | string
        | {
            propertyTitle?: string | null;
            parcelDisplayId?: string | null;
            propertyKind?: PropertyKind | null;
            unitLabel?: string | null;
          }
        | null,
    ) => buildPublicPropertyPath(propertyId, propertyContext),
    area: (slug: string) => `/area/${slug}`,
    agencies: "/agencies",
    agency: (agencySlug: string) => `/agencies/${agencySlug}`,
    agent: (agentSlug: string) => `/agents/${agentSlug}`,
    valuator: (valuatorSlug: string) => `/valuators/${valuatorSlug}`,
  },
  auth: {
    login: "/login",
    signup: "/signup",
  },
  onboarding: {
    advertise: "/sell/portal/applications",
    assess: "/assess",
    agentApplicationNew: "/agent/applications/new",
    agentApplication: (applicationId: string) => `/agent/applications/${applicationId}`,
    agencyRegistrationNew: "/agency/registration-requests/new",
    agencyRegistration: (requestId: string) => `/agency/registration-requests/${requestId}`,
    valuatorApplicationNew: "/valuator/applications/new",
    valuatorApplication: (applicationId: string) => `/valuator/applications/${applicationId}`,
  },
  app: {
    account: "/account",
    saved: "/saved",
    portal: "/sell/portal",
    portalApplications: "/sell/portal/applications",
    portalProperties: "/sell/portal/properties",
    portalPropertyTransfer: (propertyId: string) => `/sell/portal/properties/${propertyId}/transfer`,
    portalPropertyClaim: "/sell/portal/properties/claim",
    portalPropertyClaimSubmit: "/sell/portal/properties/claim/submit",
    portalListings: "/sell/portal/listings",
    portalListingNew: "/sell/portal/listings/new",
    portalListingEdit: (listingId: string) => `/sell/portal/listings/${listingId}/edit`,
    portalValuations: "/sell/portal/valuations",
    portalValuationNew: "/sell/portal/valuations/new",
    portalAgency: "/sell/portal/agency",
    portalAgents: "/sell/portal/team",
    portalProfile: "/sell/portal/profile",
    portalSettings: "/sell/portal/settings",
  },
  admin: {
    home: "/admin/dashboard",
    dashboard: "/admin/dashboard",
    agencies: "/admin/agencies",
    agents: "/admin/agents",
    valuators: "/admin/valuators",
    valuations: "/admin/valuations",
    properties: "/admin/properties",
    listings: "/admin/listings",
  },
} as const;
