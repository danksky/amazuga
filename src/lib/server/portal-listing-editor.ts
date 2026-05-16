import "server-only";

import { randomUUID } from "node:crypto";

import type { Listing } from "@/types/domain";

import { getPortalAgencyWorkspaceData } from "./portal-agency";
import { getPgPool } from "./postgres";

interface PropertyOptionRow {
  property_asset_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: string | null;
  district: string | null;
  sector: string | null;
  active_listing_id: string | null;
}

interface EditableListingRow {
  listing_id: string;
  property_asset_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: string | null;
  district: string | null;
  sector: string | null;
  agency_id: string;
  agent_user_id: string;
  status: Listing["status"];
  marketing_type: Listing["marketingType"];
  asking_price_rwf: number | string;
  headline: string | null;
  description: string | null;
}

interface PropertyTargetRow {
  property_asset_id: string;
  parcel_id: string;
  property_route_id: string;
  property_title: string | null;
}

export interface PortalListingAgencyOption {
  agencyId: string;
  businessName: string;
  membershipRole: "agent" | "manager";
  members: Array<{
    userId: string;
    fullName: string;
    membershipRole: "agent" | "manager";
  }>;
}

export interface PortalListingPropertyOption {
  propertyAssetId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: string;
  district: string;
  sector?: string;
}

export interface PortalEditableListing {
  id: string;
  propertyAssetId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: string;
  district: string;
  sector?: string;
  agencyId: string;
  agentUserId: string;
  status: Listing["status"];
  marketingType: Listing["marketingType"];
  askingPrice: number;
  headline?: string;
  description?: string;
}

export interface PortalListingEditorData {
  agencies: PortalListingAgencyOption[];
  propertyOptions: PortalListingPropertyOption[];
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizePropertyTitle(input: { propertyTitle?: string | null; propertyRouteId: string }) {
  return input.propertyTitle?.trim() || input.propertyRouteId;
}

async function getAccessibleListingAgencies(userId: string): Promise<PortalListingAgencyOption[]> {
  const workspace = await getPortalAgencyWorkspaceData(userId);

  return workspace.agencies.map((agency) => ({
    agencyId: agency.agencyId,
    businessName: agency.businessName,
    membershipRole: agency.membershipRole,
    members: agency.members.map((member) => ({
      userId: member.userId,
      fullName: member.fullName,
      membershipRole: member.membershipRole,
    })),
  }));
}

async function listAvailablePropertyOptions(): Promise<PortalListingPropertyOption[]> {
  const result = await getPgPool().query<PropertyOptionRow>(
    `
      SELECT
        pa.id AS property_asset_id,
        pa.public_id AS property_route_id,
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
        pa.asset_type AS property_kind,
        p.district,
        p.sector,
        active_listing.id AS active_listing_id
      FROM property_asset pa
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = pa.parcel_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = pa.parcel_id
      LEFT JOIN listing active_listing
        ON active_listing.property_asset_id = pa.id
       AND active_listing.status = 'active'
      WHERE active_listing.id IS NULL
      ORDER BY
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) ASC,
        pa.public_id ASC
    `,
  );

  return result.rows.map((row) => ({
    propertyAssetId: row.property_asset_id,
    propertyRouteId: row.property_route_id,
    propertyTitle: normalizePropertyTitle({
      propertyTitle: row.property_title,
      propertyRouteId: row.property_route_id,
    }),
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
  }));
}

async function resolvePropertyTarget(propertyRouteId: string) {
  const result = await getPgPool().query<PropertyTargetRow>(
    `
      WITH target_parcel AS (
        SELECT p.parcel_id
        FROM parcel_app_ready_seed_preview p
        WHERE p.public_id = $1
           OR p.parcel_id = $1
        UNION
        SELECT pa.parcel_id
        FROM property_asset pa
        WHERE pa.public_id = $1
           OR pa.id = $1
        LIMIT 1
      )
      SELECT
        pa.id AS property_asset_id,
        p.parcel_id,
        pa.public_id AS property_route_id,
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title
      FROM target_parcel tp
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = tp.parcel_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = p.parcel_id
      LEFT JOIN LATERAL (
        SELECT pa_inner.id, pa_inner.public_id, pa_inner.title
        FROM property_asset pa_inner
        LEFT JOIN listing active_listing
          ON active_listing.property_asset_id = pa_inner.id
         AND active_listing.status = 'active'
        WHERE pa_inner.parcel_id = p.parcel_id
        ORDER BY
          CASE
            WHEN pa_inner.public_id = $1 THEN 0
            WHEN pa_inner.id = $1 THEN 0
            WHEN pa_inner.is_primary_for_parcel THEN 1
            ELSE 2
          END,
          pa_inner.created_at ASC,
          pa_inner.id ASC
        LIMIT 1
      ) pa
        ON TRUE
      LIMIT 1
    `,
    [propertyRouteId],
  );

  return result.rows[0];
}

async function getEditableListingRow(userId: string, listingId: string) {
  const agencies = await getAccessibleListingAgencies(userId);
  const agencyIds = agencies.map((agency) => agency.agencyId);

  if (agencyIds.length === 0) {
    return null;
  }

  const result = await getPgPool().query<EditableListingRow>(
    `
      SELECT
        l.id AS listing_id,
        l.property_asset_id,
        COALESCE(pa.public_id, p.public_id, p.parcel_id) AS property_route_id,
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
        pa.asset_type AS property_kind,
        p.district,
        p.sector,
        l.agency_id,
        l.agent_user_id,
        l.status,
        l.marketing_type,
        l.asking_price_rwf,
        l.headline,
        l.description
      FROM listing l
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = l.parcel_id
      WHERE l.id = $1
        AND l.agency_id = ANY($2::TEXT[])
      LIMIT 1
    `,
    [listingId, agencyIds],
  );

  return result.rows[0] || null;
}

async function ensureAgentBelongsToAgency(input: {
  agencies: PortalListingAgencyOption[];
  agencyId: string;
  agentUserId: string;
}) {
  const agency = input.agencies.find((candidate) => candidate.agencyId === input.agencyId);

  if (!agency) {
    throw new Error("Current user cannot manage listings for this agency");
  }

  const agent = agency.members.find((member) => member.userId === input.agentUserId);

  if (!agent) {
    throw new Error("Selected agent is not an active member of this agency");
  }

  return { agency, agent };
}

async function ensureNoOtherActiveListing(propertyAssetId: string, exceptListingId?: string) {
  const result = await getPgPool().query<{ id: string }>(
    `
      SELECT id
      FROM listing
      WHERE property_asset_id = $1
        AND status = 'active'
        AND ($2::TEXT IS NULL OR id <> $2)
      LIMIT 1
    `,
    [propertyAssetId, exceptListingId || null],
  );

  if (result.rows[0]) {
    throw new Error("This property already has an active listing");
  }
}

export async function getPortalListingEditorData(userId: string): Promise<PortalListingEditorData> {
  const [agencies, propertyOptions] = await Promise.all([
    getAccessibleListingAgencies(userId),
    listAvailablePropertyOptions(),
  ]);

  return {
    agencies,
    propertyOptions,
  };
}

export async function getEditablePortalListingData(userId: string, listingId: string) {
  const [agencies, row] = await Promise.all([
    getAccessibleListingAgencies(userId),
    getEditableListingRow(userId, listingId),
  ]);

  if (!row) {
    return null;
  }

  const listing: PortalEditableListing = {
    id: row.listing_id,
    propertyAssetId: row.property_asset_id,
    propertyRouteId: row.property_route_id,
    propertyTitle: normalizePropertyTitle({
      propertyTitle: row.property_title,
      propertyRouteId: row.property_route_id,
    }),
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    agencyId: row.agency_id,
    agentUserId: row.agent_user_id,
    status: row.status,
    marketingType: row.marketing_type,
    askingPrice: toNumber(row.asking_price_rwf) ?? 0,
    headline: row.headline || undefined,
    description: row.description || undefined,
  };

  return {
    agencies,
    listing,
  };
}

export async function createPortalListingInDb(input: {
  userId: string;
  agencyId: string;
  propertyRouteId: string;
  agentUserId: string;
  marketingType: Listing["marketingType"];
  askingPrice: number;
  headline?: string;
  description?: string;
}) {
  const agencies = await getAccessibleListingAgencies(input.userId);
  await ensureAgentBelongsToAgency({
    agencies,
    agencyId: input.agencyId,
    agentUserId: input.agentUserId,
  });

  const propertyTarget = await resolvePropertyTarget(input.propertyRouteId);

  if (!propertyTarget?.property_asset_id) {
    throw new Error("Could not resolve property for listing creation");
  }

  await ensureNoOtherActiveListing(propertyTarget.property_asset_id);

  const id = `listing-${randomUUID()}`;
  await getPgPool().query(
    `
      INSERT INTO listing (
        id,
        parcel_id,
        property_asset_id,
        agency_id,
        agent_user_id,
        status,
        marketing_type,
        asking_price_rwf,
        currency,
        headline,
        description,
        seed_source,
        published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, 'RWF', $8, $9, 'manual_workflow_v1', NOW())
    `,
    [
      id,
      propertyTarget.parcel_id,
      propertyTarget.property_asset_id,
      input.agencyId,
      input.agentUserId,
      input.marketingType,
      Math.round(input.askingPrice),
      input.headline || null,
      input.description || null,
    ],
  );

  return {
    listingId: id,
    propertyRouteId: propertyTarget.property_route_id,
    marketingType: input.marketingType,
  };
}

export async function updatePortalListingInDb(input: {
  userId: string;
  listingId: string;
  agentUserId: string;
  marketingType: Listing["marketingType"];
  askingPrice: number;
  headline?: string;
  description?: string;
}) {
  const agencies = await getAccessibleListingAgencies(input.userId);
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  await ensureAgentBelongsToAgency({
    agencies,
    agencyId: listing.agency_id,
    agentUserId: input.agentUserId,
  });

  const result = await getPgPool().query<{
    property_route_id: string;
    marketing_type: Listing["marketingType"];
  }>(
    `
      UPDATE listing
      SET
        agent_user_id = $2,
        marketing_type = $3,
        asking_price_rwf = $4,
        headline = $5,
        description = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        (
          SELECT COALESCE(pa.public_id, p.public_id, p.parcel_id)
          FROM parcel_app_ready_seed_preview p
          LEFT JOIN property_asset pa
            ON pa.id = listing.property_asset_id
          WHERE p.parcel_id = listing.parcel_id
          LIMIT 1
        ) AS property_route_id,
        marketing_type
    `,
    [
      input.listingId,
      input.agentUserId,
      input.marketingType,
      Math.round(input.askingPrice),
      input.headline || null,
      input.description || null,
    ],
  );

  return {
    listingId: input.listingId,
    propertyRouteId: result.rows[0]?.property_route_id,
    marketingType: result.rows[0]?.marketing_type ?? input.marketingType,
  };
}

export async function setPortalListingStatusInDb(input: {
  userId: string;
  listingId: string;
  status: "active" | "inactive";
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  if (input.status === "active") {
    await ensureNoOtherActiveListing(listing.property_asset_id, listing.listing_id);
  }

  const result = await getPgPool().query<{
    property_route_id: string;
    marketing_type: Listing["marketingType"];
  }>(
    `
      UPDATE listing
      SET
        status = $2,
        published_at = CASE
          WHEN $2 = 'active' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        (
          SELECT COALESCE(pa.public_id, p.public_id, p.parcel_id)
          FROM parcel_app_ready_seed_preview p
          LEFT JOIN property_asset pa
            ON pa.id = listing.property_asset_id
          WHERE p.parcel_id = listing.parcel_id
          LIMIT 1
        ) AS property_route_id,
        marketing_type
    `,
    [input.listingId, input.status],
  );

  return {
    listingId: input.listingId,
    propertyRouteId: result.rows[0]?.property_route_id,
    marketingType: result.rows[0]?.marketing_type ?? listing.marketing_type,
  };
}
