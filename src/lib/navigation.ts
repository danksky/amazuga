import { routes } from "./routes";

export const publicTopNav = [
  { label: "Buy", href: routes.public.buy },
  { label: "Rent", href: routes.public.rent },
  { label: "Advertise", href: routes.onboarding.agent },
  { label: "Assess", href: routes.onboarding.valuator },
] as const;

export const accountNav = [
  { label: "Account", href: routes.app.account },
  { label: "Saved", href: routes.app.saved },
] as const;

export const portalNav = [
  { label: "Overview", href: routes.app.portal },
  { label: "Listings", href: routes.app.portalListings },
  { label: "Valuations", href: routes.app.portalValuations },
  { label: "Agency", href: routes.app.portalAgency },
  { label: "Agents", href: routes.app.portalAgents },
  { label: "Profile", href: routes.app.portalProfile },
  { label: "Settings", href: routes.app.portalSettings },
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
