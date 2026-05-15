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
  profile_title: string | null;
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

export interface PortalValuationsWorkspaceData {
  submissions: PortalValuationSubmissionSummary[];
  properties: PortalValuationPropertyGroup[];
  totalSubmissions: number;
  approvedCount: number;
  pendingCount: number;
  deniedCount: number;
  anonymousCount: number;
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

  if (row.profile_title?.trim()) {
    return row.profile_title.trim();
  }

  if (row.display_id?.trim()) {
    return row.display_id.trim();
  }

  return row.property_public_id || row.parcel_public_id || row.parcel_id || row.property_id || "Preview property";
}

function normalizePropertyId(row: PortalValuationRow) {
  return row.property_public_id || row.parcel_public_id || row.parcel_id || row.property_id || row.id;
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
        prop.parcel_id,
        prop.parcel_public_id,
        prop.display_id,
        prop.district,
        prop.sector,
        prop.property_public_id,
        prop.property_kind,
        prop.property_title,
        prop.profile_title,
        listing.id AS listing_id,
        listing.marketing_type,
        listing.asking_price_rwf,
        listing.currency AS listing_currency
      FROM valuation_submission vs
      LEFT JOIN LATERAL (
        SELECT
          p.parcel_id,
          p.public_id AS parcel_public_id,
          p.display_id,
          p.district,
          p.sector,
          pa.public_id AS property_public_id,
          pa.asset_type AS property_kind,
          pa.title AS property_title,
          pp.title AS profile_title
        FROM parcel_app_ready_seed_preview p
        LEFT JOIN property_asset pa
          ON pa.parcel_id = p.parcel_id
         AND (
           pa.id = vs.property_asset_id
           OR pa.public_id = vs.property_id
           OR (vs.property_asset_id IS NULL AND pa.is_primary_for_parcel)
         )
        LEFT JOIN property_profile pp
          ON pp.parcel_id = p.parcel_id
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
      LEFT JOIN LATERAL (
        SELECT
          l.id,
          l.marketing_type,
          l.asking_price_rwf,
          l.currency
        FROM listing l
        WHERE l.parcel_id = prop.parcel_id
          AND l.status = 'active'
        ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
        LIMIT 1
      ) listing
        ON TRUE
      WHERE vs.submitted_by_user_id = $1
      ORDER BY vs.effective_date DESC, vs.created_at DESC, vs.id DESC
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
