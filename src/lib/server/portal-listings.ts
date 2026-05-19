import "server-only";

import type { AgencyMembershipRole, Listing } from "@/types/domain";

import { listAgenciesFromDb } from "./workflows";
import { getPgPool } from "./postgres";

interface PortalListingRow {
  listing_id: string;
  listing_status: Listing["status"];
  marketing_type: Listing["marketingType"];
  asking_price_rwf: number | string;
  currency: Listing["currency"];
  listing_created_at: string;
  listing_updated_at: string;
  listing_published_at: string | null;
  agency_id: string | null;
  agent_user_id: string;
  agent_full_name: string;
  public_id: string;
  district: string | null;
  sector: string | null;
  property_internal_id: string | null;
  property_public_id: string | null;
  property_kind: string | null;
  property_title: string | null;
  property_description_override: string | null;
  profile_title: string | null;
  profile_description: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
}

export interface PortalAgencyAccessSummary {
  agencyId: string;
  slug: string;
  businessName: string;
  membershipRole: AgencyMembershipRole;
  totalListings: number;
  assignedToUserCount: number;
}

export interface PortalListingSummary {
  id: string;
  propertyId: string;
  propertyInternalId?: string;
  propertyTitle: string;
  propertyDescription?: string;
  propertyType: string;
  propertyKind?: string;
  district: string;
  sector?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
  status: Listing["status"];
  marketingType: Listing["marketingType"];
  askingPrice: number;
  currency: Listing["currency"];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  agencyId?: string;
  agentUserId: string;
  agentFullName: string;
  isAssignedToCurrentUser: boolean;
}

export interface PortalListingsWorkspaceData {
  agencies: PortalAgencyAccessSummary[];
  listings: PortalListingSummary[];
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function normalizePropertyType(row: PortalListingRow) {
  return row.property_type || row.property_kind || "Property";
}

function normalizePropertyTitle(row: PortalListingRow) {
  return row.property_title || row.profile_title || row.public_id || "Untitled property";
}

function normalizePropertyDescription(row: PortalListingRow) {
  return row.property_description_override || row.profile_description || undefined;
}

export async function getPortalListingsWorkspaceData(userId: string): Promise<PortalListingsWorkspaceData> {
  const agencies = (await listAgenciesFromDb()).filter(
    (agency) =>
      agency.status === "approved" &&
      (agency.managerUserId === userId || agency.memberUserIds.includes(userId)),
  );

  const agencyIds = agencies.map((agency) => agency.id);
  const result = await getPgPool().query<PortalListingRow>(
    `
      SELECT
        l.id AS listing_id,
        l.status AS listing_status,
        l.marketing_type,
        l.asking_price_rwf,
        l.currency,
        l.created_at::TEXT AS listing_created_at,
        l.updated_at::TEXT AS listing_updated_at,
        l.published_at::TEXT AS listing_published_at,
        l.agency_id,
        l.agent_user_id,
        agent.full_name AS agent_full_name,
        p.public_id,
        p.district,
        p.sector,
        pa.id AS property_internal_id,
        pa.public_id AS property_public_id,
        pa.asset_type AS property_kind,
        pa.title AS property_title,
        pa.description AS property_description_override,
        pp.title AS profile_title,
        pp.description AS profile_description,
        COALESCE(
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'land' THEN 'Parcel'
            WHEN 'building' THEN 'Building'
            WHEN 'apartment_unit' THEN 'Apartment'
            WHEN 'commercial_unit' THEN 'Commercial'
            WHEN 'mixed_use' THEN 'Mixed Use'
            ELSE NULL
          END,
          pp.property_type
        ) AS property_type,
        pp.bedrooms,
        pp.bathrooms,
        pp.interior_area_sqm
      FROM listing l
      JOIN app_user agent
        ON agent.id = l.agent_user_id
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = l.parcel_id
      WHERE
        (array_length($1::TEXT[], 1) > 0 AND l.agency_id = ANY($1::TEXT[]))
        OR (
          l.agency_id IS NULL
          AND EXISTS (
            SELECT 1 FROM property_ownership po
            WHERE po.user_id = $2
              AND po.property_internal_id = l.property_asset_id
          )
        )
      ORDER BY
        l.agency_id ASC NULLS LAST,
        (l.agent_user_id = $2) DESC,
        l.published_at DESC NULLS LAST,
        l.created_at DESC,
        l.id ASC
    `,
    [agencyIds, userId],
  );

  const listings = result.rows.map((row) => ({
    id: row.listing_id,
    propertyId: row.property_public_id || row.public_id,
    propertyInternalId: row.property_internal_id || undefined,
    propertyTitle: normalizePropertyTitle(row),
    propertyDescription: normalizePropertyDescription(row),
    propertyType: normalizePropertyType(row),
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    bedrooms: toNullableNumber(row.bedrooms),
    bathrooms: toNullableNumber(row.bathrooms),
    areaSqm: toNullableNumber(row.interior_area_sqm),
    status: row.listing_status,
    marketingType: row.marketing_type,
    askingPrice: toNullableNumber(row.asking_price_rwf) ?? 0,
    currency: row.currency,
    createdAt: row.listing_created_at,
    updatedAt: row.listing_updated_at,
    publishedAt: row.listing_published_at || undefined,
    agencyId: row.agency_id ?? undefined,
    agentUserId: row.agent_user_id,
    agentFullName: row.agent_full_name,
    isAssignedToCurrentUser: row.agent_user_id === userId,
  }));

  const agencySummaries = agencies.map((agency) => {
    const agencyListings = listings.filter((listing) => listing.agencyId === agency.id);

    return {
      agencyId: agency.id,
      slug: agency.slug,
      businessName: agency.businessName,
      membershipRole: agency.managerUserId === userId ? "manager" : "agent",
      totalListings: agencyListings.length,
      assignedToUserCount: agencyListings.filter((listing) => listing.isAssignedToCurrentUser).length,
    } satisfies PortalAgencyAccessSummary;
  });

  return {
    agencies: agencySummaries,
    listings,
  };
}
