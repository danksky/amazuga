import "server-only";

import { createHash } from "crypto";

import type {
  Agency,
  AgencyApplication,
  AgentApplication,
  PropertyClaimScope,
  PropertyClaimRequestKind,
  PropertyClaimPropertyType,
  PropertyDataSource,
  PropertyClaimRequest,
  PropertyRecordFactsInput,
  PropertyKind,
  PropertyOwnership,
  PropertyOwnershipScope,
  PropertyTenureType,
  PropertyTransferMode,
  Role,
  SubmissionStatus,
  ValuationSubmission,
  ValuatorApplication,
} from "@/types/domain";

import { getPgPool } from "./postgres";

type ApplicationKind = "agency" | "agent" | "valuator";

interface AgencyRow {
  id: string;
  slug: string;
  created_from_application_id: string | null;
  business_name: string;
  tin: string;
  whatsapp_phone: string | null;
  website_url: string | null;
  google_maps_url: string | null;
  status: Agency["status"];
  pending_manager_user_id: string | null;
  manager_user_id: string | null;
  member_user_ids: string[] | null;
}

interface AgencyApplicationRow {
  id: string;
  created_by_user_id: string;
  business_name: string;
  tin: string;
  website_url: string | null;
  google_maps_url: string | null;
  status: SubmissionStatus;
  created_at: string;
}

interface AgentApplicationRow {
  id: string;
  user_id: string;
  national_id_photo_url: string;
  selected_agency_id: string | null;
  status: SubmissionStatus;
  created_at: string;
}

interface ValuatorApplicationRow {
  id: string;
  user_id: string;
  irpv_registration_number: string;
  status: SubmissionStatus;
  created_at: string;
}

interface PropertyClaimRequestRow {
  id: string;
  user_id: string;
  request_kind: PropertyClaimRequestKind;
  property_id: string | null;
  property_internal_id: string | null;
  parcel_id: string;
  upi: string;
  claim_scope: PropertyClaimScope;
  unit_label: string | null;
  declared_property_type?: PropertyClaimPropertyType | null;
  tenure_type: PropertyTenureType;
  tenure_source: PropertyDataSource;
  declared_asset_type: PropertyKind | null;
  representative_size: number | string | null;
  zoning: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  year_built: number | string | null;
  description: string | null;
  transfer_mode: PropertyTransferMode | null;
  transfer_from_user_id: string | null;
  transfer_initiated_by_user_id: string | null;
  buyer_confirmed_at: string | null;
  buyer_declined_at: string | null;
  transfer_note: string | null;
  status: SubmissionStatus;
  created_at: string;
}

interface PropertyOwnershipRow {
  id: string;
  user_id: string;
  property_id: string;
  property_internal_id: string;
  parcel_id: string;
  ownership_scope: PropertyOwnershipScope;
  created_at: string;
}

interface PropertyRecordBackfillRow {
  asset_type: PropertyKind | null;
  unit_label: string | null;
  parcel_id: string;
  display_id: string | null;
  parcel_public_id: string | null;
  district: string | null;
  sector: string | null;
  representative_size: number | string | null;
  zoning: string | null;
}

interface AdminPropertyClaimRequestRow extends PropertyClaimRequestRow {
  property_route_id: string | null;
  property_title: string | null;
  property_kind: PropertyKind | null;
  district: string | null;
  sector: string | null;
  user_full_name: string | null;
  transfer_from_user_full_name: string | null;
  transfer_from_user_email: string | null;
  current_owner_user_id: string | null;
  current_owner_full_name: string | null;
  asset_count_for_parcel: string | number;
  conflicting_ownership_id: string | null;
  conflicting_owner_full_name: string | null;
  conflicting_ownership_scope: PropertyOwnershipScope | null;
  conflicting_property_title: string | null;
}

export interface AdminPropertyClaimRequest extends PropertyClaimRequest {
  propertyRouteId?: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  userFullName: string;
  transferFromUserFullName?: string;
  transferFromUserEmail?: string;
  currentOwnerUserId?: string;
  currentOwnerFullName?: string;
  approvalBlockedReason?: string;
}

interface UserPropertyRelationship {
  ownership?: PropertyOwnership;
  latestClaimRequest?: PropertyClaimRequest;
}

interface ValuationSubmissionRow {
  id: string;
  property_id: string | null;
  property_asset_id?: string | null;
  submitted_by_user_id: string;
  is_anonymous: boolean;
  effective_date: string;
  estimated_value_rwf: number | string;
  currency: ValuationSubmission["currency"];
  status: SubmissionStatus;
  created_at: string;
}

interface AdminValuationSubmissionRow extends ValuationSubmissionRow {
  updated_at: string;
  property_route_id: string | null;
  property_title: string | null;
  district: string | null;
  sector: string | null;
}

export interface AdminValuationSubmission {
  id: string;
  propertyId: string;
  propertyRouteId?: string;
  propertyTitle: string;
  district: string;
  sector?: string;
  submittedByUserId: string;
  isAnonymous: boolean;
  effectiveDate: string;
  estimatedValue: number;
  currency: ValuationSubmission["currency"];
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

function createRecordId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function slugifyAgencyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toAgency(row: AgencyRow): Agency {
  return {
    id: row.id,
    slug: row.slug,
    createdFromApplicationId: row.created_from_application_id || undefined,
    businessName: row.business_name,
    tin: row.tin,
    whatsappPhone: row.whatsapp_phone || undefined,
    websiteUrl: row.website_url || undefined,
    googleMapsUrl: row.google_maps_url || undefined,
    status: row.status,
    pendingManagerUserId: row.pending_manager_user_id || undefined,
    managerUserId: row.manager_user_id || undefined,
    memberUserIds: row.member_user_ids ?? [],
  };
}

function toAgencyApplication(row: AgencyApplicationRow): AgencyApplication {
  return {
    id: row.id,
    createdByUserId: row.created_by_user_id,
    businessName: row.business_name,
    tin: row.tin,
    websiteUrl: row.website_url || undefined,
    googleMapsUrl: row.google_maps_url || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toAgentApplication(row: AgentApplicationRow): AgentApplication {
  return {
    id: row.id,
    userId: row.user_id,
    nationalIdPhotoUrl: row.national_id_photo_url,
    selectedAgencyId: row.selected_agency_id || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toValuatorApplication(row: ValuatorApplicationRow): ValuatorApplication {
  return {
    id: row.id,
    userId: row.user_id,
    irpvRegistrationNumber: row.irpv_registration_number,
    status: row.status,
    createdAt: row.created_at,
  };
}

function getPropertyClaimFactsFromRow(row: PropertyClaimRequestRow): PropertyRecordFactsInput | undefined {
  const representativeSize = toFiniteNumber(row.representative_size);
  const bedrooms = toFiniteNumber(row.bedrooms);
  const bathrooms = toFiniteNumber(row.bathrooms);
  const interiorAreaSqm = toFiniteNumber(row.interior_area_sqm);
  const yearBuilt = toFiniteNumber(row.year_built);
  const zoning = row.zoning?.trim() || undefined;
  const description = row.description?.trim() || undefined;

  if (
    representativeSize === null &&
    bedrooms === null &&
    bathrooms === null &&
    interiorAreaSqm === null &&
    yearBuilt === null &&
    !zoning &&
    !description
  ) {
    return undefined;
  }

  return {
    representativeSize: representativeSize ?? undefined,
    zoning,
    bedrooms: bedrooms ?? undefined,
    bathrooms: bathrooms ?? undefined,
    interiorAreaSqm: interiorAreaSqm ?? undefined,
    yearBuilt: yearBuilt ?? undefined,
    description,
  };
}

function toPropertyClaimRequest(row: PropertyClaimRequestRow): PropertyClaimRequest {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.request_kind,
    propertyId: row.property_id || undefined,
    propertyInternalId: row.property_internal_id || undefined,
    parcelId: row.parcel_id,
    upi: row.upi,
    claimScope: row.claim_scope,
    unitLabel: row.unit_label || undefined,
    declaredPropertyType: row.declared_property_type || undefined,
    tenureType: row.tenure_type,
    tenureSource: row.tenure_source,
    declaredAssetType: row.declared_asset_type || undefined,
    propertyFacts: getPropertyClaimFactsFromRow(row),
    transferMode: row.transfer_mode || undefined,
    transferFromUserId: row.transfer_from_user_id || undefined,
    transferInitiatedByUserId: row.transfer_initiated_by_user_id || undefined,
    buyerConfirmedAt: row.buyer_confirmed_at || undefined,
    buyerDeclinedAt: row.buyer_declined_at || undefined,
    transferNote: row.transfer_note || undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toPropertyOwnership(row: PropertyOwnershipRow): PropertyOwnership {
  return {
    id: row.id,
    userId: row.user_id,
    propertyId: row.property_id,
    propertyInternalId: row.property_internal_id,
    parcelId: row.parcel_id,
    ownershipScope: row.ownership_scope,
    createdAt: row.created_at,
  };
}

function toAdminPropertyClaimRequest(row: AdminPropertyClaimRequestRow): AdminPropertyClaimRequest {
  const isTransfer = row.request_kind === "transfer";
  const propertyKind = row.property_kind || undefined;
  const isUnitOwnership = row.claim_scope === "unit_partial" || propertyKind === "apartment_unit" || propertyKind === "commercial_unit";
  const conflictingOwnerName = row.conflicting_owner_full_name?.trim() || "another user";
  const conflictingPropertyTitle = row.conflicting_property_title?.trim() || "another property on this parcel";
  const approvalBlockedReason = isTransfer
    ? !row.property_internal_id
      ? "This transfer request is missing its property target and cannot be approved."
      : !row.transfer_from_user_id
        ? "This transfer request is missing the current owner reference."
        : !row.buyer_confirmed_at
          ? "The recipient still needs to accept this transfer before it can be approved."
          : row.current_owner_user_id !== row.transfer_from_user_id
            ? `${row.transfer_from_user_full_name || "The original owner"} no longer appears to own this property. Resolve the ownership mismatch before approving the transfer.`
            : undefined
    : !row.property_internal_id
    ? row.claim_scope === "unit_partial"
      ? "This claim still needs to be matched to a specific unit in Preview before it can be approved."
      : !row.declared_asset_type
        ? "This parcel-first claim still needs to be resolved to a specific property record before it can be approved."
        : undefined
    : row.conflicting_ownership_id
      ? row.conflicting_ownership_scope === "full"
        ? `${conflictingOwnerName} already has full ownership on this parcel via ${conflictingPropertyTitle}. Deny this claim or resolve the ownership conflict first.`
        : isUnitOwnership
          ? `${conflictingOwnerName} already owns another unit or property that conflicts with this claim. Deny this claim or resolve the ownership conflict first.`
          : `${conflictingOwnerName} already owns ${conflictingPropertyTitle} on this parcel. Full-property approval would conflict with that existing ownership.`
      : undefined;

  return {
    id: row.id,
    userId: row.user_id,
    kind: row.request_kind,
    userFullName: row.user_full_name || row.user_id,
    propertyId: row.property_id || undefined,
    propertyInternalId: row.property_internal_id || undefined,
    parcelId: row.parcel_id,
    upi: row.upi,
    claimScope: row.claim_scope,
    unitLabel: row.unit_label || undefined,
    tenureType: row.tenure_type,
    tenureSource: row.tenure_source,
    declaredAssetType: row.declared_asset_type || undefined,
    propertyFacts: getPropertyClaimFactsFromRow(row),
    transferMode: row.transfer_mode || undefined,
    propertyRouteId: row.property_route_id || undefined,
    propertyTitle: row.property_title || row.property_route_id || row.property_id || row.upi || "Preview property",
    propertyKind,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    transferFromUserId: row.transfer_from_user_id || undefined,
    transferInitiatedByUserId: row.transfer_initiated_by_user_id || undefined,
    transferFromUserFullName: row.transfer_from_user_full_name || undefined,
    transferFromUserEmail: row.transfer_from_user_email || undefined,
    currentOwnerUserId: row.current_owner_user_id || undefined,
    currentOwnerFullName: row.current_owner_full_name || undefined,
    buyerConfirmedAt: row.buyer_confirmed_at || undefined,
    buyerDeclinedAt: row.buyer_declined_at || undefined,
    transferNote: row.transfer_note || undefined,
    status: row.status,
    createdAt: row.created_at,
    approvalBlockedReason,
  };
}

function toValuationSubmission(row: ValuationSubmissionRow): ValuationSubmission {
  return {
    id: row.id,
    propertyId: row.property_id || "",
    submittedByUserId: row.submitted_by_user_id,
    isAnonymous: row.is_anonymous,
    effectiveDate: row.effective_date,
    estimatedValue: Number(row.estimated_value_rwf),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toAdminValuationSubmission(row: AdminValuationSubmissionRow): AdminValuationSubmission {
  return {
    id: row.id,
    propertyId: row.property_id || row.property_route_id || row.id,
    propertyRouteId: row.property_route_id || undefined,
    propertyTitle: row.property_title || row.property_route_id || row.property_id || "Preview property",
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    submittedByUserId: row.submitted_by_user_id,
    isAnonymous: row.is_anonymous,
    effectiveDate: row.effective_date,
    estimatedValue: Number(row.estimated_value_rwf),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getOwnershipScopeForPropertyKind(propertyKind?: PropertyKind | null): PropertyOwnershipScope {
  return propertyKind === "apartment_unit" || propertyKind === "commercial_unit" ? "unit" : "full";
}

function toFiniteNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function inferClaimRecordBackfill(input: {
  assetType?: PropertyKind | null;
  parcelId: string;
  unitLabel?: string | null;
  displayId?: string | null;
  parcelPublicId?: string | null;
  district?: string | null;
  sector?: string | null;
  zoning?: string | null;
  representativeSize?: number | string | null;
}) {
  const normalizedUnitLabel = normalizeClaimUnitLabel(input.unitLabel);
  const representativeSize = toFiniteNumber(input.representativeSize);
  const fallbackArea = (multiplier: number, min: number, max: number, defaultValue: number) => {
    if (representativeSize === null) {
      return defaultValue;
    }

    return Math.round(clampNumber(representativeSize * multiplier, min, max) * 100) / 100;
  };

  switch (input.assetType) {
    case "house":
      return {
        assetUnitLabel: null,
        propertyType: "House",
        propertyDescription: "Preview house record auto-backfilled from parcel context after claim approval.",
        bedrooms: representativeSize !== null && representativeSize >= 650 ? 5 : representativeSize !== null && representativeSize >= 420 ? 4 : representativeSize !== null && representativeSize >= 250 ? 3 : 2,
        bathrooms: representativeSize !== null && representativeSize >= 650 ? 4 : representativeSize !== null && representativeSize >= 420 ? 3 : 2,
        interiorAreaSqm: fallbackArea(0.42, 90, 420, 180),
      };
    case "apartment_unit":
      return {
        assetUnitLabel: normalizedUnitLabel,
        propertyType: "Apartment unit",
        propertyDescription: "Preview apartment-unit record auto-backfilled from parcel context after claim approval.",
        bedrooms: representativeSize !== null && representativeSize >= 900 ? 3 : representativeSize !== null && representativeSize >= 450 ? 2 : 1,
        bathrooms: representativeSize !== null && representativeSize < 300 ? 1 : 2,
        interiorAreaSqm: fallbackArea(0.18, 55, 160, 96),
      };
    case "apartment_building":
      return {
        assetUnitLabel: null,
        propertyType: "Apartment building",
        propertyDescription: "Preview apartment-building record auto-backfilled from parcel context after claim approval.",
        bedrooms: null,
        bathrooms: null,
        interiorAreaSqm: fallbackArea(1.35, 480, 3200, 1680),
      };
    case "commercial_building":
      return {
        assetUnitLabel: null,
        propertyType: "Commercial building",
        propertyDescription: "Preview commercial-building record auto-backfilled from parcel context after claim approval.",
        bedrooms: null,
        bathrooms: null,
        interiorAreaSqm: fallbackArea(1.35, 480, 3200, 1680),
      };
    case "commercial_unit":
      return {
        assetUnitLabel: normalizedUnitLabel,
        propertyType: "Commercial unit",
        propertyDescription: "Preview commercial-unit record auto-backfilled from parcel context after claim approval.",
        bedrooms: null,
        bathrooms: null,
        interiorAreaSqm: fallbackArea(0.35, 80, 420, 148),
      };
    case "land":
      return {
        assetUnitLabel: null,
        propertyType: "Land",
        propertyDescription: "Preview land record auto-backfilled from parcel context after claim approval.",
        bedrooms: null,
        bathrooms: null,
        interiorAreaSqm: null,
      };
    default:
      return {
        assetUnitLabel: normalizedUnitLabel,
        propertyType: "Property",
        propertyDescription: "Preview property record auto-backfilled from parcel context after claim approval.",
        bedrooms: null,
        bathrooms: null,
        interiorAreaSqm: null,
      };
  }
}

function normalizeClaimUnitLabel(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function getOwnershipScopeForClaimScope(claimScope: PropertyClaimScope): PropertyOwnershipScope {
  return claimScope === "unit_partial" ? "unit" : "full";
}

async function backfillPropertyRecordForAsset(input: {
  propertyAssetId: string;
  userId: string;
  claimUnitLabel?: string;
  propertyFacts?: PropertyRecordFactsInput;
}) {
  const contextResult = await getPgPool().query<PropertyRecordBackfillRow>(
    `
      SELECT
        pa.asset_type,
        pa.unit_label,
        pa.parcel_id,
        parcel.display_id,
        parcel.public_id AS parcel_public_id,
        parcel.district,
        parcel.sector,
        parcel.representative_size,
        parcel.zoning
      FROM property_asset pa
      JOIN parcel_app_ready_seed_preview parcel
        ON parcel.parcel_id = pa.parcel_id
      WHERE pa.id = $1
      LIMIT 1
    `,
    [input.propertyAssetId],
  );

  const row = contextResult.rows[0];
  if (!row) {
    return;
  }

  const claimRepresentativeSize = toFiniteNumber(input.propertyFacts?.representativeSize);
  const claimBedrooms = toFiniteNumber(input.propertyFacts?.bedrooms);
  const claimBathrooms = toFiniteNumber(input.propertyFacts?.bathrooms);
  const claimInteriorAreaSqm = toFiniteNumber(input.propertyFacts?.interiorAreaSqm);
  const claimYearBuilt = toFiniteNumber(input.propertyFacts?.yearBuilt);
  const claimDescription = input.propertyFacts?.description?.trim() || null;

  // These values are preview-only defaults that make approved claims listing-ready without overwriting real edits.
  const inferred = inferClaimRecordBackfill({
    assetType: row.asset_type,
    parcelId: row.parcel_id,
    unitLabel: row.unit_label || input.claimUnitLabel || null,
    displayId: row.display_id,
    parcelPublicId: row.parcel_public_id,
    district: row.district,
    sector: row.sector,
    zoning: row.zoning,
    representativeSize: claimRepresentativeSize ?? row.representative_size,
  });

  await getPgPool().query(
    `
      UPDATE property_asset
      SET
        unit_label = COALESCE(NULLIF(BTRIM(unit_label), ''), $2),
        updated_at = NOW()
      WHERE id = $1
    `,
    [input.propertyAssetId, inferred.assetUnitLabel],
  );

  await getPgPool().query(
    `
      UPDATE parcel_app_ready_seed_preview
      SET
        representative_size = COALESCE(representative_size, $2)
      WHERE parcel_id = $1
    `,
    [row.parcel_id, claimRepresentativeSize],
  );

  await getPgPool().query(
    `
      INSERT INTO property_asset_profile (
        property_asset_id,
        created_by_user_id,
        description,
        property_type,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'claim_record_backfill_v1')
      ON CONFLICT (property_asset_id) DO UPDATE
      SET
        created_by_user_id = COALESCE(property_asset_profile.created_by_user_id, EXCLUDED.created_by_user_id),
        description = CASE
          WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.description), ''), NULL) IS NULL THEN EXCLUDED.description
          ELSE property_asset_profile.description
        END,
        property_type = CASE
          WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.property_type), ''), NULL) IS NULL THEN EXCLUDED.property_type
          ELSE property_asset_profile.property_type
        END,
        bedrooms = COALESCE(property_asset_profile.bedrooms, EXCLUDED.bedrooms),
        bathrooms = COALESCE(property_asset_profile.bathrooms, EXCLUDED.bathrooms),
        interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
        year_built = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
        updated_at = NOW()
    `,
    [
      input.propertyAssetId,
      input.userId,
      claimDescription ?? inferred.propertyDescription,
      inferred.propertyType,
      claimBedrooms ?? inferred.bedrooms,
      claimBathrooms ?? inferred.bathrooms,
      claimInteriorAreaSqm ?? inferred.interiorAreaSqm,
      claimYearBuilt,
    ],
  );
}

async function addRoleToUser(userId: string, role: Role) {
  await getPgPool().query(
    `
      UPDATE app_user
      SET
        roles = CASE
          WHEN roles @> ARRAY[$2]::TEXT[] THEN roles
          ELSE roles || $2::TEXT
        END,
        updated_at = NOW()
      WHERE id = $1
    `,
    [userId, role],
  );
}

async function ensureAgencyMembership(input: {
  id: string;
  agencyId: string;
  userId: string;
  role: "agent" | "manager";
  seedSource: string;
}) {
  await getPgPool().query(
    `
      INSERT INTO agency_membership (
        id,
        agency_id,
        user_id,
        role,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, 'active', $5)
      ON CONFLICT (agency_id, user_id, role) DO UPDATE
      SET
        status = 'active',
        seed_source = EXCLUDED.seed_source
    `,
    [input.id, input.agencyId, input.userId, input.role, input.seedSource],
  );
}

async function getLatestAgentApplicationForUser(userId: string) {
  const result = await getPgPool().query<AgentApplicationRow>(
    `
      SELECT
        id,
        user_id,
        national_id_photo_url,
        selected_agency_id,
        status,
        created_at::TEXT
      FROM agent_application
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? toAgentApplication(result.rows[0]) : undefined;
}

async function getAgentApplicationById(applicationId: string) {
  const result = await getPgPool().query<AgentApplicationRow>(
    `
      SELECT
        id,
        user_id,
        national_id_photo_url,
        selected_agency_id,
        status,
        created_at::TEXT
      FROM agent_application
      WHERE id = $1
      LIMIT 1
    `,
    [applicationId],
  );

  return result.rows[0] ? toAgentApplication(result.rows[0]) : undefined;
}

async function getAgencyStatusById(agencyId: string) {
  const result = await getPgPool().query<{ status: Agency["status"] }>(
    `
      SELECT status
      FROM agency
      WHERE id = $1
      LIMIT 1
    `,
    [agencyId],
  );

  return result.rows[0]?.status;
}

async function buildUniqueAgencySlug(baseName: string, applicationId: string) {
  const baseSlug = slugifyAgencyName(baseName) || "agency";
  const existing = await getPgPool().query<{ id: string }>(
    `
      SELECT id
      FROM agency
      WHERE slug = $1
      LIMIT 1
    `,
    [baseSlug],
  );

  if (!existing.rows[0]) {
    return baseSlug;
  }

  return `${baseSlug}-${applicationId.slice(-6).toLowerCase()}`;
}

export async function listAgenciesFromDb() {
  const result = await getPgPool().query<AgencyRow>(
    `
      SELECT
        a.id,
        a.slug,
        a.created_from_application_id,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id,
        COALESCE(
          ARRAY_AGG(DISTINCT am.user_id) FILTER (WHERE am.user_id IS NOT NULL AND am.status = 'active'),
          ARRAY[]::TEXT[]
        ) AS member_user_ids
      FROM agency a
      LEFT JOIN agency_membership am
        ON am.agency_id = a.id
      GROUP BY
        a.id,
        a.slug,
        a.created_from_application_id,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id
      ORDER BY a.created_at ASC, a.id ASC
    `,
  );

  return result.rows.map(toAgency);
}

export async function listAgencyApplicationsFromDb() {
  const result = await getPgPool().query<AgencyApplicationRow>(
    `
      SELECT
        id,
        created_by_user_id,
        business_name,
        tin,
        website_url,
        google_maps_url,
        status,
        created_at::TEXT
      FROM agency_application
      ORDER BY created_at ASC, id ASC
    `,
  );

  return result.rows.map(toAgencyApplication);
}

export async function listAgentApplicationsFromDb() {
  const result = await getPgPool().query<AgentApplicationRow>(
    `
      SELECT
        id,
        user_id,
        national_id_photo_url,
        selected_agency_id,
        status,
        created_at::TEXT
      FROM agent_application
      ORDER BY created_at ASC, id ASC
    `,
  );

  return result.rows.map(toAgentApplication);
}

export async function listValuatorApplicationsFromDb() {
  const result = await getPgPool().query<ValuatorApplicationRow>(
    `
      SELECT
        id,
        user_id,
        irpv_registration_number,
        status,
        created_at::TEXT
      FROM valuator_application
      ORDER BY created_at ASC, id ASC
    `,
  );

  return result.rows.map(toValuatorApplication);
}

export async function listAgenciesForUser(userId: string) {
  const result = await getPgPool().query<AgencyRow>(
    `
      SELECT
        a.id,
        a.slug,
        a.created_from_application_id,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id,
        COALESCE(
          ARRAY_AGG(DISTINCT am.user_id) FILTER (WHERE am.user_id IS NOT NULL AND am.status = 'active'),
          ARRAY[]::TEXT[]
        ) AS member_user_ids
      FROM agency a
      LEFT JOIN agency_membership am
        ON am.agency_id = a.id
      WHERE a.manager_user_id = $1
        OR a.pending_manager_user_id = $1
        OR EXISTS (
          SELECT 1 FROM agency_membership am2
          WHERE am2.agency_id = a.id AND am2.user_id = $1 AND am2.status = 'active'
        )
      GROUP BY
        a.id,
        a.slug,
        a.created_from_application_id,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id
      ORDER BY a.created_at ASC, a.id ASC
    `,
    [userId],
  );

  return result.rows.map(toAgency);
}

export async function getLatestAgencyApplicationStatusForUser(userId: string): Promise<SubmissionStatus | undefined> {
  const result = await getPgPool().query<{ status: SubmissionStatus }>(
    `SELECT status FROM agency_application WHERE created_by_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.status;
}

export async function getLatestAgentApplicationStatusForUser(userId: string): Promise<SubmissionStatus | undefined> {
  const result = await getPgPool().query<{ status: SubmissionStatus }>(
    `SELECT status FROM agent_application WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.status;
}

export async function getLatestValuatorApplicationStatusForUser(userId: string): Promise<SubmissionStatus | undefined> {
  const result = await getPgPool().query<{ status: SubmissionStatus }>(
    `SELECT status FROM valuator_application WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.status;
}

export async function listPropertyClaimRequestsFromDb() {
  const result = await getPgPool().query<AdminPropertyClaimRequestRow>(
    `
      SELECT
        pcr.id,
        pcr.user_id,
        pcr.request_kind,
        pcr.property_id,
        pcr.property_internal_id,
        pcr.parcel_id,
        pcr.upi,
        pcr.claim_scope,
        pcr.unit_label,
        pcr.tenure_type,
        pcr.tenure_source,
        pcr.declared_asset_type,
        pcr.representative_size,
        pcr.zoning,
        pcr.bedrooms,
        pcr.bathrooms,
        pcr.interior_area_sqm,
        pcr.year_built,
        pcr.description,
        pcr.transfer_mode,
        pcr.transfer_from_user_id,
        pcr.transfer_initiated_by_user_id,
        pcr.buyer_confirmed_at::TEXT,
        pcr.buyer_declined_at::TEXT,
        pcr.transfer_note,
        pcr.status,
        pcr.created_at::TEXT,
        COALESCE(pa.public_id, parcel.public_id) AS property_route_id,
        CASE
          WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(parcel.display_id, parcel.public_id, parcel.parcel_id), ' · ', pa.unit_label)
          ELSE COALESCE(parcel.display_id, parcel.public_id, parcel.parcel_id)
        END AS property_title,
        pa.asset_type AS property_kind,
        parcel.district,
        parcel.sector,
        claimant.full_name AS user_full_name,
        transfer_from.full_name AS transfer_from_user_full_name,
        transfer_from.email AS transfer_from_user_email,
        current_owner.user_id AS current_owner_user_id,
        current_owner.owner_full_name AS current_owner_full_name,
        (
          SELECT COUNT(*)
          FROM property_asset pa_count
          WHERE pa_count.parcel_id = pcr.parcel_id
        ) AS asset_count_for_parcel,
        conflict.id AS conflicting_ownership_id,
        conflict.owner_full_name AS conflicting_owner_full_name,
        conflict.ownership_scope AS conflicting_ownership_scope,
        conflict.property_title AS conflicting_property_title
      FROM property_claim_request pcr
      JOIN app_user claimant
        ON claimant.id = pcr.user_id
      LEFT JOIN app_user transfer_from
        ON transfer_from.id = pcr.transfer_from_user_id
      JOIN parcel_app_ready_seed_preview parcel
        ON parcel.parcel_id = pcr.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = pcr.property_internal_id
      LEFT JOIN LATERAL (
        SELECT
          po.user_id,
          owner.full_name AS owner_full_name
        FROM property_ownership po
        JOIN app_user owner
          ON owner.id = po.user_id
        WHERE pcr.property_internal_id IS NOT NULL
          AND po.property_internal_id = pcr.property_internal_id
        LIMIT 1
      ) current_owner
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          po.id,
          owner.full_name AS owner_full_name,
          po.ownership_scope,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa_conflict.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(parcel_conflict.display_id, parcel_conflict.public_id, parcel_conflict.parcel_id), ' · ', pa_conflict.unit_label)
            ELSE COALESCE(parcel_conflict.display_id, parcel_conflict.public_id, parcel_conflict.parcel_id)
          END AS property_title
        FROM property_ownership po
        JOIN app_user owner
          ON owner.id = po.user_id
        LEFT JOIN property_asset pa_conflict
          ON pa_conflict.id = po.property_internal_id
        LEFT JOIN parcel_app_ready_seed_preview parcel_conflict
          ON parcel_conflict.parcel_id = po.parcel_id
        WHERE po.user_id <> pcr.user_id
          AND (pcr.request_kind <> 'transfer' OR po.user_id <> pcr.transfer_from_user_id)
          AND (
            (pcr.property_internal_id IS NOT NULL AND po.property_internal_id = pcr.property_internal_id)
            OR (
              pcr.claim_scope = 'full_parcel'
              AND po.parcel_id = pcr.parcel_id
            )
            OR (
              po.ownership_scope = 'full'
              AND po.parcel_id = pcr.parcel_id
            )
          )
        LIMIT 1
      ) conflict
        ON TRUE
      ORDER BY pcr.created_at ASC, pcr.id ASC
    `,
  );

  return result.rows.map(toAdminPropertyClaimRequest);
}

export async function listPropertyOwnershipsForUser(userId: string) {
  const result = await getPgPool().query<PropertyOwnershipRow>(
    `
      SELECT
        id,
        user_id,
        property_id,
        property_internal_id,
        parcel_id,
        ownership_scope,
        created_at::TEXT
      FROM property_ownership
      WHERE user_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [userId],
  );

  return result.rows.map(toPropertyOwnership);
}

export async function listPropertyClaimRequestsForUser(userId: string) {
  const result = await getPgPool().query<PropertyClaimRequestRow>(
    `
      SELECT
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
      FROM property_claim_request
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [userId],
  );

  return result.rows.map(toPropertyClaimRequest);
}

export async function getUserPropertyRelationship(userId: string, propertyInternalId: string): Promise<UserPropertyRelationship> {
  const [ownerships, claimRequests] = await Promise.all([
    getPgPool().query<PropertyOwnershipRow>(
      `
        SELECT
          id,
          user_id,
          property_id,
          property_internal_id,
          parcel_id,
          ownership_scope,
          created_at::TEXT
        FROM property_ownership
        WHERE user_id = $1
          AND property_internal_id = $2
        LIMIT 1
      `,
      [userId, propertyInternalId],
    ),
    getPgPool().query<PropertyClaimRequestRow>(
      `
        SELECT
          id,
          user_id,
          request_kind,
          property_id,
          property_internal_id,
          parcel_id,
          upi,
          claim_scope,
          unit_label,
          tenure_type,
          tenure_source,
          declared_asset_type,
          representative_size,
          zoning,
          bedrooms,
          bathrooms,
          interior_area_sqm,
          year_built,
          description,
          transfer_mode,
          transfer_from_user_id,
          transfer_initiated_by_user_id,
          buyer_confirmed_at::TEXT,
          buyer_declined_at::TEXT,
          transfer_note,
          status,
          created_at::TEXT
        FROM property_claim_request
        WHERE user_id = $1
          AND property_internal_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `,
      [userId, propertyInternalId],
    ),
  ]);

  return {
    ownership: ownerships.rows[0] ? toPropertyOwnership(ownerships.rows[0]) : undefined,
    latestClaimRequest: claimRequests.rows[0] ? toPropertyClaimRequest(claimRequests.rows[0]) : undefined,
  };
}

export async function createAgencyApplicationInDb(input: {
  createdByUserId: string;
  businessName: string;
  tin: string;
  websiteUrl?: string;
  googleMapsUrl?: string;
}) {
  const id = createRecordId("agency-application");
  const result = await getPgPool().query<AgencyApplicationRow>(
    `
      INSERT INTO agency_application (
        id,
        created_by_user_id,
        business_name,
        tin,
        website_url,
        google_maps_url,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        created_by_user_id,
        business_name,
        tin,
        website_url,
        google_maps_url,
        status,
        created_at::TEXT
    `,
    [id, input.createdByUserId, input.businessName, input.tin, input.websiteUrl || null, input.googleMapsUrl || null],
  );

  return toAgencyApplication(result.rows[0]);
}

export async function createAgentApplicationInDb(input: {
  userId: string;
  nationalIdPhotoUrl: string;
  selectedAgencyId?: string;
}) {
  const id = createRecordId("agent-application");
  const result = await getPgPool().query<AgentApplicationRow>(
    `
      INSERT INTO agent_application (
        id,
        user_id,
        national_id_photo_url,
        selected_agency_id,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        user_id,
        national_id_photo_url,
        selected_agency_id,
        status,
        created_at::TEXT
    `,
    [id, input.userId, input.nationalIdPhotoUrl, input.selectedAgencyId || null],
  );

  return toAgentApplication(result.rows[0]);
}

export async function createValuatorApplicationInDb(input: {
  userId: string;
  irpvRegistrationNumber: string;
}) {
  const id = createRecordId("valuator-application");
  const result = await getPgPool().query<ValuatorApplicationRow>(
    `
      INSERT INTO valuator_application (
        id,
        user_id,
        irpv_registration_number,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        user_id,
        irpv_registration_number,
        status,
        created_at::TEXT
    `,
    [id, input.userId, input.irpvRegistrationNumber],
  );

  return toValuatorApplication(result.rows[0]);
}

async function resolveValuationTarget(routeId: string) {
  const result = await getPgPool().query<{
    parcel_id: string;
    property_id: string;
    property_asset_id: string | null;
  }>(
    `
      WITH target_parcel AS (
        SELECT p.parcel_id
        FROM parcel_app_ready_seed_preview p
        WHERE p.public_id = $1
        UNION
        SELECT pa.parcel_id
        FROM property_asset pa
        WHERE pa.public_id = $1
        LIMIT 1
      )
      SELECT
        p.parcel_id,
        COALESCE(pa.public_id, p.public_id) AS property_id,
        pa.id AS property_asset_id
      FROM target_parcel tp
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = tp.parcel_id
      LEFT JOIN LATERAL (
        SELECT pa_inner.id, pa_inner.public_id
        FROM property_asset pa_inner
        LEFT JOIN listing l
          ON l.property_asset_id = pa_inner.id
         AND l.status = 'active'
        WHERE pa_inner.parcel_id = p.parcel_id
        ORDER BY
          CASE
            WHEN pa_inner.public_id = $1 THEN 0
            WHEN l.id IS NOT NULL THEN 1
            WHEN pa_inner.is_primary_for_parcel THEN 2
            ELSE 3
          END,
          pa_inner.created_at ASC,
          pa_inner.id ASC
        LIMIT 1
      ) pa
        ON TRUE
      LIMIT 1
    `,
    [routeId],
  );

  return result.rows[0];
}

export async function createValuationSubmissionInDb(input: {
  userId: string;
  propertyRouteId: string;
  effectiveDate: string;
  estimatedValue: number;
  isAnonymous: boolean;
}) {
  const target = await resolveValuationTarget(input.propertyRouteId);

  if (!target?.property_asset_id) {
    throw new Error("Could not resolve property for valuation submission");
  }

  const id = createRecordId("valuation-submission");
  const result = await getPgPool().query<ValuationSubmissionRow>(
    `
      INSERT INTO valuation_submission (
        id,
        property_id,
        property_asset_id,
        submitted_by_user_id,
        is_anonymous,
        effective_date,
        estimated_value_rwf,
        currency,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'RWF', 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        property_id,
        submitted_by_user_id,
        is_anonymous,
        effective_date::TEXT,
        estimated_value_rwf,
        currency,
        status,
        created_at::TEXT
    `,
    [
      id,
      target.property_id,
      target.property_asset_id,
      input.userId,
      input.isAnonymous,
      input.effectiveDate,
      Math.round(input.estimatedValue),
    ],
  );

  return toValuationSubmission(result.rows[0]);
}

export async function listValuationSubmissionsFromDb() {
  const result = await getPgPool().query<AdminValuationSubmissionRow>(
    `
      SELECT
        vs.id,
        vs.property_id,
        vs.property_asset_id,
        vs.submitted_by_user_id,
        vs.is_anonymous,
        vs.effective_date::TEXT,
        vs.estimated_value_rwf,
        vs.currency,
        vs.status,
        vs.created_at::TEXT,
        vs.updated_at::TEXT,
        COALESCE(pa_target.public_id, pa_fallback.public_id, parcel.public_id, vs.property_id) AS property_route_id,
        CASE
          WHEN COALESCE(NULLIF(BTRIM(pa_target.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(parcel.display_id, parcel.public_id, parcel.parcel_id, vs.property_id), ' · ', pa_target.unit_label)
          WHEN COALESCE(NULLIF(BTRIM(pa_fallback.unit_label), ''), NULL) IS NOT NULL
            THEN CONCAT(COALESCE(parcel.display_id, parcel.public_id, parcel.parcel_id, vs.property_id), ' · ', pa_fallback.unit_label)
          ELSE COALESCE(parcel.display_id, parcel.public_id, parcel.parcel_id, vs.property_id)
        END AS property_title,
        parcel.district,
        parcel.sector
      FROM valuation_submission vs
      LEFT JOIN property_asset pa_target
        ON pa_target.id = vs.property_asset_id
      LEFT JOIN property_asset pa_fallback
        ON pa_fallback.public_id = vs.property_id
       AND pa_target.id IS NULL
      LEFT JOIN parcel_app_ready_seed_preview parcel
        ON parcel.parcel_id = COALESCE(pa_target.parcel_id, pa_fallback.parcel_id)
      ORDER BY vs.created_at ASC, vs.id ASC
    `,
  );

  return result.rows.map(toAdminValuationSubmission);
}

export async function activateApprovedAgentMembershipInDb(applicationId: string) {
  const application = await getAgentApplicationById(applicationId);

  if (!application || application.status !== "approved" || !application.selectedAgencyId) {
    return null;
  }

  const agencyStatus = await getAgencyStatusById(application.selectedAgencyId);
  if (agencyStatus !== "approved") {
    return null;
  }

  await ensureAgencyMembership({
    id: `${application.selectedAgencyId}-agent-${application.userId}`,
    agencyId: application.selectedAgencyId,
    userId: application.userId,
    role: "agent",
    seedSource: "manual_workflow_v1",
  });

  return application;
}

export async function updateApplicationStatusInDb(
  kind: ApplicationKind,
  applicationId: string,
  status: SubmissionStatus,
) {
  const tableName =
    kind === "agency"
      ? "agency_application"
      : kind === "agent"
        ? "agent_application"
        : "valuator_application";

  const result = await getPgPool().query<{ user_id?: string; created_by_user_id?: string }>(
    `
      UPDATE ${tableName}
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING user_id, created_by_user_id
    `,
    [applicationId, status],
  );

  const row = result.rows[0];

  if (!row) {
    return;
  }

  if (status === "approved" && kind === "agent" && row.user_id) {
    await addRoleToUser(row.user_id, "agent");
  }

  if (status === "approved" && kind === "valuator" && row.user_id) {
    await addRoleToUser(row.user_id, "valuator");
  }
}

export async function updateValuationSubmissionStatusInDb(
  submissionId: string,
  status: SubmissionStatus,
) {
  const result = await getPgPool().query<AdminValuationSubmissionRow>(
    `
      UPDATE valuation_submission
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        property_id,
        property_asset_id,
        submitted_by_user_id,
        is_anonymous,
        effective_date::TEXT,
        estimated_value_rwf,
        currency,
        status,
        created_at::TEXT,
        updated_at::TEXT,
        NULL::TEXT AS property_route_id,
        NULL::TEXT AS property_title,
        NULL::TEXT AS district,
        NULL::TEXT AS sector
    `,
    [submissionId, status],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const hydrated = (await listValuationSubmissionsFromDb()).find((submission) => submission.id === row.id);
  return hydrated ?? toAdminValuationSubmission(row);
}

export async function ensureAgencyFromApprovedApplicationInDb(applicationId: string) {
  const result = await getPgPool().query<AgencyApplicationRow>(
    `
      SELECT
        id,
        created_by_user_id,
        business_name,
        tin,
        website_url,
        google_maps_url,
        status,
        created_at::TEXT
      FROM agency_application
      WHERE id = $1
      LIMIT 1
    `,
    [applicationId],
  );

  const applicationRow = result.rows[0];

  if (!applicationRow) {
    return null;
  }

  const application = toAgencyApplication(applicationRow);

  if (application.status !== "approved") {
    return null;
  }

  const existingAgencies = await listAgenciesFromDb();
  const existingAgency = existingAgencies.find((agency) => agency.createdFromApplicationId === application.id);

  if (existingAgency) {
    return existingAgency;
  }

  const latestAgentApplication = await getLatestAgentApplicationForUser(application.createdByUserId);
  const isApprovedAgent = latestAgentApplication?.status === "approved";
  const slug = await buildUniqueAgencySlug(application.businessName, application.id);
  const agencyId = createRecordId("agency");
  const insertResult = await getPgPool().query<AgencyRow>(
    `
      INSERT INTO agency (
        id,
        slug,
        created_from_application_id,
        business_name,
        tin,
        website_url,
        google_maps_url,
        status,
        pending_manager_user_id,
        manager_user_id,
        seed_source
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        'approved',
        $8,
        $9,
        'manual_workflow_v1'
      )
      RETURNING
        id,
        slug,
        created_from_application_id,
        business_name,
        tin,
        whatsapp_phone,
        website_url,
        google_maps_url,
        status,
        pending_manager_user_id,
        manager_user_id,
        ARRAY[]::TEXT[] AS member_user_ids
    `,
    [
      agencyId,
      slug,
      application.id,
      application.businessName,
      application.tin,
      application.websiteUrl || null,
      application.googleMapsUrl || null,
      application.createdByUserId,
      isApprovedAgent ? application.createdByUserId : null,
    ],
  );

  if (isApprovedAgent) {
    await ensureAgencyMembership({
      id: `${agencyId}-manager-${application.createdByUserId}`,
      agencyId,
      userId: application.createdByUserId,
      role: "manager",
      seedSource: "manual_workflow_v1",
    });
    await addRoleToUser(application.createdByUserId, "agency_manager");
    await addRoleToUser(application.createdByUserId, "agent");
  }

  return toAgency(insertResult.rows[0]);
}

export async function activatePendingAgencyManagerInDb(userId: string) {
  const result = await getPgPool().query<{ id: string }>(
    `
      UPDATE agency
      SET
        manager_user_id = $1,
        updated_at = NOW()
      WHERE pending_manager_user_id = $1
        AND manager_user_id IS NULL
      RETURNING id
    `,
    [userId],
  );

  for (const row of result.rows) {
    await ensureAgencyMembership({
      id: `${row.id}-manager-${userId}`,
      agencyId: row.id,
      userId,
      role: "manager",
      seedSource: "manual_workflow_v1",
    });
    await ensureAgencyMembership({
      id: `${row.id}-agent-${userId}`,
      agencyId: row.id,
      userId,
      role: "agent",
      seedSource: "manual_workflow_v1",
    });
  }

  if (result.rows.length > 0) {
    await addRoleToUser(userId, "agency_manager");
    await addRoleToUser(userId, "agent");
  }
}

export async function createPropertyClaimRequestInDb(input: {
  userId: string;
  parcelId: string;
  upi: string;
  claimScope: PropertyClaimScope;
  unitLabel?: string;
  declaredPropertyType?: PropertyClaimPropertyType;
  tenureType: PropertyTenureType;
  tenureSource: PropertyDataSource;
  declaredAssetType?: PropertyKind;
  propertyFacts?: PropertyRecordFactsInput;
  propertyId?: string;
  propertyInternalId?: string;
}) {
  const normalizedUnitLabel = normalizeClaimUnitLabel(input.unitLabel);
  const ownershipScope = getOwnershipScopeForClaimScope(input.claimScope);

  const existingOwnership = await getPgPool().query<PropertyOwnershipRow>(
    `
      SELECT
        po.id,
        po.user_id,
        po.property_id,
        po.property_internal_id,
        po.parcel_id,
        po.ownership_scope,
        po.created_at::TEXT
      FROM property_ownership po
      LEFT JOIN property_asset pa
        ON pa.id = po.property_internal_id
      WHERE po.user_id = $1
        AND (
          ($2::TEXT IS NOT NULL AND po.property_internal_id = $2)
          OR (po.parcel_id = $4 AND po.ownership_scope = 'full')
          OR (
            $3 = 'unit'
            AND po.parcel_id = $4
            AND $5::TEXT IS NOT NULL
            AND UPPER(COALESCE(pa.unit_label, '')) = $5
          )
        )
      LIMIT 1
    `,
    [input.userId, input.propertyInternalId || null, ownershipScope, input.parcelId, normalizedUnitLabel],
  );

  if (existingOwnership.rows[0]) {
    return {
      outcome: "already_owned" as const,
      request: null,
    };
  }

  const existing = await getPgPool().query<PropertyClaimRequestRow>(
    `
      SELECT
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        declared_property_type,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
      FROM property_claim_request
      WHERE user_id = $1
        AND parcel_id = $2
        AND claim_scope = $3
        AND COALESCE(UPPER(unit_label), '') = COALESCE($4, '')
        AND status = 'pending'
      LIMIT 1
    `,
    [input.userId, input.parcelId, input.claimScope, normalizedUnitLabel],
  );

  if (existing.rows[0]) {
    return {
      outcome: "existing_pending" as const,
      request: toPropertyClaimRequest(existing.rows[0]),
    };
  }

  const id = createRecordId("property-claim");
  const result = await getPgPool().query<PropertyClaimRequestRow>(
    `
      INSERT INTO property_claim_request (
        id,
        user_id,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        user_id,
        'claim'::TEXT AS request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        declared_property_type,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        NULL::TEXT AS transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
    `,
    [
      id,
      input.userId,
      input.propertyId || null,
      input.propertyInternalId || null,
      input.parcelId,
      input.upi,
      input.claimScope,
      normalizedUnitLabel,
      input.declaredPropertyType || null,
      input.tenureType,
      input.tenureSource,
      input.declaredAssetType || null,
      input.propertyFacts?.representativeSize ?? null,
      input.propertyFacts?.zoning?.trim() || null,
      input.propertyFacts?.bedrooms ?? null,
      input.propertyFacts?.bathrooms ?? null,
      input.propertyFacts?.interiorAreaSqm ?? null,
      input.propertyFacts?.yearBuilt ?? null,
      input.propertyFacts?.description?.trim() || null,
    ],
  );

  return {
    outcome: "created" as const,
    request: toPropertyClaimRequest(result.rows[0]),
  };
}

export async function createOwnershipTransferRequestInDb(input: {
  sellerUserId: string;
  propertyInternalId: string;
  buyerEmail: string;
  transferMode: PropertyTransferMode;
  transferNote?: string;
}) {
  const normalizedBuyerEmail = input.buyerEmail.trim().toLowerCase();
  if (!normalizedBuyerEmail) {
    throw new Error("Buyer email is required");
  }

  const sellerOwnershipResult = await getPgPool().query<{
    property_id: string;
    property_internal_id: string;
    parcel_id: string;
    ownership_scope: PropertyOwnershipScope;
    unit_label: string | null;
    asset_type: PropertyKind | null;
    upi: string;
  }>(
    `
      SELECT
        po.property_id,
        po.property_internal_id,
        po.parcel_id,
        po.ownership_scope,
        pa.unit_label,
        pa.asset_type,
        parcel.upi
      FROM property_ownership po
      JOIN property_asset pa
        ON pa.id = po.property_internal_id
      JOIN parcel_app_ready_seed_preview parcel
        ON parcel.parcel_id = po.parcel_id
      WHERE po.user_id = $1
        AND po.property_internal_id = $2
      LIMIT 1
    `,
    [input.sellerUserId, input.propertyInternalId],
  );

  const sellerOwnership = sellerOwnershipResult.rows[0];
  if (!sellerOwnership) {
    throw new Error("Current user no longer owns this property");
  }

  const buyerResult = await getPgPool().query<{ id: string }>(
    `SELECT id FROM app_user WHERE LOWER(email) = $1 AND status = 'active' LIMIT 1`,
    [normalizedBuyerEmail],
  );
  const buyerId = buyerResult.rows[0]?.id;

  if (!buyerId) {
    throw new Error("No active Amazuga user exists for that email address yet");
  }

  if (buyerId === input.sellerUserId) {
    throw new Error("You cannot transfer a property to yourself");
  }

  const existingPendingTransferResult = await getPgPool().query<PropertyClaimRequestRow>(
    `
      SELECT
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
      FROM property_claim_request
      WHERE request_kind = 'transfer'
        AND property_internal_id = $1
        AND status = 'pending'
      LIMIT 1
    `,
    [input.propertyInternalId],
  );

  if (existingPendingTransferResult.rows[0]) {
    return {
      outcome: "existing_pending" as const,
      request: toPropertyClaimRequest(existingPendingTransferResult.rows[0]),
    };
  }

  const transferId = createRecordId("property-transfer");
  const result = await getPgPool().query<PropertyClaimRequestRow>(
    `
      INSERT INTO property_claim_request (
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        transfer_note,
        status,
        seed_source
      )
      VALUES ($1, $2, 'transfer', $3, $4, $5, $6, $7, $8, 'unspecified', 'unspecified', $9, $10, $11, $12, $13, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
    `,
    [
      transferId,
      buyerId,
      sellerOwnership.property_id,
      sellerOwnership.property_internal_id,
      sellerOwnership.parcel_id,
      sellerOwnership.upi,
      sellerOwnership.ownership_scope === "unit" ? "unit_partial" : "full_parcel",
      sellerOwnership.unit_label || null,
      sellerOwnership.asset_type,
      input.transferMode,
      input.sellerUserId,
      input.sellerUserId,
      input.transferNote?.trim() || null,
    ],
  );

  return {
    outcome: "created" as const,
    request: toPropertyClaimRequest(result.rows[0]),
  };
}

export async function respondToOwnershipTransferRequestInDb(input: {
  buyerUserId: string;
  claimRequestId: string;
  decision: "accept" | "decline";
}) {
  const result = await getPgPool().query<PropertyClaimRequestRow>(
    `
      UPDATE property_claim_request
      SET
        buyer_confirmed_at = CASE
          WHEN $3 = 'accept' THEN NOW()
          ELSE buyer_confirmed_at
        END,
        buyer_declined_at = CASE
          WHEN $3 = 'decline' THEN NOW()
          ELSE buyer_declined_at
        END,
        status = CASE
          WHEN $3 = 'decline' THEN 'denied'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND request_kind = 'transfer'
        AND status = 'pending'
      RETURNING
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
    `,
    [input.claimRequestId, input.buyerUserId, input.decision],
  );

  if (!result.rows[0]) {
    throw new Error("Transfer request not found or no longer open");
  }

  return toPropertyClaimRequest(result.rows[0]);
}

export async function updatePropertyClaimRequestStatusInDb(
  claimRequestId: string,
  status: SubmissionStatus,
) {
  const existingResult = await getPgPool().query<PropertyClaimRequestRow>(
    `
      SELECT
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
      FROM property_claim_request
      WHERE id = $1
      LIMIT 1
    `,
    [claimRequestId],
  );

  const existingClaimRequest = existingResult.rows[0] ? toPropertyClaimRequest(existingResult.rows[0]) : null;

  if (!existingClaimRequest) {
    return null;
  }

  if (status === "approved") {
    const declaredUnitType =
      existingClaimRequest.declaredAssetType === "apartment_unit"
      || existingClaimRequest.declaredAssetType === "commercial_unit";

    if (existingClaimRequest.claimScope === "full_parcel" && declaredUnitType) {
      throw new Error("Full-parcel claims must resolve to a top-level property, not a unit asset.");
    }

    if (existingClaimRequest.claimScope === "unit_partial" && existingClaimRequest.declaredAssetType && !declaredUnitType) {
      throw new Error("Unit claims must resolve to an apartment or commercial unit.");
    }

    if (!existingClaimRequest.propertyInternalId || !existingClaimRequest.propertyId) {
      if (existingClaimRequest.kind === "transfer") {
        throw new Error("This transfer request is missing its property target.");
      }

      if (existingClaimRequest.claimScope !== "full_parcel" || !existingClaimRequest.declaredAssetType) {
        throw new Error("This claim still needs to be resolved to a specific property or unit before approval.");
      }

      const parcelRow = await getPgPool().query<{ public_id: string | null }>(
        `SELECT public_id FROM parcel_app_ready_seed_preview WHERE parcel_id = $1 LIMIT 1`,
        [existingClaimRequest.parcelId],
      );
      const parcelPublicId = parcelRow.rows[0]?.public_id || existingClaimRequest.parcelId;

      // If a primary asset already exists (e.g. from mock seed data), update its type rather than inserting.
      const existingPrimaryRow = await getPgPool().query<{ id: string; public_id: string }>(
        `SELECT id, COALESCE(public_id, $2) AS public_id FROM property_asset WHERE parcel_id = $1 AND is_primary_for_parcel = TRUE LIMIT 1`,
        [existingClaimRequest.parcelId, parcelPublicId],
      );

      let assetId: string;
      let resolvedPublicId: string;

      if (existingPrimaryRow.rows[0]) {
        assetId = existingPrimaryRow.rows[0].id;
        resolvedPublicId = existingPrimaryRow.rows[0].public_id;
        await getPgPool().query(
          `UPDATE property_asset SET asset_type = $2, seed_source = 'claim_approval_v1', updated_at = NOW() WHERE id = $1`,
          [assetId, existingClaimRequest.declaredAssetType],
        );
      } else {
        assetId = "ast_" + createHash("md5").update("claim-primary:" + existingClaimRequest.parcelId).digest("hex").slice(0, 20);
        const displayCode = "AST-" + createHash("md5").update("claim-display:" + existingClaimRequest.parcelId).digest("hex").slice(0, 10).toUpperCase();
        resolvedPublicId = parcelPublicId;
        await getPgPool().query(
          `
            INSERT INTO property_asset (id, parcel_id, asset_type, public_id, display_code, is_primary_for_parcel, seed_source)
            VALUES ($1, $2, $3, $4, $5, TRUE, 'claim_approval_v1')
            ON CONFLICT (id) DO UPDATE SET asset_type = EXCLUDED.asset_type, updated_at = NOW()
          `,
          [assetId, existingClaimRequest.parcelId, existingClaimRequest.declaredAssetType, resolvedPublicId, displayCode],
        );
      }

      await getPgPool().query(
        `UPDATE property_claim_request SET property_internal_id = $2, property_id = $3, updated_at = NOW() WHERE id = $1`,
        [claimRequestId, assetId, resolvedPublicId],
      );

      existingClaimRequest.propertyInternalId = assetId;
      existingClaimRequest.propertyId = resolvedPublicId;
    }

    const targetResult = await getPgPool().query<{
      property_kind: PropertyKind | null;
    }>(
      `
        SELECT asset_type AS property_kind
        FROM property_asset
        WHERE id = $1
        LIMIT 1
      `,
      [existingClaimRequest.propertyInternalId],
    );

    const ownershipScope =
      existingClaimRequest.claimScope === "unit_partial"
        ? "unit"
        : getOwnershipScopeForPropertyKind(targetResult.rows[0]?.property_kind);
    if (existingClaimRequest.kind === "transfer") {
      if (!existingClaimRequest.transferFromUserId) {
        throw new Error("This transfer request is missing the current owner reference.");
      }

      if (!existingClaimRequest.buyerConfirmedAt) {
        throw new Error("The buyer still needs to accept this transfer before it can be approved.");
      }

      const currentOwnerResult = await getPgPool().query<{ user_id: string }>(
        `
          SELECT user_id
          FROM property_ownership
          WHERE property_internal_id = $1
          LIMIT 1
        `,
        [existingClaimRequest.propertyInternalId],
      );

      if (currentOwnerResult.rows[0]?.user_id !== existingClaimRequest.transferFromUserId) {
        throw new Error("The original owner no longer appears to own this property.");
      }
    } else {
      const ownershipConflict = await getPgPool().query<{ id: string }>(
        `
          SELECT id
          FROM property_ownership
          WHERE
            (
              property_internal_id = $1
              OR ($2 = 'full' AND parcel_id = $3)
              OR (ownership_scope = 'full' AND parcel_id = $3)
            )
            AND user_id <> $4
          LIMIT 1
        `,
        [existingClaimRequest.propertyInternalId, ownershipScope, existingClaimRequest.parcelId, existingClaimRequest.userId],
      );

      if (ownershipConflict.rows[0]) {
        throw new Error("This property or parcel already has an owner in Preview.");
      }
    }
  }

  const updateResult = await getPgPool().query<PropertyClaimRequestRow>(
    `
      UPDATE property_claim_request
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        user_id,
        request_kind,
        property_id,
        property_internal_id,
        parcel_id,
        upi,
        claim_scope,
        unit_label,
        tenure_type,
        tenure_source,
        declared_asset_type,
        representative_size,
        zoning,
        bedrooms,
        bathrooms,
        interior_area_sqm,
        year_built,
        description,
        transfer_mode,
        transfer_from_user_id,
        transfer_initiated_by_user_id,
        buyer_confirmed_at::TEXT,
        buyer_declined_at::TEXT,
        transfer_note,
        status,
        created_at::TEXT
    `,
    [claimRequestId, status],
  );

  const claimRequest = updateResult.rows[0] ? toPropertyClaimRequest(updateResult.rows[0]) : null;

  if (!claimRequest || status !== "approved") {
    return claimRequest;
  }

  const targetResult = await getPgPool().query<{
    property_kind: PropertyKind | null;
  }>(
    `
      SELECT asset_type AS property_kind
      FROM property_asset
      WHERE id = $1
      LIMIT 1
    `,
    [claimRequest.propertyInternalId],
  );

  if (!claimRequest.propertyInternalId || !claimRequest.propertyId) {
    throw new Error("This claim still needs to be resolved to a specific property or unit before approval.");
  }

  await backfillPropertyRecordForAsset({
    propertyAssetId: claimRequest.propertyInternalId,
    userId: claimRequest.userId,
    claimUnitLabel: claimRequest.unitLabel,
    propertyFacts: claimRequest.propertyFacts,
  });

  const ownershipScope =
    claimRequest.claimScope === "unit_partial" ? "unit" : getOwnershipScopeForPropertyKind(targetResult.rows[0]?.property_kind);
  const ownershipId = `property-ownership-${claimRequest.propertyInternalId}`;

  if (claimRequest.kind === "transfer") {
    await getPgPool().query(
      `
        UPDATE listing
        SET
          status = 'archived',
          updated_at = NOW()
        WHERE property_asset_id = $1
          AND status IN ('draft', 'active', 'inactive')
      `,
      [claimRequest.propertyInternalId],
    );
  }

  await getPgPool().query(
    `
      INSERT INTO property_ownership (
        id,
        user_id,
        property_id,
        property_internal_id,
        parcel_id,
        ownership_scope,
        created_from_claim_request_id,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual_workflow_v1')
      ON CONFLICT (property_internal_id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        property_id = EXCLUDED.property_id,
        parcel_id = EXCLUDED.parcel_id,
        ownership_scope = EXCLUDED.ownership_scope,
        created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
        seed_source = EXCLUDED.seed_source,
        updated_at = NOW()
    `,
    [
      ownershipId,
      claimRequest.userId,
      claimRequest.propertyId,
      claimRequest.propertyInternalId,
      claimRequest.parcelId,
      ownershipScope,
      claimRequest.id,
    ],
  );

  await addRoleToUser(claimRequest.userId, "private_lister");

  return claimRequest;
}
