import "server-only";

import { createHash } from "crypto";

import type {
  PropertyClaimRequestKind,
  PropertyTransferMode,
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
  property_unit_label: string | null;
  location_source: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  representative_size: number | string | null;
  zoning: string | null;
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
  claim_kind: PropertyClaimRequestKind;
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
  transfer_mode: PropertyTransferMode | null;
  transfer_from_user_id: string | null;
  transfer_from_user_name: string | null;
  buyer_confirmed_at: string | null;
  buyer_declined_at: string | null;
  transfer_note: string | null;
  district: string | null;
  sector: string | null;
}

interface PortalEditablePropertyRow {
  property_internal_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: PropertyKind | null;
  property_unit_label: string | null;
  location_source: string | null;
  parcel_id: string | null;
  upi: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  representative_size: number | string | null;
  zoning: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  year_built: number | string | null;
}

interface PortalBuildingUnitRow {
  property_internal_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: PropertyKind | null;
  property_unit_label: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  year_built: number | string | null;
  owner_user_id: string | null;
  listing_id: string | null;
  listing_status: "draft" | "active" | "inactive" | null;
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
  isListingReady: boolean;
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
  kind: PropertyClaimRequestKind;
  status: SubmissionStatus;
  createdAt: string;
  upi: string;
  claimScope: PropertyClaimScope;
  unitLabel?: string;
  tenureType: PropertyTenureType;
  tenureSource: PropertyDataSource;
  transferMode?: PropertyTransferMode;
  transferFromUserId?: string;
  transferFromUserName?: string;
  buyerConfirmedAt?: string;
  buyerDeclinedAt?: string;
  transferNote?: string;
  propertyInternalId?: string;
  propertyRouteId?: string;
  propertyTitle?: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
}

export interface PortalPropertiesWorkspaceData {
  ownedProperties: PortalOwnedPropertySummary[];
  claimRequests: PortalPropertyClaimSummary[];
}

export interface PortalEditablePropertyRecord {
  propertyInternalId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  unitLabel?: string;
  parcelId?: string;
  upi?: string;
  district: string;
  sector?: string;
  cell?: string;
  village?: string;
  representativeSize?: number;
  zoning?: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqm?: number;
  yearBuilt?: number;
  isListingReady: boolean;
  childUnits: PortalBuildingUnitSummary[];
}

export interface PortalClaimParcelContext {
  propertyRouteId: string;
  existingAssetKind?: PropertyKind;
  representativeSize?: number;
  zoning?: string;
}

export interface PortalBuildingUnitSummary {
  propertyInternalId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  unitLabel?: string;
  propertyType: string;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqm?: number;
  yearBuilt?: number;
  isOwnedByCurrentUser: boolean;
  isClaimed: boolean;
  listingId?: string;
  listingStatus?: "draft" | "active" | "inactive";
}

function normalizePropertyTitle(title: string | null | undefined, routeId: string) {
  return title?.trim() || routeId;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeZoningLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeClaimUnitLabel(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
}

function getDefaultPropertyType(propertyKind?: PropertyKind | null) {
  switch (propertyKind) {
    case "house":
      return "House";
    case "land":
      return "Land";
    case "apartment_building":
      return "Apartment building";
    case "commercial_building":
      return "Commercial building";
    case "apartment_unit":
      return "Apartment unit";
    case "commercial_unit":
      return "Commercial unit";
    default:
      return "Property";
  }
}

function getChildUnitKindForBuilding(propertyKind?: PropertyKind | null) {
  switch (propertyKind) {
    case "apartment_building":
      return "apartment_unit" as const;
    case "commercial_building":
      return "commercial_unit" as const;
    default:
      return undefined;
  }
}

function createBuildingUnitAssetId(buildingInternalId: string, unitLabel: string) {
  return "ast_" + createHash("md5").update(`portal-building-unit:${buildingInternalId}:${unitLabel}`).digest("hex").slice(0, 20);
}

function createBuildingUnitPublicId(parcelId: string, unitLabel: string) {
  return createHash("md5").update(`portal-building-unit-public:${parcelId}:${unitLabel}`).digest("hex").slice(0, 10).toUpperCase();
}

function createBuildingUnitDisplayCode(parcelId: string, unitLabel: string) {
  return "AST-" + createHash("md5").update(`portal-building-unit-display:${parcelId}:${unitLabel}`).digest("hex").slice(0, 10).toUpperCase();
}

async function listChildUnitsForBuilding(buildingInternalId: string, userId: string): Promise<PortalBuildingUnitSummary[]> {
  const result = await getPgPool().query<PortalBuildingUnitRow>(
    `
      SELECT
        child.id AS property_internal_id,
        child.public_id AS property_route_id,
        CASE
          WHEN COALESCE(NULLIF(BTRIM(child.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(child.display_name, child.public_id), ' · ', child.unit_label)
          ELSE COALESCE(child.display_name, child.public_id)
        END AS property_title,
        child.asset_type AS property_kind,
        child.unit_label AS property_unit_label,
        pap.property_type,
        pap.bedrooms,
        pap.bathrooms,
        pap.interior_area_sqm,
        pap.year_built,
        owner.user_id AS owner_user_id,
        listing.id AS listing_id,
        listing.status AS listing_status
      FROM property_asset child
      LEFT JOIN property_asset_profile pap
        ON pap.property_asset_id = child.id
      LEFT JOIN property_ownership owner
        ON owner.property_internal_id = child.id
      LEFT JOIN LATERAL (
        SELECT l.id, l.status
        FROM listing l
        WHERE l.property_asset_id = child.id
          AND l.status IN ('draft', 'active', 'inactive')
        ORDER BY
          CASE WHEN l.status = 'active' THEN 0 WHEN l.status = 'inactive' THEN 1 ELSE 2 END,
          l.updated_at DESC,
          l.created_at DESC,
          l.id DESC
        LIMIT 1
      ) listing
        ON TRUE
      WHERE child.parent_asset_id = $1
      ORDER BY child.unit_label ASC NULLS LAST, child.created_at ASC, child.id ASC
    `,
    [buildingInternalId],
  );

  return result.rows.map((row) => ({
    propertyInternalId: row.property_internal_id,
    propertyRouteId: row.property_route_id,
    propertyTitle: normalizePropertyTitle(row.property_title, row.property_route_id),
    propertyKind: row.property_kind || undefined,
    unitLabel: row.property_unit_label || undefined,
    propertyType: row.property_type || getDefaultPropertyType(row.property_kind),
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    interiorAreaSqm: toNumber(row.interior_area_sqm),
    yearBuilt: toNumber(row.year_built),
    isOwnedByCurrentUser: row.owner_user_id === userId,
    isClaimed: Boolean(row.owner_user_id),
    listingId: row.listing_id || undefined,
    listingStatus: row.listing_status || undefined,
  }));
}

function getRequiredPropertyFacts(input: {
  propertyKind?: PropertyKind | null;
  propertyTitle?: string | null;
  propertyUnitLabel?: string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  interiorAreaSqm?: number | string | null;
  representativeSize?: number | string | null;
  zoning?: string | null;
  locationSource?: string | null;
}) {
  const requiredFacts: string[] = [];
  const hasTitle = Boolean(input.propertyTitle?.trim());
  const hasUnitLabel = Boolean(input.propertyUnitLabel?.trim()) || hasTitle;
  const hasBedrooms = toNumber(input.bedrooms) != null;
  const hasBathrooms = toNumber(input.bathrooms) != null;
  const hasInteriorArea = toNumber(input.interiorAreaSqm) != null;
  const hasRepresentativeSize = toNumber(input.representativeSize) != null;
  const isParcelLinked = !input.locationSource || input.locationSource === "parcel";

  switch (input.propertyKind) {
    case "house":
      if (!hasTitle) requiredFacts.push("display label");
      if (!hasInteriorArea) requiredFacts.push("interior area");
      if (isParcelLinked && !hasRepresentativeSize) requiredFacts.push("parcel size");
      if (!hasBedrooms) requiredFacts.push("bedrooms");
      if (!hasBathrooms) requiredFacts.push("bathrooms");
      break;
    case "apartment_unit":
      if (!hasUnitLabel) requiredFacts.push("unit label");
      if (!hasInteriorArea) requiredFacts.push("interior area");
      if (!hasBedrooms) requiredFacts.push("bedrooms");
      if (!hasBathrooms) requiredFacts.push("bathrooms");
      break;
    case "apartment_building":
    case "commercial_building":
      if (!hasTitle) requiredFacts.push("display label");
      if (!hasInteriorArea) requiredFacts.push("built area");
      if (isParcelLinked && !hasRepresentativeSize) requiredFacts.push("parcel size");
      break;
    case "commercial_unit":
      if (!hasUnitLabel) requiredFacts.push("unit label");
      if (!hasInteriorArea) requiredFacts.push("floor area");
      break;
    case "land":
      if (!hasTitle) requiredFacts.push("display label");
      if (isParcelLinked && !hasRepresentativeSize) requiredFacts.push("parcel size");
      break;
    default:
      if (!hasTitle) requiredFacts.push("display label");
      break;
  }

  return requiredFacts;
}

function isListingReadyForAsset(input: {
  propertyKind?: PropertyKind | null;
  propertyTitle?: string | null;
  propertyUnitLabel?: string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  interiorAreaSqm?: number | string | null;
  representativeSize?: number | string | null;
  zoning?: string | null;
  locationSource?: string | null;
}) {
  return getRequiredPropertyFacts(input).length === 0;
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
          COALESCE(pa.public_id, p.public_id) AS property_route_id,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(pa.display_name, pa.public_id), ' · ', pa.unit_label)
            ELSE COALESCE(pa.display_name, pa.public_id)
          END AS property_title,
          pa.asset_type AS property_kind,
          pa.unit_label AS property_unit_label,
          pa.location_source,
          pap.bedrooms,
          pap.bathrooms,
          pap.interior_area_sqm,
          p.representative_size,
          p.zoning,
          pa.admin_district AS district,
          pa.admin_sector AS sector,
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
        LEFT JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = po.parcel_id
        LEFT JOIN property_asset_profile pap
          ON pap.property_asset_id = pa.id
        LEFT JOIN LATERAL (
          SELECT
            listing.id,
            listing.status,
            listing.visibility,
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
          pcr.request_kind AS claim_kind,
          pcr.status AS claim_status,
          pcr.created_at::TEXT AS claim_created_at,
          pa.id AS property_internal_id,
          COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
            ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
          END AS property_title,
          pa.asset_type AS property_kind,
          pcr.upi,
          pcr.claim_scope,
          pcr.unit_label,
          pcr.tenure_type,
          pcr.tenure_source,
          pcr.transfer_mode,
          pcr.transfer_from_user_id,
          transfer_from.full_name AS transfer_from_user_name,
          pcr.buyer_confirmed_at::TEXT,
          pcr.buyer_declined_at::TEXT,
          pcr.transfer_note,
          p.district,
          p.sector
        FROM property_claim_request pcr
        LEFT JOIN app_user transfer_from
          ON transfer_from.id = pcr.transfer_from_user_id
        LEFT JOIN property_asset pa
          ON pa.id = pcr.property_internal_id
        JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = pcr.parcel_id
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
      isListingReady: isListingReadyForAsset({
        propertyKind: row.property_kind,
        propertyTitle: row.property_title,
        propertyUnitLabel: row.property_unit_label,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        interiorAreaSqm: row.interior_area_sqm,
        representativeSize: row.representative_size,
        zoning: row.zoning,
        locationSource: row.location_source,
      }),
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
      kind: row.claim_kind,
      status: row.claim_status,
      createdAt: row.claim_created_at,
      upi: row.upi,
      claimScope: row.claim_scope,
      unitLabel: row.unit_label || undefined,
      tenureType: row.tenure_type,
      tenureSource: row.tenure_source,
      transferMode: row.transfer_mode || undefined,
      transferFromUserId: row.transfer_from_user_id || undefined,
      transferFromUserName: row.transfer_from_user_name || undefined,
      buyerConfirmedAt: row.buyer_confirmed_at || undefined,
      buyerDeclinedAt: row.buyer_declined_at || undefined,
      transferNote: row.transfer_note || undefined,
      propertyInternalId: row.property_internal_id || undefined,
      propertyRouteId: row.property_route_id || undefined,
      propertyTitle:
        row.property_title && row.property_route_id ? normalizePropertyTitle(row.property_title, row.property_route_id) : undefined,
      propertyKind: row.property_kind || undefined,
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
    })),
  };
}

export async function getPortalClaimParcelContextByUpi(upi: string): Promise<PortalClaimParcelContext | null> {
  const result = await getPgPool().query<{
    parcel_public_id: string;
    property_public_id: string | null;
    asset_type: PropertyKind | null;
    representative_size: number | string | null;
    zoning: string | null;
  }>(
    `
      SELECT
        COALESCE(p.public_id, p.parcel_id) AS parcel_public_id,
        pa.public_id AS property_public_id,
        pa.asset_type,
        p.representative_size,
        p.zoning
      FROM parcel_app_ready_seed_preview p
      LEFT JOIN property_asset pa
        ON pa.parcel_id = p.parcel_id
       AND pa.is_primary_for_parcel = TRUE
       AND pa.seed_source NOT IN (
          'mock_import_listing_surface_v1',
          'preview_property_page_variants_v1',
          'preview_multi_unit_examples_v1',
          'preview_kigali_seed_v1'
        )
      WHERE UPPER(REPLACE(p.upi, ' ', '')) = UPPER(REPLACE($1, ' ', ''))
      LIMIT 1
    `,
    [upi],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    propertyRouteId: row.property_public_id || row.parcel_public_id,
    existingAssetKind: row.asset_type || undefined,
    representativeSize: toNumber(row.representative_size),
    zoning: normalizeZoningLabel(row.zoning),
  };
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
    root_asset_count: string | number;
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
        ,
        (
          SELECT COUNT(*)
          FROM property_asset pa_root
          WHERE pa_root.parcel_id = p.parcel_id
            AND pa_root.parent_asset_id IS NULL
            AND pa_root.seed_source NOT IN (
              'mock_import_listing_surface_v1',
              'preview_property_page_variants_v1',
              'preview_multi_unit_examples_v1',
              'preview_kigali_seed_v1'
            )
        ) AS root_asset_count
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
  const rootAssetCount = Number(parcel.root_asset_count ?? 0);

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
        CASE
          WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
          ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
        END AS property_title,
        pa.asset_type AS property_kind
      FROM property_asset pa
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = pa.parcel_id
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

  if (!resolved || (input.claimScope === "full_parcel" && rootAssetCount !== 1)) {
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

export async function getPortalEditablePropertyRecord(
  userId: string,
  propertyRouteId: string,
): Promise<PortalEditablePropertyRecord | null> {
  const result = await getPgPool().query<PortalEditablePropertyRow>(
    `
      SELECT
        pa.id AS property_internal_id,
        COALESCE(pa.public_id, p.public_id) AS property_route_id,
        CASE
          WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(pa.display_name, pa.public_id), ' · ', pa.unit_label)
          ELSE COALESCE(pa.display_name, pa.public_id)
        END AS property_title,
        pa.asset_type AS property_kind,
        pa.unit_label AS property_unit_label,
        pa.location_source,
        pa.parcel_id,
        p.upi,
        pa.admin_district AS district,
        pa.admin_sector AS sector,
        pa.admin_cell AS cell,
        pa.admin_village AS village,
        p.representative_size,
        p.zoning,
        pap.property_type,
        pap.bedrooms,
        pap.bathrooms,
        pap.interior_area_sqm,
        pap.year_built
      FROM property_ownership po
      JOIN property_asset pa
        ON pa.id = po.property_internal_id
      LEFT JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = pa.parcel_id
      LEFT JOIN property_asset_profile pap
        ON pap.property_asset_id = pa.id
      WHERE po.user_id = $1
        AND (pa.public_id = $2 OR p.public_id = $2)
      ORDER BY
        CASE
          WHEN pa.public_id = $2 THEN 0
          WHEN p.public_id = $2 AND pa.parent_asset_id IS NULL AND pa.is_primary_for_parcel THEN 1
          WHEN p.public_id = $2 AND pa.parent_asset_id IS NULL THEN 2
          ELSE 3
        END,
        po.created_at DESC,
        po.id DESC
      LIMIT 1
    `,
    [userId, propertyRouteId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const childUnits =
    row.property_kind === "apartment_building" || row.property_kind === "commercial_building"
      ? await listChildUnitsForBuilding(row.property_internal_id, userId)
      : [];

  const propertyTitle = normalizePropertyTitle(row.property_title, row.property_route_id);
  const zoning = normalizeZoningLabel(row.zoning);

  return {
    propertyInternalId: row.property_internal_id,
    propertyRouteId: row.property_route_id,
    propertyTitle,
    propertyKind: row.property_kind || undefined,
    unitLabel: row.property_unit_label || undefined,
    parcelId: row.parcel_id || undefined,
    upi: row.upi || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    cell: row.cell || undefined,
    village: row.village || undefined,
    representativeSize: toNumber(row.representative_size),
    zoning,
    propertyType: row.property_type || getDefaultPropertyType(row.property_kind),
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    interiorAreaSqm: toNumber(row.interior_area_sqm),
    yearBuilt: toNumber(row.year_built),
    childUnits,
    isListingReady: isListingReadyForAsset({
      propertyKind: row.property_kind,
      propertyTitle,
      propertyUnitLabel: row.property_unit_label,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      interiorAreaSqm: row.interior_area_sqm,
      representativeSize: row.representative_size,
      zoning,
    }),
  };
}

export async function updatePortalPropertyRecordInDb(input: {
  userId: string;
  propertyRouteId: string;
  unitLabel?: string;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqm?: number;
  yearBuilt?: number;
}) {
  const property = await getPortalEditablePropertyRecord(input.userId, input.propertyRouteId);

  if (!property) {
    throw new Error("Owned property not found");
  }

  const normalizedUnitLabel = input.unitLabel?.trim().toUpperCase() || undefined;
  const representativeSize = property.representativeSize;
  const interiorAreaSqm = input.interiorAreaSqm ?? property.interiorAreaSqm;
  const bedrooms = input.bedrooms ?? property.bedrooms;
  const bathrooms = input.bathrooms ?? property.bathrooms;
  const zoning = property.zoning;
  const unitLabel = normalizedUnitLabel ?? property.unitLabel;
  const yearBuilt = input.yearBuilt ?? property.yearBuilt;

  const missingFacts = getRequiredPropertyFacts({
    propertyKind: property.propertyKind,
    propertyTitle: property.propertyTitle,
    propertyUnitLabel: unitLabel,
    bedrooms,
    bathrooms,
    interiorAreaSqm,
    representativeSize,
    zoning,
  });

  if (missingFacts.length > 0) {
    throw new Error(`Missing property facts: ${missingFacts.join(", ")}`);
  }

  await getPgPool().query(
    `
      UPDATE property_asset
      SET
        unit_label = CASE
          WHEN asset_type IN ('apartment_unit', 'commercial_unit') THEN $2
          ELSE unit_label
        END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [property.propertyInternalId, unitLabel ?? null],
  );

  await getPgPool().query(
    `
      INSERT INTO property_asset_profile (
        property_asset_id,
        created_by_user_id,
        property_type,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_portal_property_details_v1')
      ON CONFLICT (property_asset_id) DO UPDATE
      SET
        created_by_user_id = EXCLUDED.created_by_user_id,
        property_type = EXCLUDED.property_type,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        interior_area_sqm = EXCLUDED.interior_area_sqm,
        year_built = EXCLUDED.year_built,
        seed_source = EXCLUDED.seed_source,
        updated_at = NOW()
    `,
    [
      property.propertyInternalId,
      input.userId,
      property.propertyType,
      bedrooms ?? null,
      bathrooms ?? null,
      interiorAreaSqm ?? null,
      yearBuilt ?? null,
    ],
  );

  return getPortalEditablePropertyRecord(input.userId, input.propertyRouteId);
}

export async function registerPortalBuildingUnitInDb(input: {
  userId: string;
  buildingRouteId: string;
  unitLabel: string;
  interiorAreaSqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
}) {
  const building = await getPortalEditablePropertyRecord(input.userId, input.buildingRouteId);

  if (!building) {
    throw new Error("Owned building not found");
  }

  const unitKind = getChildUnitKindForBuilding(building.propertyKind);
  if (!unitKind) {
    throw new Error("Units can only be registered under apartment or commercial buildings");
  }

  const normalizedUnitLabel = normalizeClaimUnitLabel(input.unitLabel);
  if (!normalizedUnitLabel) {
    throw new Error("Unit label is required");
  }

  const propertyType = getDefaultPropertyType(unitKind);
  const missingFacts = getRequiredPropertyFacts({
    propertyKind: unitKind,
    propertyTitle: building.propertyTitle,
    propertyUnitLabel: normalizedUnitLabel,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    interiorAreaSqm: input.interiorAreaSqm ?? null,
    zoning: building.zoning,
  });

  if (missingFacts.length > 0) {
    throw new Error(`Missing unit facts: ${missingFacts.join(", ")}`);
  }

  const existingResult = await getPgPool().query<{ owner_user_id: string | null }>(
    `
      SELECT owner.user_id AS owner_user_id
      FROM property_asset child
      LEFT JOIN property_ownership owner
        ON owner.property_internal_id = child.id
      WHERE child.parcel_id = $1
        AND UPPER(COALESCE(child.unit_label, '')) = $2
      LIMIT 1
    `,
    [building.parcelId, normalizedUnitLabel],
  );

  if (existingResult.rows[0]) {
    throw new Error(
      existingResult.rows[0].owner_user_id
        ? "A claimed unit with that label already exists on this parcel"
        : "A unit with that label already exists on this parcel",
    );
  }

  if (!building.parcelId) {
    throw new Error("Cannot register units on a direct listing (no parcel)");
  }

  const propertyInternalId = createBuildingUnitAssetId(building.propertyInternalId, normalizedUnitLabel);
  const propertyRouteId = createBuildingUnitPublicId(building.parcelId, normalizedUnitLabel);
  const displayCode = createBuildingUnitDisplayCode(building.parcelId, normalizedUnitLabel);

  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO property_asset (
          id,
          parcel_id,
          parent_asset_id,
          asset_type,
          public_id,
          display_code,
          unit_label,
          is_primary_for_parcel,
          seed_source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 'manual_building_unit_registration_v1')
      `,
      [
        propertyInternalId,
        building.parcelId,
        building.propertyInternalId,
        unitKind,
        propertyRouteId,
        displayCode,
        normalizedUnitLabel,
      ],
    );

    await client.query(
      `
        INSERT INTO property_asset_profile (
          property_asset_id,
          created_by_user_id,
          property_type,
          bedrooms,
          bathrooms,
          interior_area_sqm,
          year_built,
          seed_source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_building_unit_registration_v1')
      `,
      [
        propertyInternalId,
        input.userId,
        propertyType,
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.interiorAreaSqm ?? null,
        input.yearBuilt ?? null,
      ],
    );

    await client.query(
      `
        INSERT INTO property_ownership (
          id,
          user_id,
          property_id,
          property_internal_id,
          parcel_id,
          ownership_scope,
          seed_source
        )
        VALUES ($1, $2, $3, $4, $5, 'unit', 'manual_building_unit_registration_v1')
      `,
      [`property-ownership-${propertyInternalId}`, input.userId, propertyRouteId, propertyInternalId, building.parcelId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getPortalEditablePropertyRecord(input.userId, input.buildingRouteId);
}
