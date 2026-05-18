import "server-only";

import type {
  Agency,
  AgencyApplication,
  AgentApplication,
  PropertyClaimRequest,
  PropertyOwnership,
  PropertyOwnershipScope,
  PropertyKind,
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
  property_id: string;
  property_internal_id: string;
  parcel_id: string;
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

interface AdminPropertyClaimRequestRow extends PropertyClaimRequestRow {
  property_route_id: string | null;
  property_title: string | null;
  property_kind: PropertyKind | null;
  district: string | null;
  sector: string | null;
  user_full_name: string | null;
}

export interface AdminPropertyClaimRequest extends PropertyClaimRequest {
  propertyRouteId?: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  userFullName: string;
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

function toPropertyClaimRequest(row: PropertyClaimRequestRow): PropertyClaimRequest {
  return {
    id: row.id,
    userId: row.user_id,
    propertyId: row.property_id,
    propertyInternalId: row.property_internal_id,
    parcelId: row.parcel_id,
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
  return {
    id: row.id,
    userId: row.user_id,
    userFullName: row.user_full_name || row.user_id,
    propertyId: row.property_id,
    propertyInternalId: row.property_internal_id,
    parcelId: row.parcel_id,
    propertyRouteId: row.property_route_id || undefined,
    propertyTitle: row.property_title || row.property_route_id || row.property_id || "Preview property",
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    status: row.status,
    createdAt: row.created_at,
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

export async function listPropertyClaimRequestsFromDb() {
  const result = await getPgPool().query<AdminPropertyClaimRequestRow>(
    `
      SELECT
        pcr.id,
        pcr.user_id,
        pcr.property_id,
        pcr.property_internal_id,
        pcr.parcel_id,
        pcr.status,
        pcr.created_at::TEXT,
        COALESCE(pa.public_id, parcel.public_id) AS property_route_id,
        COALESCE(pa.title, pp.title, parcel.display_id, pa.public_id, parcel.public_id, parcel.parcel_id) AS property_title,
        pa.asset_type AS property_kind,
        parcel.district,
        parcel.sector,
        claimant.full_name AS user_full_name
      FROM property_claim_request pcr
      JOIN app_user claimant
        ON claimant.id = pcr.user_id
      JOIN parcel_app_ready_seed_preview parcel
        ON parcel.parcel_id = pcr.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = pcr.property_internal_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = pcr.parcel_id
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
        property_id,
        property_internal_id,
        parcel_id,
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
          property_id,
          property_internal_id,
          parcel_id,
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
        prop.property_route_id,
        prop.property_title,
        prop.district,
        prop.sector
      FROM valuation_submission vs
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
          COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
          p.district,
          p.sector
        FROM parcel_app_ready_seed_preview p
        LEFT JOIN property_profile pp
          ON pp.parcel_id = p.parcel_id
        LEFT JOIN property_asset pa
          ON pa.parcel_id = p.parcel_id
         AND (
           pa.id = vs.property_asset_id
           OR pa.public_id = vs.property_id
           OR (vs.property_asset_id IS NULL AND pa.is_primary_for_parcel)
         )
        WHERE
          (vs.property_asset_id IS NOT NULL AND pa.id = vs.property_asset_id)
          OR p.public_id = vs.property_id
          OR p.parcel_id = vs.property_id
        ORDER BY
          CASE
            WHEN vs.property_asset_id IS NOT NULL AND pa.id = vs.property_asset_id THEN 0
            WHEN pa.public_id = vs.property_id THEN 1
            WHEN pa.is_primary_for_parcel THEN 2
            ELSE 3
          END,
          pa.created_at ASC NULLS LAST,
          p.parcel_id ASC
        LIMIT 1
      ) prop
        ON TRUE
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
  propertyId: string;
  propertyInternalId: string;
  parcelId: string;
}) {
  const existingOwnership = await getPgPool().query<PropertyOwnershipRow>(
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
    [input.userId, input.propertyInternalId],
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
        property_id,
        property_internal_id,
        parcel_id,
        status,
        created_at::TEXT
      FROM property_claim_request
      WHERE user_id = $1
        AND property_internal_id = $2
        AND status = 'pending'
      LIMIT 1
    `,
    [input.userId, input.propertyInternalId],
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
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, 'pending', 'manual_workflow_v1')
      RETURNING
        id,
        user_id,
        property_id,
        property_internal_id,
        parcel_id,
        status,
        created_at::TEXT
    `,
    [id, input.userId, input.propertyId, input.propertyInternalId, input.parcelId],
  );

  return {
    outcome: "created" as const,
    request: toPropertyClaimRequest(result.rows[0]),
  };
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
        property_id,
        property_internal_id,
        parcel_id,
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

    const ownershipScope = getOwnershipScopeForPropertyKind(targetResult.rows[0]?.property_kind);
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
        property_id,
        property_internal_id,
        parcel_id,
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

  const ownershipScope = getOwnershipScopeForPropertyKind(targetResult.rows[0]?.property_kind);
  const ownershipId = `property-ownership-${claimRequest.propertyInternalId}`;
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

  return claimRequest;
}
