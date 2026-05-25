import "server-only";

import { getPgPool } from "./postgres";

type ValuationStatus = "pending" | "approved" | "denied";
type MarketingType = "sale" | "rent";
type Currency = "RWF";
type PropertyKind = "house" | "land" | "building" | "apartment_unit" | "commercial_unit" | "mixed_use" | "other";

interface PortalValuationRow {
  id: string;
  property_id: string | null;
  submitted_by_user_id: string;
  is_anonymous: boolean;
  effective_date: string;
  estimated_value_rwf: number | string;
  currency: Currency;
  status: ValuationStatus;
  created_at: string;
  updated_at: string;
  parcel_id: string | null;
  parcel_public_id: string | null;
  display_id: string | null;
  district: string | null;
  sector: string | null;
  property_public_id: string | null;
  property_kind: PropertyKind | null;
  property_title: string | null;
  listing_id: string | null;
  marketing_type: MarketingType | null;
  asking_price_rwf: number | string | null;
  listing_currency: Currency | null;
}

export interface PortalValuationSubmissionSummary {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  listingId?: string;
  listingMarketingType?: MarketingType;
  askingPrice?: number;
  currency: Currency;
  estimatedValue: number;
  effectiveDate: string;
  createdAt: string;
  updatedAt: string;
  status: ValuationStatus;
  isAnonymous: boolean;
}

export interface PortalValuationPropertyGroup {
  propertyId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  listingId?: string;
  listingMarketingType?: MarketingType;
  askingPrice?: number;
  currency: Currency;
  latestEstimatedValue: number;
  latestEffectiveDate: string;
  submissions: PortalValuationSubmissionSummary[];
}

export interface PortalValuationPropertyOption {
  routeId: string;
  propertyTitle: string;
  propertyKind?: PropertyKind;
  district: string;
  sector?: string;
  listingMarketingType?: MarketingType;
  askingPrice?: number;
  currency: Currency;
  latestApprovedValue?: number;
  latestApprovedEffectiveDate?: string;
}

export interface PortalValuationsWorkspaceData {
  submissions: PortalValuationSubmissionSummary[];
  properties: PortalValuationPropertyGroup[];
  totalSubmissions: number;
  approvedCount: number;
  pendingCount: number;
  deniedCount: number;
  anonymousCount: number;
}

interface PortalValuationPropertyOptionRow {
  route_id: string;
  property_title: string | null;
  property_kind: PropertyKind | null;
  district: string | null;
  sector: string | null;
  marketing_type: MarketingType | null;
  asking_price_rwf: number | string | null;
  currency: Currency | null;
  latest_approved_value: number | string | null;
  latest_approved_effective_date: string | null;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizePropertyTitle(row: PortalValuationRow) {
  if (row.property_title?.trim()) {
    return row.property_title.trim();
  }

  if (row.display_id?.trim()) {
    return row.display_id.trim();
  }

  return row.property_public_id || row.parcel_public_id || row.property_id || "Preview property";
}

function normalizePropertyId(row: PortalValuationRow) {
  return row.property_public_id || row.parcel_public_id || row.property_id || row.id;
}

function buildSubmission(row: PortalValuationRow): PortalValuationSubmissionSummary {
  return {
    id: row.id,
    propertyId: normalizePropertyId(row),
    propertyTitle: normalizePropertyTitle(row),
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    listingId: row.listing_id || undefined,
    listingMarketingType: row.marketing_type || undefined,
    askingPrice: toNumber(row.asking_price_rwf),
    currency: row.currency,
    estimatedValue: toNumber(row.estimated_value_rwf) ?? 0,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    isAnonymous: row.is_anonymous,
  };
}

export async function getPortalValuationsWorkspaceData(userId: string): Promise<PortalValuationsWorkspaceData> {
  const result = await getPgPool().query<PortalValuationRow>(
    `
      WITH user_submissions AS (
        SELECT
          vs.id,
          vs.property_id,
          vs.property_asset_id,
          vs.submitted_by_user_id,
          vs.is_anonymous,
          vs.effective_date,
          vs.estimated_value_rwf,
          vs.currency,
          vs.status,
          vs.created_at,
          vs.updated_at
        FROM valuation_submission vs
        WHERE vs.submitted_by_user_id = $1
      )
      SELECT *
      FROM (
        SELECT
          vs.id,
          vs.property_id,
          vs.submitted_by_user_id,
          vs.is_anonymous,
          vs.effective_date::TEXT,
          vs.estimated_value_rwf,
          vs.currency,
          vs.status,
          vs.created_at::TEXT,
          vs.updated_at::TEXT,
          p.parcel_id,
          p.public_id AS parcel_public_id,
          p.display_id,
          p.district,
          p.sector,
          pa.public_id AS property_public_id,
          pa.asset_type AS property_kind,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
            ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
          END AS property_title,
          listing.id AS listing_id,
          listing.marketing_type,
          listing.asking_price_rwf,
          listing.currency AS listing_currency
        FROM user_submissions vs
        LEFT JOIN property_asset pa
          ON pa.id = vs.property_asset_id
        LEFT JOIN parcel_app_ready_seed_preview p
          ON p.parcel_id = pa.parcel_id
        LEFT JOIN property_profile pp
          ON pp.parcel_id = p.parcel_id
        LEFT JOIN LATERAL (
          SELECT
            l.id,
            l.marketing_type,
            l.asking_price_rwf,
            l.currency
          FROM listing l
          WHERE l.parcel_id = p.parcel_id
            AND l.status = 'active'
          ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
          LIMIT 1
        ) listing
          ON TRUE
        WHERE vs.property_asset_id IS NOT NULL

        UNION ALL

        SELECT
          vs.id,
          vs.property_id,
          vs.submitted_by_user_id,
          vs.is_anonymous,
          vs.effective_date::TEXT,
          vs.estimated_value_rwf,
          vs.currency,
          vs.status,
          vs.created_at::TEXT,
          vs.updated_at::TEXT,
          COALESCE(parcel_from_asset.parcel_id, parcel_direct.parcel_id) AS parcel_id,
          COALESCE(parcel_from_asset.public_id, parcel_direct.public_id) AS parcel_public_id,
          COALESCE(parcel_from_asset.display_id, parcel_direct.display_id) AS display_id,
          COALESCE(parcel_from_asset.district, parcel_direct.district) AS district,
          COALESCE(parcel_from_asset.sector, parcel_direct.sector) AS sector,
          property_by_public_id.public_id AS property_public_id,
          property_by_public_id.asset_type AS property_kind,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(property_by_public_id.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(
                COALESCE(parcel_from_asset.display_id, parcel_direct.display_id, parcel_from_asset.public_id, parcel_direct.public_id, parcel_from_asset.parcel_id, parcel_direct.parcel_id),
                ' · ',
                property_by_public_id.unit_label
              )
            ELSE COALESCE(parcel_from_asset.display_id, parcel_direct.display_id, parcel_from_asset.public_id, parcel_direct.public_id, parcel_from_asset.parcel_id, parcel_direct.parcel_id)
          END AS property_title,
          listing.id AS listing_id,
          listing.marketing_type,
          listing.asking_price_rwf,
          listing.currency AS listing_currency
        FROM user_submissions vs
        LEFT JOIN property_asset property_by_public_id
          ON property_by_public_id.public_id = vs.property_id
        LEFT JOIN parcel_app_ready_seed_preview parcel_from_asset
          ON parcel_from_asset.parcel_id = property_by_public_id.parcel_id
        LEFT JOIN property_profile profile_from_asset
          ON profile_from_asset.parcel_id = parcel_from_asset.parcel_id
        LEFT JOIN parcel_app_ready_seed_preview parcel_direct
          ON parcel_direct.public_id = vs.property_id
         AND property_by_public_id.id IS NULL
        LEFT JOIN property_profile profile_direct
          ON profile_direct.parcel_id = parcel_direct.parcel_id
        LEFT JOIN LATERAL (
          SELECT
            l.id,
            l.marketing_type,
            l.asking_price_rwf,
            l.currency
          FROM listing l
          WHERE l.parcel_id = COALESCE(parcel_from_asset.parcel_id, parcel_direct.parcel_id)
            AND l.status = 'active'
          ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
          LIMIT 1
        ) listing
          ON TRUE
        WHERE vs.property_asset_id IS NULL
      ) resolved
      ORDER BY resolved.effective_date DESC, resolved.created_at DESC, resolved.id DESC
    `,
    [userId],
  );

  const submissions = result.rows.map(buildSubmission);
  const propertiesById = new Map<string, PortalValuationPropertyGroup>();

  for (const submission of submissions) {
    const existing = propertiesById.get(submission.propertyId);

    if (existing) {
      existing.submissions.push(submission);
      continue;
    }

    propertiesById.set(submission.propertyId, {
      propertyId: submission.propertyId,
      propertyTitle: submission.propertyTitle,
      propertyKind: submission.propertyKind,
      district: submission.district,
      sector: submission.sector,
      listingId: submission.listingId,
      listingMarketingType: submission.listingMarketingType,
      askingPrice: submission.askingPrice,
      currency: submission.currency,
      latestEstimatedValue: submission.estimatedValue,
      latestEffectiveDate: submission.effectiveDate,
      submissions: [submission],
    });
  }

  return {
    submissions,
    properties: Array.from(propertiesById.values()),
    totalSubmissions: submissions.length,
    approvedCount: submissions.filter((submission) => submission.status === "approved").length,
    pendingCount: submissions.filter((submission) => submission.status === "pending").length,
    deniedCount: submissions.filter((submission) => submission.status === "denied").length,
    anonymousCount: submissions.filter((submission) => submission.isAnonymous).length,
  };
}

export async function listPortalValuationPropertyOptions(): Promise<PortalValuationPropertyOption[]> {
  const result = await getPgPool().query<PortalValuationPropertyOptionRow>(
    `
      SELECT
        COALESCE(active_listing.property_asset_public_id, primary_asset.public_id, p.public_id) AS route_id,
        COALESCE(active_listing.property_title, primary_asset.property_title, p.display_id, p.public_id, p.parcel_id) AS property_title,
        COALESCE(active_listing.property_kind, primary_asset.property_kind) AS property_kind,
        p.district,
        p.sector,
        active_listing.marketing_type,
        active_listing.asking_price_rwf,
        COALESCE(active_listing.currency, 'RWF') AS currency,
        latest_approved.estimated_value_rwf AS latest_approved_value,
        latest_approved.effective_date::TEXT AS latest_approved_effective_date
      FROM parcel_app_ready_seed_preview p
      LEFT JOIN LATERAL (
        SELECT
          pa.id,
          pa.public_id,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
            ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
          END AS property_title,
          pa.asset_type AS property_kind
        FROM property_asset pa
        WHERE pa.parcel_id = p.parcel_id
          AND pa.is_primary_for_parcel
        ORDER BY pa.created_at ASC, pa.id ASC
        LIMIT 1
      ) primary_asset
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          pa.public_id AS property_asset_public_id,
          CASE
            WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
              THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
            ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
          END AS property_title,
          pa.asset_type AS property_kind,
          l.marketing_type,
          l.asking_price_rwf,
          l.currency
        FROM listing l
        JOIN property_asset pa
          ON pa.id = l.property_asset_id
        WHERE l.parcel_id = p.parcel_id
          AND l.status = 'active'
        ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
        LIMIT 1
      ) active_listing
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          vs.estimated_value_rwf,
          vs.effective_date
        FROM valuation_submission vs
        WHERE vs.status = 'approved'
          AND (
            (active_listing.property_asset_public_id IS NOT NULL AND vs.property_id = active_listing.property_asset_public_id)
            OR (primary_asset.public_id IS NOT NULL AND vs.property_id = primary_asset.public_id)
            OR vs.property_id = p.public_id
          )
        ORDER BY vs.effective_date DESC, vs.created_at DESC, vs.id DESC
        LIMIT 1
      ) latest_approved
        ON TRUE
      WHERE COALESCE(active_listing.property_asset_public_id, primary_asset.public_id, p.public_id) IS NOT NULL
      ORDER BY
        CASE WHEN active_listing.property_asset_public_id IS NOT NULL THEN 0 ELSE 1 END,
        property_title ASC,
        route_id ASC
    `,
  );

  return result.rows.map((row) => ({
    routeId: row.route_id,
    propertyTitle: row.property_title || row.route_id,
    propertyKind: row.property_kind || undefined,
    district: row.district || "Unknown district",
    sector: row.sector || undefined,
    listingMarketingType: row.marketing_type || undefined,
    askingPrice: toNumber(row.asking_price_rwf),
    currency: row.currency || "RWF",
    latestApprovedValue: toNumber(row.latest_approved_value),
    latestApprovedEffectiveDate: row.latest_approved_effective_date || undefined,
  }));
}
