import type { Role } from "./domain";

export type Capability =
  | "save_property"
  | "search_upi"
  | "apply_agent"
  | "apply_valuator"
  | "submit_agency"
  | "join_agency"
  | "leave_agency"
  | "manage_agency_members"
  | "transfer_agency_manager"
  | "create_listing"
  | "edit_listing"
  | "deactivate_listing"
  | "submit_valuation"
  | "review_submissions"
  | "access_admin";

export const roleCapabilities: Record<Role, Capability[]> = {
  user: ["save_property", "search_upi", "apply_agent", "apply_valuator", "submit_agency"],
  agent: [
    "save_property",
    "search_upi",
    "apply_agent",
    "apply_valuator",
    "submit_agency",
    "join_agency",
    "leave_agency",
    "create_listing",
    "edit_listing",
    "deactivate_listing",
  ],
  agency_manager: [
    "save_property",
    "search_upi",
    "apply_agent",
    "apply_valuator",
    "manage_agency_members",
    "transfer_agency_manager",
    "create_listing",
    "edit_listing",
    "deactivate_listing",
  ],
  valuator: [
    "save_property",
    "search_upi",
    "apply_agent",
    "apply_valuator",
    "submit_agency",
    "submit_valuation",
  ],
  private_lister: ["save_property", "create_listing", "edit_listing", "deactivate_listing"],
  admin: [
    "save_property",
    "search_upi",
    "apply_agent",
    "apply_valuator",
    "submit_agency",
    "join_agency",
    "leave_agency",
    "manage_agency_members",
    "transfer_agency_manager",
    "create_listing",
    "edit_listing",
    "deactivate_listing",
    "submit_valuation",
    "review_submissions",
    "access_admin",
  ],
};

export function hasCapability(roles: Role[], capability: Capability): boolean {
  return roles.some((role) => (roleCapabilities[role] ?? []).includes(capability));
}
