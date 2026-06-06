import "server-only";

import type { BrowseMapCard } from "@/lib/server/browse-map";

import { getPgPool } from "./postgres";

interface ListingCardRow {
  listing_id: string;
  parcel_public_id: string | null;
  asset_display_name: string | null;
  asset_public_id: string | null;
  asset_unit_label: string | null;
  route_id: string;
  marketing_type: "sale" | "rent";
  asking_price_rwf: number | string | null;
  district: string | null;
  sector: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  hero_image_url: string | null;
}

interface AgencyRow {
  id: string;
  slug: string;
  business_name: string;
  whatsapp_phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  google_maps_url: string | null;
}

interface AgentRow {
  user_id: string;
  full_name: string;
  phone: string | null;
  agency_id: string | null;
  agency_slug: string | null;
  agency_name: string | null;
}

export interface PublicAgencyPageData {
  agency: {
    id: string;
    slug: string;
    businessName: string;
    whatsappPhone?: string;
    websiteUrl?: string;
    instagramUrl?: string;
    googleMapsUrl?: string;
  };
  listings: BrowseMapCard[];
}

export interface PublicAgentPageData {
  agent: {
    userId: string;
    fullName: string;
    phone?: string;
  };
  agency: {
    id: string;
    slug: string;
    businessName: string;
  };
  listings: BrowseMapCard[];
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildTitle(row: ListingCardRow): string {
  const base = (row.asset_display_name?.trim() || row.asset_public_id?.trim() || row.parcel_public_id || "").trim();
  const unit = row.asset_unit_label?.trim();
  return unit && base ? `${base} · ${unit}` : base || row.route_id;
}

function rowToCard(row: ListingCardRow): BrowseMapCard {
  return {
    listingId: row.listing_id,
    parcelPublicId: row.parcel_public_id ?? undefined,
    assetPublicId: row.asset_public_id ?? undefined,
    routeId: row.route_id,
    title: buildTitle(row),
    priceLabelRwf: toNumber(row.asking_price_rwf) ?? 0,
    marketingType: row.marketing_type,
    heroImageUrl: row.hero_image_url ?? undefined,
    district: row.district ?? undefined,
    sector: row.sector ?? undefined,
    propertyType: row.property_type ?? undefined,
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    areaSqm: toNumber(row.interior_area_sqm),
  };
}

const LISTING_CARD_SELECT = `
  SELECT
    l.id                                                                    AS listing_id,
    p.public_id                                                             AS parcel_public_id,
    COALESCE(parcel_label(p.upi, p.cell, p.sector), pa.display_name)       AS asset_display_name,
    pa.public_id                                                            AS asset_public_id,
    pa.unit_label                                                           AS asset_unit_label,
    pa.public_id                                                            AS route_id,
    l.marketing_type,
    l.asking_price_rwf,
    pa.admin_district                                                       AS district,
    pa.admin_sector                                                         AS sector,
    COALESCE(
      NULLIF(BTRIM(property_profile.property_type), ''),
      CASE pa.asset_type
        WHEN 'house'               THEN 'House'
        WHEN 'land'                THEN 'Land'
        WHEN 'apartment_building'  THEN 'Apartment building'
        WHEN 'commercial_building' THEN 'Commercial building'
        WHEN 'apartment_unit'      THEN 'Apartment Unit'
        WHEN 'commercial_unit'     THEN 'Commercial Unit'
        ELSE NULL
      END
    )                                                                       AS property_type,
    property_profile.bedrooms,
    property_profile.bathrooms,
    property_profile.interior_area_sqm,
    (
      SELECT li.image_url
      FROM listing_image li
      WHERE li.listing_id = l.id
        AND COALESCE(to_jsonb(li)->>'status', 'ready') = 'ready'
      ORDER BY li.sort_order ASC
      LIMIT 1
    )                                                                       AS hero_image_url
  FROM listing l
  JOIN property_asset pa
    ON pa.id = l.property_asset_id
  LEFT JOIN parcel_app_ready_seed_preview p
    ON p.parcel_id = l.parcel_id
  LEFT JOIN property_asset_profile property_profile
    ON property_profile.property_asset_id = pa.id
`;

export async function getPublicAgencyPageData(agencySlug: string): Promise<PublicAgencyPageData | undefined> {
  const agencyResult = await getPgPool().query<AgencyRow>(
    `
      SELECT id, slug, business_name, whatsapp_phone, website_url, instagram_url, google_maps_url
      FROM agency
      WHERE slug = $1
        AND status = 'approved'
      LIMIT 1
    `,
    [agencySlug],
  );

  const agencyRow = agencyResult.rows[0];
  if (!agencyRow) return undefined;

  const listingResult = await getPgPool().query<ListingCardRow>(
    `${LISTING_CARD_SELECT}
      WHERE l.status     = 'active'
        AND l.visibility = 'public'
        AND l.agency_id  = $1
      ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
      LIMIT 200
    `,
    [agencyRow.id],
  );

  return {
    agency: {
      id: agencyRow.id,
      slug: agencyRow.slug,
      businessName: agencyRow.business_name,
      whatsappPhone: agencyRow.whatsapp_phone ?? undefined,
      websiteUrl: agencyRow.website_url ?? undefined,
      instagramUrl: agencyRow.instagram_url ?? undefined,
      googleMapsUrl: agencyRow.google_maps_url ?? undefined,
    },
    listings: listingResult.rows.map(rowToCard),
  };
}

export async function getPublicAgentPageData(agentUserId: string): Promise<PublicAgentPageData | undefined> {
  const agentResult = await getPgPool().query<AgentRow>(
    `
      SELECT
        u.id           AS user_id,
        u.full_name,
        u.phone,
        a.id           AS agency_id,
        a.slug         AS agency_slug,
        a.business_name AS agency_name
      FROM app_user u
      JOIN agency_membership am
        ON am.user_id = u.id
       AND am.status  = 'active'
      JOIN agency a
        ON a.id = am.agency_id
       AND a.status = 'approved'
      WHERE u.id = $1::UUID
      ORDER BY am.created_at ASC
      LIMIT 1
    `,
    [agentUserId],
  );

  const agentRow = agentResult.rows[0];
  if (!agentRow) return undefined;

  const listingResult = await getPgPool().query<ListingCardRow>(
    `${LISTING_CARD_SELECT}
      WHERE l.status        = 'active'
        AND l.visibility    = 'public'
        AND l.agent_user_id = $1::UUID
        AND l.agency_id     IS NOT NULL
      ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
      LIMIT 200
    `,
    [agentUserId],
  );

  return {
    agent: {
      userId: agentRow.user_id,
      fullName: agentRow.full_name,
      phone: agentRow.phone ?? undefined,
    },
    agency: {
      id: agentRow.agency_id!,
      slug: agentRow.agency_slug!,
      businessName: agentRow.agency_name!,
    },
    listings: listingResult.rows.map(rowToCard),
  };
}
