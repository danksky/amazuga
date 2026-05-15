import "server-only";

import type {
  Agency,
  AgencyApplication,
  AgentApplication,
  PropertyClaimRequest,
  Role,
  SubmissionStatus,
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
    await ensureAgencyMembership({
      id: `${agencyId}-agent-${application.createdByUserId}`,
      agencyId,
      userId: application.createdByUserId,
      role: "agent",
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
    return toPropertyClaimRequest(existing.rows[0]);
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

  return toPropertyClaimRequest(result.rows[0]);
}
