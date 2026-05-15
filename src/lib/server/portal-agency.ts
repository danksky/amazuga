import "server-only";

import type { AgencyMembershipRole } from "@/types/domain";

import { getPgPool } from "./postgres";
import { listAgenciesFromDb } from "./workflows";

interface AgencyMemberRow {
  agency_id: string;
  user_id: string;
  full_name: string;
  email: string;
  membership_role: AgencyMembershipRole;
  app_roles: string[];
  listing_count: number | string;
}

export interface PortalAgencyMemberSummary {
  userId: string;
  fullName: string;
  email: string;
  membershipRole: AgencyMembershipRole;
  appRoles: string[];
  listingCount: number;
  isCurrentUser: boolean;
  isAgencyManager: boolean;
}

export interface PortalAgencyWorkspace {
  agencyId: string;
  slug: string;
  businessName: string;
  tin: string;
  whatsappPhone?: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
  membershipRole: AgencyMembershipRole;
  totalMembers: number;
  managerName?: string;
  pendingManagerName?: string;
  totalListings: number;
  assignedToUserCount: number;
  saleListingsCount: number;
  rentListingsCount: number;
  members: PortalAgencyMemberSummary[];
}

export interface PortalAgencyWorkspaceData {
  agencies: PortalAgencyWorkspace[];
}

function toInteger(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getUsersByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { fullName: string; email: string }>();
  }

  const result = await getPgPool().query<{ id: string; full_name: string; email: string }>(
    `
      SELECT id, full_name, email
      FROM app_user
      WHERE id = ANY($1::TEXT[])
    `,
    [userIds],
  );

  return new Map(result.rows.map((row) => [row.id, { fullName: row.full_name, email: row.email }]));
}

async function getAgencyMembers(agencyIds: string[]) {
  if (agencyIds.length === 0) {
    return [] satisfies AgencyMemberRow[];
  }

  const result = await getPgPool().query<AgencyMemberRow>(
    `
      SELECT
        am.agency_id,
        am.user_id,
        u.full_name,
        u.email,
        am.role AS membership_role,
        u.roles AS app_roles,
        COUNT(l.id)::INT AS listing_count
      FROM agency_membership am
      JOIN app_user u
        ON u.id = am.user_id
      LEFT JOIN listing l
        ON l.agency_id = am.agency_id
       AND l.agent_user_id = am.user_id
      WHERE am.agency_id = ANY($1::TEXT[])
        AND am.status = 'active'
      GROUP BY
        am.agency_id,
        am.user_id,
        u.full_name,
        u.email,
        am.role,
        u.roles
      ORDER BY
        am.agency_id ASC,
        CASE am.role
          WHEN 'manager' THEN 0
          ELSE 1
        END,
        u.full_name ASC
    `,
    [agencyIds],
  );

  return result.rows;
}

async function getListingCountsByAgency(agencyIds: string[], userId: string) {
  if (agencyIds.length === 0) {
    return new Map<
      string,
      {
        totalListings: number;
        assignedToUserCount: number;
        saleListingsCount: number;
        rentListingsCount: number;
      }
    >();
  }

  const result = await getPgPool().query<{
    agency_id: string;
    total_listings: number | string;
    assigned_to_user_count: number | string;
    sale_listings_count: number | string;
    rent_listings_count: number | string;
  }>(
    `
      SELECT
        l.agency_id,
        COUNT(*)::INT AS total_listings,
        COUNT(*) FILTER (WHERE l.agent_user_id = $2)::INT AS assigned_to_user_count,
        COUNT(*) FILTER (WHERE l.marketing_type = 'sale')::INT AS sale_listings_count,
        COUNT(*) FILTER (WHERE l.marketing_type = 'rent')::INT AS rent_listings_count
      FROM listing l
      WHERE l.agency_id = ANY($1::TEXT[])
      GROUP BY l.agency_id
    `,
    [agencyIds, userId],
  );

  return new Map(
    result.rows.map((row) => [
      row.agency_id,
      {
        totalListings: toInteger(row.total_listings),
        assignedToUserCount: toInteger(row.assigned_to_user_count),
        saleListingsCount: toInteger(row.sale_listings_count),
        rentListingsCount: toInteger(row.rent_listings_count),
      },
    ]),
  );
}

export async function getPortalAgencyWorkspaceData(userId: string): Promise<PortalAgencyWorkspaceData> {
  const accessibleAgencies = (await listAgenciesFromDb()).filter(
    (agency) =>
      agency.status === "approved" &&
      (agency.managerUserId === userId || agency.memberUserIds.includes(userId)),
  );

  if (accessibleAgencies.length === 0) {
    return { agencies: [] };
  }

  const agencyIds = accessibleAgencies.map((agency) => agency.id);
  const [memberRows, listingCountsByAgency, relatedUsers] = await Promise.all([
    getAgencyMembers(agencyIds),
    getListingCountsByAgency(agencyIds, userId),
    getUsersByIds(
      accessibleAgencies.flatMap((agency) =>
        [agency.managerUserId, agency.pendingManagerUserId].filter((value): value is string => Boolean(value)),
      ),
    ),
  ]);

  const membersByAgencyId = new Map<string, PortalAgencyMemberSummary[]>();
  for (const row of memberRows) {
    const members = membersByAgencyId.get(row.agency_id) ?? [];
    members.push({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      membershipRole: row.membership_role,
      appRoles: row.app_roles,
      listingCount: toInteger(row.listing_count),
      isCurrentUser: row.user_id === userId,
      isAgencyManager: row.membership_role === "manager",
    });
    membersByAgencyId.set(row.agency_id, members);
  }

  return {
    agencies: accessibleAgencies.map((agency) => {
      const listingCounts = listingCountsByAgency.get(agency.id) ?? {
        totalListings: 0,
        assignedToUserCount: 0,
        saleListingsCount: 0,
        rentListingsCount: 0,
      };
      const members = membersByAgencyId.get(agency.id) ?? [];
      const managerUser = agency.managerUserId ? relatedUsers.get(agency.managerUserId) : undefined;
      const pendingManagerUser = agency.pendingManagerUserId ? relatedUsers.get(agency.pendingManagerUserId) : undefined;

      return {
        agencyId: agency.id,
        slug: agency.slug,
        businessName: agency.businessName,
        tin: agency.tin,
        whatsappPhone: agency.whatsappPhone,
        websiteUrl: agency.websiteUrl,
        googleMapsUrl: agency.googleMapsUrl,
        membershipRole: agency.managerUserId === userId ? "manager" : "agent",
        totalMembers: members.length,
        managerName: managerUser?.fullName,
        pendingManagerName:
          agency.pendingManagerUserId && agency.pendingManagerUserId !== agency.managerUserId
            ? pendingManagerUser?.fullName
            : undefined,
        totalListings: listingCounts.totalListings,
        assignedToUserCount: listingCounts.assignedToUserCount,
        saleListingsCount: listingCounts.saleListingsCount,
        rentListingsCount: listingCounts.rentListingsCount,
        members,
      } satisfies PortalAgencyWorkspace;
    }),
  };
}
