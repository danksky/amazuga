import "server-only";

import type { PropertyKind, SubmissionStatus } from "@/types/domain";

import { getPgPool } from "./postgres";

interface PortalOwnedPropertyRow {
  ownership_id: string;
  ownership_scope: "full" | "unit";
  ownership_created_at: string;
  property_internal_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: PropertyKind | null;
  district: string | null;
  sector: string | null;
  listing_id: string | null;
  listing_status: "active" | "inactive" | null;
  agency_id: string | null;
  agency_name: string | null;
}

interface PortalClaimRequestRow {
  claim_id: string;
  claim_status: SubmissionStatus;
  claim_created_at: string;
  property_internal_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: PropertyKind | null;
  district: string | null;
  sector: string | null;
}

export interface PortalOwnedPropertySummary {
  ownershipId: string;
  ownershipScope: "full" | "unit";
  createdAt: string;
  propertyInternalId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  listingId?: string;
  listingStatus?: "active" | "inactive";
  listingAgencyId?: string;
  listingAgencyName?: string;
}

export interface PortalPropertyClaimSummary {
  id: string;
  status: SubmissionStatus;
  createdAt: string;
  propertyInternalId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
}

export interface PortalPropertiesWorkspaceData {
  ownedProperties: PortalOwnedPropertySummary[];
  claimRequests: PortalPropertyClaimSummary[];
}

function normalizePropertyTitle(title: string | null | undefined, routeId: string) {
  return title?.trim() || routeId;
}

export async function getPortalPropertiesWorkspaceData(userId: string): Promise<PortalPropertiesWorkspaceData> {
  const [ownershipResult, claimResult] = await Promise.all([
    getPgPool().query<PortalOwnedPropertyRow>(
      `
        SELECT
          po.id AS ownership_id,
          po.ownership_scope,
          po.created_at::TEXT AS ownership_created_at,
          pa.id AS property_internal_id,
          COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
          COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
          pa.asset_type AS property_kind,
          p.district,
          p.sector,
          l.id AS listing_id,
          l.status AS listing_status,
          l.agency_id,
          agency.business_name AS agency_name
        FROM property_ownership po
        JOIN property_asset pa
          ON pa.id = po.property_internal_id
        JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = po.parcel_id
        LEFT JOIN property_profile pp
          ON pp.parcel_id = po.parcel_id
        LEFT JOIN LATERAL (
          SELECT
            listing.id,
            listing.status,
            listing.agency_id
          FROM listing
          WHERE listing.property_asset_id = pa.id
            AND listing.status IN ('active', 'inactive')
          ORDER BY
            CASE WHEN listing.status = 'active' THEN 0 ELSE 1 END,
            listing.updated_at DESC,
            listing.created_at DESC,
            listing.id DESC
          LIMIT 1
        ) l
          ON TRUE
        LEFT JOIN agency
          ON agency.id = l.agency_id
        WHERE po.user_id = $1
        ORDER BY po.created_at DESC, po.id DESC
      `,
      [userId],
    ),
    getPgPool().query<PortalClaimRequestRow>(
      `
        SELECT
          pcr.id AS claim_id,
          pcr.status AS claim_status,
          pcr.created_at::TEXT AS claim_created_at,
          pa.id AS property_internal_id,
          COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
          COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
          pa.asset_type AS property_kind,
          p.district,
          p.sector
        FROM property_claim_request pcr
        JOIN property_asset pa
          ON pa.id = pcr.property_internal_id
        JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = pcr.parcel_id
        LEFT JOIN property_profile pp
          ON pp.parcel_id = pcr.parcel_id
        WHERE pcr.user_id = $1
          AND pcr.status <> 'approved'
        ORDER BY pcr.created_at DESC, pcr.id DESC
      `,
      [userId],
    ),
  ]);

  return {
    ownedProperties: ownershipResult.rows.map((row) => ({
      ownershipId: row.ownership_id,
      ownershipScope: row.ownership_scope,
      createdAt: row.ownership_created_at,
      propertyInternalId: row.property_internal_id,
      propertyRouteId: row.property_route_id,
      propertyTitle: normalizePropertyTitle(row.property_title, row.property_route_id),
      propertyKind: row.property_kind || undefined,
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
      listingId: row.listing_id || undefined,
      listingStatus: row.listing_status || undefined,
      listingAgencyId: row.agency_id || undefined,
      listingAgencyName: row.agency_name || undefined,
    })),
    claimRequests: claimResult.rows.map((row) => ({
      id: row.claim_id,
      status: row.claim_status,
      createdAt: row.claim_created_at,
      propertyInternalId: row.property_internal_id,
      propertyRouteId: row.property_route_id,
      propertyTitle: normalizePropertyTitle(row.property_title, row.property_route_id),
      propertyKind: row.property_kind || undefined,
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
    })),
  };
}
