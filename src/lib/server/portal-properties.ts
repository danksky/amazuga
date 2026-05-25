import "server-only";

import type {
  ListingVisibility,
  PropertyClaimScope,
  PropertyDataSource,
  PropertyKind,
  PropertyTenureType,
  SubmissionStatus,
} from "@/types/domain";

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
  listing_status: "draft" | "active" | "inactive" | null;
  listing_visibility: ListingVisibility | null;
  listing_asking_price: number | string | null;
  listing_marketing_type: "sale" | "rent" | null;
  agency_id: string | null;
  agency_name: string | null;
  first_image_url: string | null;
}

interface PortalClaimRequestRow {
  claim_id: string;
  claim_status: SubmissionStatus;
  claim_created_at: string;
  property_internal_id: string | null;
  property_route_id: string | null;
  property_title: string | null;
  property_kind: PropertyKind | null;
  upi: string;
  claim_scope: PropertyClaimScope;
  unit_label: string | null;
  tenure_type: PropertyTenureType;
  tenure_source: PropertyDataSource;
  district: string | null;
  sector: string | null;
}

interface PortalClaimableParcelRow {
  parcel_id: string;
  upi: string;
  district: string | null;
  sector: string | null;
  asset_count_for_parcel: string | number;
  active_listing_count: string | number;
  ownership_conflict_count: string | number;
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
  listingStatus?: "draft" | "active" | "inactive";
  listingVisibility?: ListingVisibility;
  listingAskingPrice?: number;
  listingMarketingType?: "sale" | "rent";
  listingAgencyId?: string;
  listingAgencyName?: string;
  firstImageUrl?: string;
}

export interface PortalPropertyClaimSummary {
  id: string;
  status: SubmissionStatus;
  createdAt: string;
  upi: string;
  claimScope: PropertyClaimScope;
  unitLabel?: string;
  tenureType: PropertyTenureType;
  tenureSource: PropertyDataSource;
  propertyInternalId?: string;
  propertyRouteId?: string;
  propertyTitle?: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
}

export interface PortalClaimableParcelSummary {
  parcelId: string;
  upi: string;
  district: string;
  sector?: string;
  assetCount: number;
  activeListingCount: number;
  hasOwnershipConflict: boolean;
}

export interface PortalPropertiesWorkspaceData {
  ownedProperties: PortalOwnedPropertySummary[];
  claimRequests: PortalPropertyClaimSummary[];
  claimExamples: PortalClaimableParcelSummary[];
}

function normalizePropertyTitle(title: string | null | undefined, routeId: string) {
  return title?.trim() || routeId;
}

export async function getPortalPropertiesWorkspaceData(userId: string): Promise<PortalPropertiesWorkspaceData> {
  const [ownershipResult, claimResult, claimExamplesResult] = await Promise.all([
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
          l.visibility AS listing_visibility,
          l.asking_price_rwf AS listing_asking_price,
          l.marketing_type AS listing_marketing_type,
          l.agency_id,
          agency.business_name AS agency_name,
          l.first_image_url
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
            listing.asking_price_rwf,
            listing.marketing_type,
            listing.agency_id,
            (
              SELECT image_url
              FROM listing_image
              WHERE listing_id = listing.id AND status = 'ready'
              ORDER BY sort_order ASC
              LIMIT 1
            ) AS first_image_url
          FROM listing
          WHERE listing.property_asset_id = pa.id
            AND listing.status IN ('draft', 'active', 'inactive')
          ORDER BY
            CASE WHEN listing.status = 'active' THEN 0 WHEN listing.status = 'inactive' THEN 1 ELSE 2 END,
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
          pcr.upi,
          pcr.claim_scope,
          pcr.unit_label,
          pcr.tenure_type,
          pcr.tenure_source,
          p.district,
          p.sector
        FROM property_claim_request pcr
        LEFT JOIN property_asset pa
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
    getPgPool().query<PortalClaimableParcelRow>(
      `
        SELECT
          pa.parcel_id,
          p.upi,
          p.district,
          p.sector,
          1 AS asset_count_for_parcel,
          COALESCE(lc.active_count, 0) AS active_listing_count,
          0 AS ownership_conflict_count
        FROM property_asset pa
        JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = pa.parcel_id
        LEFT JOIN (
          SELECT pa2.parcel_id, COUNT(*) AS active_count
          FROM listing l
          JOIN property_asset pa2
            ON pa2.id = l.property_asset_id
          WHERE l.status = 'active'
          GROUP BY pa2.parcel_id
        ) lc ON lc.parcel_id = pa.parcel_id
        WHERE pa.is_primary_for_parcel = TRUE
          AND NOT EXISTS (
            SELECT 1
            FROM property_ownership po
            WHERE po.parcel_id = pa.parcel_id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM property_claim_request pcr
            WHERE pcr.parcel_id = pa.parcel_id
              AND pcr.status = 'pending'
          )
        ORDER BY p.public_id DESC
        LIMIT 20
      `,
      [],
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
      listingVisibility: row.listing_visibility || undefined,
      listingAskingPrice: row.listing_asking_price ? Number(row.listing_asking_price) : undefined,
      listingMarketingType: row.listing_marketing_type || undefined,
      listingAgencyId: row.agency_id || undefined,
      listingAgencyName: row.agency_name || undefined,
      firstImageUrl: row.first_image_url ?? undefined,
    })),
    claimRequests: claimResult.rows.map((row) => ({
      id: row.claim_id,
      status: row.claim_status,
      createdAt: row.claim_created_at,
      upi: row.upi,
      claimScope: row.claim_scope,
      unitLabel: row.unit_label || undefined,
      tenureType: row.tenure_type,
      tenureSource: row.tenure_source,
      propertyInternalId: row.property_internal_id || undefined,
      propertyRouteId: row.property_route_id || undefined,
      propertyTitle:
        row.property_title && row.property_route_id ? normalizePropertyTitle(row.property_title, row.property_route_id) : undefined,
      propertyKind: row.property_kind || undefined,
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
    })),
    claimExamples: claimExamplesResult.rows.map((row) => ({
      parcelId: row.parcel_id,
      upi: row.upi,
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
      assetCount: Number(row.asset_count_for_parcel || 0),
      activeListingCount: Number(row.active_listing_count || 0),
      hasOwnershipConflict: Number(row.ownership_conflict_count || 0) > 0,
    })),
  };
}

export async function findPrimaryAssetKindByUpi(upi: string): Promise<PropertyKind | null> {
  const result = await getPgPool().query<{ asset_type: PropertyKind | null }>(
    `
      SELECT pa.asset_type
      FROM parcel_app_ready_seed_preview p
      JOIN property_asset pa
        ON pa.parcel_id = p.parcel_id
       AND pa.is_primary_for_parcel = TRUE
      WHERE UPPER(REPLACE(p.upi, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
        AND pa.seed_source NOT IN (
          'mock_import_listing_surface_v1',
          'preview_property_page_variants_v1',
          'preview_multi_unit_examples_v1',
          'preview_kigali_seed_v1'
        )
      LIMIT 1
    `,
    [upi],
  );
  return result.rows[0]?.asset_type ?? null;
}

export async function findPortalPropertyClaimTargetByUpi(input: {
  upi: string;
  claimScope: PropertyClaimScope;
  unitLabel?: string;
}): Promise<
  | {
      status: "resolved";
      parcelId: string;
      upi: string;
      district: string;
      sector?: string;
      propertyInternalId: string;
      propertyRouteId: string;
      propertyTitle: string;
      propertyKind?: PropertyKind;
    }
  | {
      status: "parcel_only";
      upi: string;
      parcelId: string;
      district: string;
      sector?: string;
      assetCount: number;
    }
  | null
> {
  const normalizedUpi = input.upi.trim();
  const normalizedUnitLabel = input.unitLabel?.trim().toUpperCase();

  if (!normalizedUpi) {
    return null;
  }

  const parcelResult = await getPgPool().query<{
    parcel_id: string;
    upi: string;
    district: string | null;
    sector: string | null;
    asset_count_for_parcel: string | number;
  }>(
    `
      SELECT
        p.parcel_id,
        p.upi,
        p.district,
        p.sector,
        (
          SELECT COUNT(*)
          FROM property_asset pa_count
          WHERE pa_count.parcel_id = p.parcel_id
            AND pa_count.seed_source NOT IN (
              'mock_import_listing_surface_v1',
              'preview_property_page_variants_v1',
              'preview_multi_unit_examples_v1',
              'preview_kigali_seed_v1'
            )
        ) AS asset_count_for_parcel
      FROM parcel_app_ready_seed_preview p
      WHERE UPPER(REPLACE(p.upi, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
      LIMIT 1
    `,
    [normalizedUpi],
  );

  const parcel = parcelResult.rows[0];

  if (!parcel) {
    return null;
  }

  const assetCount = Number(parcel.asset_count_for_parcel ?? 0);

  const resolutionResult = await getPgPool().query<{
    property_internal_id: string;
    property_route_id: string;
    property_title: string | null;
    property_kind: PropertyKind | null;
  }>(
    `
      SELECT
        pa.id AS property_internal_id,
        COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
        pa.asset_type AS property_kind
      FROM property_asset pa
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = pa.parcel_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = pa.parcel_id
      WHERE pa.parcel_id = $1
        AND pa.seed_source NOT IN (
          'mock_import_listing_surface_v1',
          'preview_property_page_variants_v1',
          'preview_multi_unit_examples_v1',
          'preview_kigali_seed_v1'
        )
        AND (
          ($2 = 'unit_partial' AND $3::TEXT IS NOT NULL AND UPPER(COALESCE(pa.unit_label, '')) = $3)
          OR ($2 = 'full_parcel')
        )
      ORDER BY
        CASE
          WHEN $2 = 'unit_partial' THEN 0
          WHEN pa.is_primary_for_parcel THEN 0
          ELSE 1
        END,
        pa.created_at ASC,
        pa.id ASC
      LIMIT 1
    `,
    [parcel.parcel_id, input.claimScope, normalizedUnitLabel || null],
  );

  const resolved = resolutionResult.rows[0];

  if (!resolved || (input.claimScope === "full_parcel" && assetCount !== 1)) {
    return {
      status: "parcel_only",
      upi: parcel.upi,
      parcelId: parcel.parcel_id,
      district: parcel.district || "Unknown district",
      sector: parcel.sector || undefined,
      assetCount,
    };
  }

  return {
    status: "resolved",
    parcelId: parcel.parcel_id,
    upi: parcel.upi,
    district: parcel.district || "Unknown district",
    sector: parcel.sector || undefined,
    propertyInternalId: resolved.property_internal_id,
    propertyRouteId: resolved.property_route_id,
    propertyTitle: normalizePropertyTitle(resolved.property_title, resolved.property_route_id),
    propertyKind: resolved.property_kind || undefined,
  };
}
