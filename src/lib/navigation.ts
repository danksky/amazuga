import { routes } from "./routes";

export const publicTopNav = [
  { label: "Buy", href: routes.public.buy },
  { label: "Rent", href: routes.public.rent },
  { label: "Applications", href: routes.onboarding.advertise },
] as const;

export const accountNav = [
  { label: "Account", href: routes.app.account },
  { label: "Saved", href: routes.app.saved },
] as const;

export const portalNav = [
  { label: "Listings", href: routes.app.portalListings },
  { label: "Agency", href: routes.app.portalAgency },
  { label: "Team", href: routes.app.portalAgents },
  { label: "Valuations", href: routes.app.portalValuations },
] as const;

export const adminNav = [
  { label: "Overview", href: routes.admin.home },
  { label: "Agencies", href: routes.admin.agencies },
  { label: "Agents", href: routes.admin.agents },
  { label: "Valuators", href: routes.admin.valuators },
  { label: "Valuations", href: routes.admin.valuations },
  { label: "Properties", href: routes.admin.properties },
  { label: "Listings", href: routes.admin.listings },
] as const;
