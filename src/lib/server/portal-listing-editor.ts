import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import type { Listing, ListingVisibility } from "@/types/domain";

import { getPortalAgencyWorkspaceData } from "./portal-agency";
import { getPgPool } from "./postgres";

interface PropertyOptionRow {
  property_asset_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: string | null;
  property_unit_label: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  representative_size: number | string | null;
  zoning: string | null;
  district: string | null;
  sector: string | null;
  open_listing_id: string | null;
}

interface EditableListingRow {
  listing_id: string;
  property_asset_id: string;
  property_route_id: string;
  property_title: string | null;
  property_kind: string | null;
  district: string | null;
  sector: string | null;
  agency_id: string | null;
  agent_user_id: string;
  status: Listing["status"];
  visibility: ListingVisibility;
  marketing_type: Listing["marketingType"];
  asking_price_rwf: number | string | null;
  description: string | null;
  campaign_index: number;
}

interface EditableListingImageRow {
  id: string;
  image_url: string;
  storage_key: string | null;
  width: number | string | null;
  height: number | string | null;
  content_type: string | null;
  file_size_bytes: number | string | null;
  status: "ready" | "processing" | "failed" | "pending_delete" | "delete_failed";
  sort_order: number | string;
  uploaded_by_user_id?: string | null;
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

export interface ListingPriceHistoryEntry {
  id: string;
  priceRwf: number;
  changedAt: string;
  campaignIndex: number;
}

export interface ListingAccessGrant {
  id: string;
  grantedToUserId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

export interface PortalEditableListing {
  id: string;
  propertyAssetId: string;
  propertyRouteId: string;
  propertyTitle: string;
  propertyKind?: string;
  district: string;
  sector?: string;
  agencyId?: string;
  agentUserId: string;
  status: Listing["status"];
  visibility: ListingVisibility;
  marketingType: Listing["marketingType"];
  askingPrice?: number;
  description?: string;
  images: Array<{
    id: string;
    imageUrl: string;
    storageKey?: string;
    width?: number;
    height?: number;
    contentType?: string;
    fileSizeBytes?: number;
    status: "ready" | "processing" | "failed" | "pending_delete" | "delete_failed";
    sortOrder: number;
  }>;
  priceHistory: ListingPriceHistoryEntry[];
  accessGrants: ListingAccessGrant[];
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

function hasNonEmptyText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function isListingReadyForAsset(input: {
  propertyKind?: string | null;
  propertyTitle?: string | null;
  propertyUnitLabel?: string | null;
  bedrooms?: number | string | null;
  bathrooms?: number | string | null;
  interiorAreaSqm?: number | string | null;
  representativeSize?: number | string | null;
  zoning?: string | null;
}) {
  const hasTitle = Boolean(input.propertyTitle?.trim());
  const hasUnitLabel = Boolean(input.propertyUnitLabel?.trim()) || hasTitle;
  const hasBedrooms = toNumber(input.bedrooms) != null;
  const hasBathrooms = toNumber(input.bathrooms) != null;
  const hasInteriorArea = toNumber(input.interiorAreaSqm) != null;
  const hasRepresentativeSize = toNumber(input.representativeSize) != null;
  const hasZoning = Boolean(input.zoning?.trim());

  switch (input.propertyKind) {
    case "house":
      return hasTitle && hasInteriorArea && hasRepresentativeSize && hasBedrooms && hasBathrooms;
    case "apartment_unit":
      return hasUnitLabel && hasInteriorArea && hasBedrooms && hasBathrooms;
    case "building":
      return hasTitle && hasInteriorArea && hasRepresentativeSize && hasZoning;
    case "commercial_unit":
      return hasUnitLabel && hasInteriorArea && hasZoning;
    case "land":
      return hasTitle && hasRepresentativeSize && hasZoning;
    case "mixed_use":
      return hasTitle && hasInteriorArea && hasRepresentativeSize && hasZoning;
    case "other":
    default:
      return hasTitle;
  }
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

async function listAvailablePropertyOptions(userId: string): Promise<PortalListingPropertyOption[]> {
  const result = await getPgPool().query<PropertyOptionRow>(
    `
      SELECT
        pa.id AS property_asset_id,
        pa.public_id AS property_route_id,
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) AS property_title,
        pa.asset_type AS property_kind,
        pa.unit_label AS property_unit_label,
        pp.bedrooms,
        pp.bathrooms,
        pp.interior_area_sqm,
        p.representative_size,
        p.zoning,
        p.district,
        p.sector,
        open_listing.id AS open_listing_id
      FROM property_ownership po
      JOIN property_asset pa
        ON pa.id = po.property_internal_id
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = pa.parcel_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = pa.parcel_id
      LEFT JOIN listing open_listing
        ON open_listing.property_asset_id = pa.id
       AND open_listing.status IN ('draft', 'active', 'inactive')
      WHERE po.user_id = $1
        AND open_listing.id IS NULL
      ORDER BY
        COALESCE(pa.title, pp.title, p.display_id, p.public_id, p.parcel_id) ASC,
        pa.public_id ASC
    `,
    [userId],
  );

  return result.rows
    .filter((row) =>
      isListingReadyForAsset({
        propertyKind: row.property_kind,
        propertyTitle: row.property_title,
        propertyUnitLabel: row.property_unit_label,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        interiorAreaSqm: row.interior_area_sqm,
        representativeSize: row.representative_size,
        zoning: row.zoning,
      }),
    )
    .map((row) => ({
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
        UNION
        SELECT pa.parcel_id
        FROM property_asset pa
        WHERE pa.public_id = $1
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
        l.visibility,
        l.marketing_type,
        l.asking_price_rwf,
        l.description,
        l.campaign_index
      FROM listing l
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = l.parcel_id
      WHERE l.id = $1
        AND (
          (array_length($2::TEXT[], 1) > 0 AND l.agency_id = ANY($2::TEXT[]))
          OR EXISTS (
            SELECT 1 FROM property_ownership po
            WHERE po.user_id = $3
              AND po.property_internal_id = l.property_asset_id
          )
        )
      LIMIT 1
    `,
    [listingId, agencyIds, userId],
  );

  return result.rows[0] || null;
}

async function getEditableListingImages(listingId: string) {
  const result = await getPgPool().query<EditableListingImageRow>(
    `
      SELECT
        li.id,
        li.image_url,
        to_jsonb(li)->>'storage_key' AS storage_key,
        to_jsonb(li)->>'width' AS width,
        to_jsonb(li)->>'height' AS height,
        to_jsonb(li)->>'content_type' AS content_type,
        to_jsonb(li)->>'file_size_bytes' AS file_size_bytes,
        COALESCE(to_jsonb(li)->>'status', 'ready') AS status,
        li.sort_order
      FROM listing_image li
      WHERE li.listing_id = $1
        AND COALESCE(to_jsonb(li)->>'status', 'ready') = 'ready'
      ORDER BY li.sort_order ASC, li.created_at ASC, li.id ASC
    `,
    [listingId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    storageKey: row.storage_key || undefined,
    width: toNumber(row.width),
    height: toNumber(row.height),
    contentType: row.content_type || undefined,
    fileSizeBytes: toNumber(row.file_size_bytes),
    status: row.status,
    sortOrder: toNumber(row.sort_order) ?? 0,
  }));
}

async function countReadyListingImages(client: PoolClient, listingId: string) {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::TEXT AS count
      FROM listing_image
      WHERE listing_id = $1
        AND COALESCE(to_jsonb(listing_image)->>'status', 'ready') = 'ready'
    `,
    [listingId],
  );

  return Number(result.rows[0]?.count ?? 0);
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

async function ensureNoExistingOpenListing(propertyAssetId: string, exceptListingId?: string) {
  const result = await getPgPool().query<{ id: string }>(
    `
      SELECT id
      FROM listing
      WHERE property_asset_id = $1
        AND status IN ('draft', 'active', 'inactive')
        AND ($2::TEXT IS NULL OR id <> $2)
      LIMIT 1
    `,
    [propertyAssetId, exceptListingId || null],
  );

  if (result.rows[0]) {
    throw new Error("This property already has an open listing or draft");
  }
}

async function ensureCurrentUserOwnsProperty(userId: string, propertyAssetId: string) {
  const result = await getPgPool().query<{ id: string }>(
    `
      SELECT id
      FROM property_ownership
      WHERE user_id = $1
        AND property_internal_id = $2
      LIMIT 1
    `,
    [userId, propertyAssetId],
  );

  if (!result.rows[0]) {
    throw new Error("Current user does not own this property yet");
  }
}

async function getListingPriceHistory(listingId: string): Promise<ListingPriceHistoryEntry[]> {
  const result = await getPgPool().query<{
    id: string;
    price_rwf: string | number;
    changed_at: string;
    campaign_index: number;
  }>(
    `SELECT id, price_rwf, changed_at::TEXT, campaign_index
     FROM listing_price_history
     WHERE listing_id = $1
     ORDER BY campaign_index DESC, changed_at DESC
     LIMIT 20`,
    [listingId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    priceRwf: Number(row.price_rwf),
    changedAt: row.changed_at,
    campaignIndex: row.campaign_index,
  }));
}

async function getListingAccessGrants(listingId: string): Promise<ListingAccessGrant[]> {
  const result = await getPgPool().query<{
    id: string;
    granted_to_user_id: string;
    full_name: string;
    email: string;
    created_at: string;
  }>(
    `SELECT lag.id, lag.granted_to_user_id, u.full_name, u.email, lag.created_at::TEXT
     FROM listing_access_grant lag
     JOIN app_user u ON u.id = lag.granted_to_user_id
     WHERE lag.listing_id = $1
     ORDER BY lag.created_at ASC`,
    [listingId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    grantedToUserId: row.granted_to_user_id,
    userName: row.full_name,
    userEmail: row.email,
    createdAt: row.created_at,
  }));
}

export async function addListingAccessGrantInDb(input: {
  userId: string;
  listingId: string;
  grantedToEmail: string;
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);
  if (!listing) throw new Error("Listing not found or inaccessible");

  const targetUser = await getPgPool().query<{ id: string }>(
    `SELECT id FROM app_user WHERE LOWER(email) = LOWER($1) AND status = 'active' LIMIT 1`,
    [input.grantedToEmail],
  );

  if (!targetUser.rows[0]) throw new Error("No active user found with that email address");

  const grantedToUserId = targetUser.rows[0].id;
  const id = `lag_${randomUUID().replace(/-/g, "")}`;

  await getPgPool().query(
    `INSERT INTO listing_access_grant (id, listing_id, granted_to_user_id, granted_by_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (listing_id, granted_to_user_id) DO NOTHING`,
    [id, input.listingId, grantedToUserId, input.userId],
  );
}

export async function removeListingAccessGrantInDb(input: {
  userId: string;
  listingId: string;
  grantId: string;
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);
  if (!listing) throw new Error("Listing not found or inaccessible");

  await getPgPool().query(
    `DELETE FROM listing_access_grant WHERE id = $1 AND listing_id = $2`,
    [input.grantId, input.listingId],
  );
}

export async function getPortalListingEditorData(userId: string): Promise<PortalListingEditorData> {
  const [agencies, propertyOptions] = await Promise.all([
    getAccessibleListingAgencies(userId),
    listAvailablePropertyOptions(userId),
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

  const [images, priceHistory, accessGrants] = await Promise.all([
    getEditableListingImages(listingId),
    getListingPriceHistory(listingId),
    getListingAccessGrants(listingId),
  ]);
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
    agencyId: row.agency_id ?? undefined,
    agentUserId: row.agent_user_id,
    status: row.status,
    visibility: row.visibility,
    marketingType: row.marketing_type,
    askingPrice: toNumber(row.asking_price_rwf),
    description: row.description || undefined,
    images,
    priceHistory,
    accessGrants,
  };

  return {
    agencies,
    listing,
  };
}

export async function getEditablePortalListingSummary(userId: string, listingId: string) {
  const row = await getEditableListingRow(userId, listingId);

  if (!row) {
    return null;
  }

  return {
    listingId: row.listing_id,
    propertyRouteId: row.property_route_id,
    propertyTitle: normalizePropertyTitle({
      propertyTitle: row.property_title,
      propertyRouteId: row.property_route_id,
    }),
    images: await getEditableListingImages(listingId),
  };
}

export async function addListingImageToDb(input: {
  userId: string;
  listingId: string;
  imageUrl: string;
  storageKey: string;
  width?: number;
  height?: number;
  contentType?: string;
  fileSizeBytes?: number;
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  const countResult = await getPgPool().query<{ count: string }>(
    `
      SELECT COUNT(*)::TEXT AS count
      FROM listing_image
      WHERE listing_id = $1
        AND COALESCE(to_jsonb(listing_image)->>'status', 'ready') NOT IN ('pending_delete', 'delete_failed')
    `,
    [input.listingId],
  );

  const currentCount = Number(countResult.rows[0]?.count ?? 0);
  if (currentCount >= 12) {
    throw new Error("This listing already has the maximum number of photos");
  }

  const orderResult = await getPgPool().query<{ next_sort_order: number | string | null }>(
    `
      SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_sort_order
      FROM listing_image
      WHERE listing_id = $1
    `,
    [input.listingId],
  );

  const id = `listing-image-${randomUUID()}`;
  const sortOrder = toNumber(orderResult.rows[0]?.next_sort_order) ?? currentCount;

  const result = await getPgPool().query<EditableListingImageRow>(
    `
      INSERT INTO listing_image (
        id,
        listing_id,
        sort_order,
        image_url,
        storage_key,
        content_type,
        width,
        height,
        file_size_bytes,
        uploaded_by_user_id,
        status,
        seed_source
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', 'manual_upload_v1')
      RETURNING
        id,
        image_url,
        storage_key,
        width,
        height,
        content_type,
        file_size_bytes,
        status,
        sort_order
    `,
    [
      id,
      input.listingId,
      sortOrder,
      input.imageUrl,
      input.storageKey,
      input.contentType || "image/jpeg",
      input.width || null,
      input.height || null,
      input.fileSizeBytes || null,
      input.userId,
    ],
  );

  const row = result.rows[0];

  return row
    ? {
        id: row.id,
        imageUrl: row.image_url,
        storageKey: row.storage_key || undefined,
        width: toNumber(row.width),
        height: toNumber(row.height),
        contentType: row.content_type || undefined,
        fileSizeBytes: toNumber(row.file_size_bytes),
        status: row.status,
        sortOrder: toNumber(row.sort_order) ?? sortOrder,
      }
    : null;
}

export async function queueListingImageDeletion(input: {
  userId: string;
  listingId: string;
  imageId: string;
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");

    const imageResult = await client.query<EditableListingImageRow>(
      `
        SELECT
          li.id,
          li.image_url,
          to_jsonb(li)->>'storage_key' AS storage_key,
          to_jsonb(li)->>'width' AS width,
          to_jsonb(li)->>'height' AS height,
          to_jsonb(li)->>'content_type' AS content_type,
          to_jsonb(li)->>'file_size_bytes' AS file_size_bytes,
          COALESCE(to_jsonb(li)->>'status', 'ready') AS status,
          li.sort_order,
          to_jsonb(li)->>'uploaded_by_user_id' AS uploaded_by_user_id
        FROM listing_image li
        WHERE li.id = $1
          AND li.listing_id = $2
        LIMIT 1
        FOR UPDATE
      `,
      [input.imageId, input.listingId],
    );

    const image = imageResult.rows[0];

    if (!image) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!image.storage_key) {
      await client.query(
        `
          DELETE FROM listing_image
          WHERE id = $1
            AND listing_id = $2
        `,
        [input.imageId, input.listingId],
      );
      await client.query("COMMIT");

      return {
        imageId: image.id,
        storageKey: undefined,
        uploadedByUserId: image.uploaded_by_user_id || null,
        queuedCleanupJobId: null,
        deletedImmediately: true,
      };
    }

    await client.query(
      `
        UPDATE listing_image
        SET status = 'pending_delete'
        WHERE id = $1
          AND listing_id = $2
      `,
      [input.imageId, input.listingId],
    );

    const cleanupJobResult = await client.query<{ id: string }>(
      `
        INSERT INTO listing_image_cleanup_job (
          id,
          image_id,
          listing_id,
          storage_key,
          uploaded_by_user_id,
          status,
          run_after
        )
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
        ON CONFLICT (storage_key)
        DO UPDATE
        SET status = 'pending',
            run_after = NOW(),
            locked_at = NULL,
            last_error = NULL,
            updated_at = NOW(),
            uploaded_by_user_id = COALESCE(EXCLUDED.uploaded_by_user_id, listing_image_cleanup_job.uploaded_by_user_id)
        RETURNING id
      `,
      [randomUUID(), image.id, input.listingId, image.storage_key, image.uploaded_by_user_id || null],
    );

    await client.query("COMMIT");

    return {
      imageId: image.id,
      storageKey: image.storage_key,
      uploadedByUserId: image.uploaded_by_user_id || null,
      queuedCleanupJobId: cleanupJobResult.rows[0]?.id ?? null,
      deletedImmediately: false,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createPortalListingInDb(input: {
  userId: string;
  agencyId?: string;
  propertyRouteId: string;
  agentUserId: string;
  marketingType: Listing["marketingType"];
  visibility: ListingVisibility;
}) {
  if (input.agencyId) {
    const agencies = await getAccessibleListingAgencies(input.userId);
    await ensureAgentBelongsToAgency({
      agencies,
      agencyId: input.agencyId,
      agentUserId: input.agentUserId,
    });
  }

  const propertyTarget = await resolvePropertyTarget(input.propertyRouteId);

  if (!propertyTarget?.property_asset_id) {
    throw new Error("Could not resolve property for listing creation");
  }

  await ensureCurrentUserOwnsProperty(input.userId, propertyTarget.property_asset_id);
  await ensureNoExistingOpenListing(propertyTarget.property_asset_id);

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
        visibility,
        marketing_type,
        asking_price_rwf,
        currency,
        description,
        seed_source,
        published_at
      )
      VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, NULL, 'RWF', NULL, 'manual_workflow_v1', NULL)
    `,
    [
      id,
      propertyTarget.parcel_id,
      propertyTarget.property_asset_id,
      input.agencyId,
      input.agentUserId,
      input.visibility,
      input.marketingType,
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
  visibility: ListingVisibility;
  askingPrice?: number;
  description?: string;
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  if (listing.agency_id) {
    const agencies = await getAccessibleListingAgencies(input.userId);
    await ensureAgentBelongsToAgency({
      agencies,
      agencyId: listing.agency_id,
      agentUserId: input.agentUserId,
    });
  }

  const newPrice = input.askingPrice != null ? Math.round(input.askingPrice) : null;
  const currentPrice = toNumber(listing.asking_price_rwf) ?? null;
  const priceChanged = newPrice !== null && newPrice !== currentPrice;

  const client = await getPgPool().connect();
  let result: { rows: Array<{ property_route_id: string; marketing_type: Listing["marketingType"] }> };

  try {
    await client.query("BEGIN");

    result = await client.query(
      `
        UPDATE listing
        SET
          agent_user_id = $2,
          marketing_type = $3,
          visibility = $4,
          asking_price_rwf = COALESCE($5, asking_price_rwf),
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
      [input.listingId, input.agentUserId, input.marketingType, input.visibility, newPrice, input.description || null],
    );

    if (priceChanged) {
      await client.query(
        `INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
         VALUES ('lph_' || replace(gen_random_uuid()::text, '-', ''), $1, $2, $3, $4)`,
        [input.listingId, newPrice, input.userId, listing.campaign_index],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return {
    listingId: input.listingId,
    propertyRouteId: result.rows[0]?.property_route_id,
    marketingType: result.rows[0]?.marketing_type ?? input.marketingType,
  };
}

export async function setPortalListingStatusInDb(input: {
  allowDraftLifecycle?: boolean;
  userId: string;
  listingId: string;
  status: "active" | "inactive" | "archived";
}) {
  const listing = await getEditableListingRow(input.userId, input.listingId);

  if (!listing) {
    throw new Error("Listing not found or inaccessible");
  }

  const client = await getPgPool().connect();
  let result: { rows: Array<{ property_route_id: string; marketing_type: Listing["marketingType"] }> };

  try {
    await client.query("BEGIN");

    const lockedListingResult = await client.query<{
      status: Listing["status"];
      asking_price_rwf: number | string | null;
      campaign_index: number;
      property_asset_id: string;
    }>(
      `
        SELECT
          status,
          asking_price_rwf,
          campaign_index,
          property_asset_id
        FROM listing
        WHERE id = $1
        FOR UPDATE
      `,
      [input.listingId],
    );

    const lockedListing = lockedListingResult.rows[0];

    if (!lockedListing) {
      throw new Error("Listing not found or inaccessible");
    }

    if (lockedListing.status === "draft" && !input.allowDraftLifecycle) {
      throw new Error("Draft lifecycle actions must be completed from the listing editor");
    }

    if (input.status === "active") {
      const otherActiveListingResult = await client.query<{ id: string }>(
        `
          SELECT id
          FROM listing
          WHERE property_asset_id = $1
            AND status = 'active'
            AND id <> $2
          LIMIT 1
        `,
        [lockedListing.property_asset_id, input.listingId],
      );

      if (otherActiveListingResult.rows[0]) {
        throw new Error("This property already has an active listing");
      }

      if (lockedListing.asking_price_rwf == null) {
        throw new Error("An asking price is required before publishing a listing");
      }

      if (!hasNonEmptyText(listing.description)) {
        throw new Error("A description is required before publishing a listing");
      }

      const readyImageCount = await countReadyListingImages(client, input.listingId);
      if (readyImageCount === 0) {
        throw new Error("At least one photo is required before publishing a listing");
      }
    }

    const opensNewCampaign = lockedListing.status === "inactive" && input.status === "active";
    const nextCampaignIndex = opensNewCampaign ? lockedListing.campaign_index + 1 : lockedListing.campaign_index;

    result = await client.query(
      `
        UPDATE listing
        SET
          status = $2,
          campaign_index = $3,
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
      [input.listingId, input.status, nextCampaignIndex],
    );

    if (opensNewCampaign && lockedListing.asking_price_rwf != null) {
      await client.query(
        `
          INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
          VALUES ('lph_' || replace(gen_random_uuid()::text, '-', ''), $1, $2, $3, $4)
        `,
        [input.listingId, Math.round(Number(lockedListing.asking_price_rwf)), input.userId, nextCampaignIndex],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    listingId: input.listingId,
    propertyRouteId: result.rows[0]?.property_route_id,
    marketingType: result.rows[0]?.marketing_type ?? listing.marketing_type,
  };
}
