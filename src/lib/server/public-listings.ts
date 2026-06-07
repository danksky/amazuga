import "server-only";

import type {
  Agency,
  Listing,
  Property,
  PropertyKind,
  ValuationSubmission,
} from "@/types/domain";

import { buildPublicPropertyPath } from "@/lib/property-slug";

import { getPgPool } from "./postgres";

type MarketingType = "sale" | "rent";

interface ListingParcelRow {
  parcel_id: string | null;
  public_id: string | null;
  upi: string | null;
  display_id: string | null;
  location_source: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  representative_size: number | string | null;
  anchor_lon: number | string | null;
  anchor_lat: number | string | null;
  anchor_source: string | null;
  centroid_lon: number | string | null;
  centroid_lat: number | string | null;
  bbox_min_lon: number | string | null;
  bbox_min_lat: number | string | null;
  bbox_max_lon: number | string | null;
  bbox_max_lat: number | string | null;
  zoning: string | null;
  zone_code: string | null;
  gen_lu: string | null;
  property_internal_id: string | null;
  property_public_id: string | null;
  parent_property_internal_id: string | null;
  property_kind: PropertyKind | null;
  property_code: string | null;
  property_unit_label: string | null;
  listing_id: string | null;
  agency_id: string | null;
  agent_user_id: string | null;
  agent_full_name: string | null;
  agent_phone: string | null;
  listing_status: Listing["status"] | null;
  listing_visibility: Listing["visibility"] | null;
  marketing_type: Listing["marketingType"] | null;
  asking_price_rwf: number | string | null;
  currency: Listing["currency"] | null;
  listing_created_at: string | null;
  listing_updated_at: string | null;
  location_hidden: boolean | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  year_built: number | string | null;
  og_image_url: string | null;
}

interface ListingImageRow {
  image_url: string;
}

interface AgencyRow {
  id: string;
  slug: string;
  business_name: string;
  tin: string;
  whatsapp_phone: string | null;
  website_url: string | null;
  google_maps_url: string | null;
  instagram_url: string | null;
  logo_url: string | null;
  status: Agency["status"];
  pending_manager_user_id: string | null;
  manager_user_id: string | null;
  member_user_ids: string[];
}

interface ValuationRow {
  id: string;
  property_id: string | null;
  submitted_by_user_id: string;
  is_anonymous: boolean;
  effective_date: string;
  estimated_value_rwf: number | string;
  currency: ValuationSubmission["currency"];
  status: ValuationSubmission["status"];
  created_at: string;
}

interface PropertyWhatsappRow {
  listing_id: string | null;
  agency_id: string | null;
  marketing_type: Listing["marketingType"] | null;
  agent_phone: string | null;
  public_id: string;
  display_id: string | null;
  property_public_id: string | null;
  property_kind: PropertyKind | null;
  property_type: string | null;
  property_unit_label: string | null;
}

export interface PublicListingCardData {
  property: Property;
  listing: Listing;
}

export interface PublicPropertyPageData {
  property: Property;
  listing?: Listing;
  agency?: Agency;
  contactName?: string;
  valuations: ValuationSubmission[];
}

function toNullableNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function propertyKindToPropertyType(propertyKind: PropertyKind | null | undefined) {
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
      return "Apartment Unit";
    case "commercial_unit":
      return "Commercial Unit";
    default:
      return undefined;
  }
}

function buildPlaceholderGeometry(row: ListingParcelRow): Property["geometry"] {
  const minLng = toNullableNumber(row.bbox_min_lon);
  const minLat = toNullableNumber(row.bbox_min_lat);
  const maxLng = toNullableNumber(row.bbox_max_lon);
  const maxLat = toNullableNumber(row.bbox_max_lat);

  if (
    minLng !== undefined &&
    minLat !== undefined &&
    maxLng !== undefined &&
    maxLat !== undefined
  ) {
    return {
      type: "polygon",
      coordinates: [[
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ]],
    };
  }

  const lng = toNullableNumber(row.anchor_lon) ?? 0;
  const lat = toNullableNumber(row.anchor_lat) ?? 0;
  const delta = 0.00005;
  return {
    type: "polygon",
    coordinates: [[
      [lng - delta, lat - delta],
      [lng + delta, lat - delta],
      [lng + delta, lat + delta],
      [lng - delta, lat + delta],
      [lng - delta, lat - delta],
    ]],
  };
}

function normalizePropertyTitle(row: ListingParcelRow) {
  if (row.display_id?.trim()) {
    const baseLabel = row.display_id.trim();
    const unitLabel = row.property_unit_label?.trim();
    return unitLabel ? `${baseLabel} · ${unitLabel}` : baseLabel;
  }

  if (row.property_public_id?.trim()) {
    const unitLabel = row.property_unit_label?.trim();
    return unitLabel ? `${row.property_public_id.trim()} · ${unitLabel}` : row.property_public_id.trim();
  }

  return `Parcel ${row.property_public_id || row.public_id}`;
}

function buildPropertyFromRow(row: ListingParcelRow): Property {
  const propertyId = row.property_public_id || row.public_id || "";
  const zoningLabel = row.zoning || row.gen_lu || row.zone_code;
  const listingState = row.listing_id ? "listed" : "not_listed";
  const propertyType = row.property_type || propertyKindToPropertyType(row.property_kind) || "Parcel";
  const title = normalizePropertyTitle(row);
  const minLng = toNullableNumber(row.bbox_min_lon);
  const minLat = toNullableNumber(row.bbox_min_lat);
  const maxLng = toNullableNumber(row.bbox_max_lon);
  const maxLat = toNullableNumber(row.bbox_max_lat);

  const locationLng = toNullableNumber(row.anchor_lon) ?? 0;
  const locationLat = toNullableNumber(row.anchor_lat) ?? 0;

  return {
    id: propertyId,
    internalId: row.property_internal_id || undefined,
    parcelId: row.parcel_id || undefined,
    parcelPublicId: row.public_id || undefined,
    parcelDisplayId: row.display_id || undefined,
    code: row.property_code || undefined,
    parentInternalId: row.parent_property_internal_id || undefined,
    unitLabel: row.property_unit_label || undefined,
    upi: row.upi || undefined,
    locationSource: row.location_source as Property["locationSource"] | undefined,
    title,
    location: {
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
      cell: row.cell || undefined,
      village: row.village || undefined,
      lat: locationLat,
      lng: locationLng,
      bbox:
        minLng !== undefined &&
        minLat !== undefined &&
        maxLng !== undefined &&
        maxLat !== undefined
          ? {
              minLng,
              minLat,
              maxLng,
              maxLat,
            }
          : undefined,
    },
    geometry: buildPlaceholderGeometry(row),
    facts: {
      bedrooms: toNullableNumber(row.bedrooms),
      bathrooms: toNullableNumber(row.bathrooms),
      areaSqm: toNullableNumber(row.interior_area_sqm),
      landAreaSqm: toNullableNumber(row.representative_size),
      propertyType,
      propertyKind: row.property_kind || undefined,
      yearBuilt: toNullableNumber(row.year_built),
      zoningLabel: zoningLabel || undefined,
    },
    listingState,
    activeListingId: row.listing_id || undefined,
    valuationHistoryIds: [],
  };
}

function buildListingFromRow(row: ListingParcelRow, imageUrls: string[] = []): Listing | undefined {
  if (
    !row.listing_id ||
    !row.agent_user_id ||
    !row.listing_status ||
    !row.marketing_type ||
    row.asking_price_rwf === null ||
    !row.currency ||
    !row.listing_created_at ||
    !row.listing_updated_at
  ) {
    return undefined;
  }

  return {
    id: row.listing_id ?? "",
    propertyId: row.property_public_id || row.public_id || "",
    propertyInternalId: row.property_internal_id || undefined,
    agencyId: row.agency_id ?? undefined,
    agentUserId: row.agent_user_id,
    status: row.listing_status,
    visibility: row.listing_visibility ?? "public",
    marketingType: row.marketing_type,
    askingPrice: toNullableNumber(row.asking_price_rwf) ?? 0,
    currency: row.currency,
    locationHidden: row.location_hidden ?? false,
    imageUrls,
    ogImageUrl: row.og_image_url ?? undefined,
    createdAt: row.listing_created_at,
    updatedAt: row.listing_updated_at,
  };
}

function buildAgencyFromRow(row: AgencyRow): Agency {
  return {
    id: row.id,
    slug: row.slug,
    businessName: row.business_name,
    tin: row.tin,
    whatsappPhone: row.whatsapp_phone || undefined,
    websiteUrl: row.website_url || undefined,
    googleMapsUrl: row.google_maps_url || undefined,
    instagramUrl: row.instagram_url || undefined,
    logoUrl: row.logo_url || undefined,
    status: row.status,
    pendingManagerUserId: row.pending_manager_user_id || undefined,
    managerUserId: row.manager_user_id || undefined,
    memberUserIds: row.member_user_ids,
  };
}

function buildValuationFromRow(row: ValuationRow): ValuationSubmission {
  return {
    id: row.id,
    propertyId: row.property_id || "",
    submittedByUserId: row.submitted_by_user_id,
    isAnonymous: row.is_anonymous,
    effectiveDate: row.effective_date,
    estimatedValue: toNullableNumber(row.estimated_value_rwf) ?? 0,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  };
}

function buildWhatsappUrl(phone?: string | null, message?: string) {
  const normalizedPhone = phone?.replace(/\D/g, "");

  if (!normalizedPhone) {
    return undefined;
  }

  const baseUrl = new URL(`https://wa.me/${normalizedPhone}`);
  if (message?.trim()) {
    baseUrl.searchParams.set("text", message.trim());
  }

  return baseUrl.toString();
}

async function getListingImages(listingId: string) {
  const result = await getPgPool().query<ListingImageRow>(
    `
      SELECT image_url
      FROM listing_image li
      WHERE li.listing_id = $1
        AND COALESCE(to_jsonb(li)->>'status', 'ready') = 'ready'
      ORDER BY sort_order ASC
    `,
    [listingId],
  );

  return result.rows.map((row) => row.image_url);
}

async function getAgencyByIdFromDb(agencyId: string) {
  const result = await getPgPool().query<AgencyRow>(
    `
      SELECT
        a.id,
        a.slug,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.instagram_url,
        a.logo_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id,
        COALESCE(
          ARRAY_AGG(am.user_id::TEXT ORDER BY am.user_id::TEXT) FILTER (WHERE am.status = 'active'),
          ARRAY[]::TEXT[]
        ) AS member_user_ids
      FROM agency a
      LEFT JOIN agency_membership am
        ON am.agency_id = a.id
      WHERE a.id = $1
      GROUP BY
        a.id,
        a.slug,
        a.business_name,
        a.tin,
        a.whatsapp_phone,
        a.website_url,
        a.google_maps_url,
        a.instagram_url,
        a.logo_url,
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id
    `,
    [agencyId],
  );

  const row = result.rows[0];
  return row ? buildAgencyFromRow(row) : undefined;
}

async function getApprovedValuationsForProperty(input: {
  propertyInternalId?: string;
  propertyId: string;
}) {
  const result = await getPgPool().query<ValuationRow>(
    `
      SELECT
        id,
        property_id,
        submitted_by_user_id,
        is_anonymous,
        effective_date::TEXT,
        estimated_value_rwf,
        currency,
        status,
        created_at::TEXT
      FROM valuation_submission
      WHERE status = 'approved'
        AND (
          ($1::TEXT IS NOT NULL AND property_asset_id = $1)
          OR property_id = $2
        )
      ORDER BY effective_date DESC, created_at DESC, id DESC
    `,
    [input.propertyInternalId || null, input.propertyId],
  );

  return result.rows.map(buildValuationFromRow);
}

export async function getBrowseListingCards(marketingType: MarketingType): Promise<PublicListingCardData[]> {
  const result = await getPgPool().query<ListingParcelRow>(
    `
      SELECT
        p.parcel_id,
        p.public_id,
        p.upi,
        parcel_label(p.upi, p.cell, p.sector) AS display_id,
        p.district,
        p.sector,
        p.cell,
        p.village,
        p.representative_size,
        parcel_anchor.anchor_lon,
        parcel_anchor.anchor_lat,
        parcel_anchor.anchor_source,
        p.centroid_lon,
        p.centroid_lat,
        p.bbox_min_lon,
        p.bbox_min_lat,
        p.bbox_max_lon,
        p.bbox_max_lat,
        p.zoning,
        p.zone_code,
        p.gen_lu,
        pa.id AS property_internal_id,
        pa.public_id AS property_public_id,
        pa.parent_asset_id AS parent_property_internal_id,
        pa.asset_type AS property_kind,
        pa.display_code AS property_code,
        to_jsonb(pa)->>'unit_label' AS property_unit_label,
        l.id AS listing_id,
        l.agency_id,
        l.agent_user_id,
        agent.full_name AS agent_full_name,
        agent.phone AS agent_phone,
        l.status AS listing_status,
        l.visibility AS listing_visibility,
        l.marketing_type,
        l.asking_price_rwf,
        l.currency,
        l.created_at AS listing_created_at,
        l.updated_at AS listing_updated_at,
        l.location_hidden,
        COALESCE(
          NULLIF(BTRIM(property_profile.property_type), ''),
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'land' THEN 'Land'
            WHEN 'apartment_building' THEN 'Apartment building'
            WHEN 'commercial_building' THEN 'Commercial building'
            WHEN 'apartment_unit' THEN 'Apartment Unit'
            WHEN 'commercial_unit' THEN 'Commercial Unit'
            ELSE NULL
          END
        ) AS property_type,
        property_profile.bedrooms,
        property_profile.bathrooms,
        property_profile.interior_area_sqm,
        property_profile.year_built,
        l.og_image_url
      FROM listing l
      JOIN app_user agent
        ON agent.id = l.agent_user_id
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      JOIN parcel_anchor_point_preview parcel_anchor
        ON parcel_anchor.parcel_id = p.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_asset_profile property_profile
        ON property_profile.property_asset_id = pa.id
      WHERE l.status = 'active'
        AND l.visibility = 'public'
        AND l.marketing_type = $1
      ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
    `,
    [marketingType],
  );

  const browseEntries = await Promise.all(
    result.rows.map(async (row) => {
      const property = buildPropertyFromRow(row);
      const imageUrls = row.listing_id ? await getListingImages(row.listing_id) : [];
      const listing = buildListingFromRow(row, imageUrls);

      if (!listing) {
        return undefined;
      }

      return { property, listing };
    }),
  );

  return browseEntries.filter((entry): entry is PublicListingCardData => Boolean(entry));
}

export async function getPublicPropertyPageData(propertyId: string, viewerUserId?: string): Promise<PublicPropertyPageData | undefined> {
  const result = await getPgPool().query<ListingParcelRow>(
    `
      WITH target_parcel AS (
        SELECT p.parcel_id
        FROM parcel_app_ready_seed_preview p
        WHERE p.public_id = $1
        UNION
        SELECT pa.parcel_id
        FROM property_asset pa
        WHERE pa.public_id = $1
        UNION
        SELECT pap.parcel_id
        FROM parcel_anchor_point_preview pap
        WHERE pap.public_id = $1
        LIMIT 1
      )
      SELECT
        parcel_anchor.parcel_id,
        parcel_anchor.public_id,
        parcel_anchor.upi,
        parcel_label(COALESCE(p.upi, parcel_anchor.upi), p.cell, p.sector) AS display_id,
        p.district,
        p.sector,
        p.cell,
        p.village,
        p.representative_size,
        parcel_anchor.anchor_lon,
        parcel_anchor.anchor_lat,
        parcel_anchor.anchor_source,
        COALESCE(p.centroid_lon, parcel_anchor.centroid_lon) AS centroid_lon,
        COALESCE(p.centroid_lat, parcel_anchor.centroid_lat) AS centroid_lat,
        p.bbox_min_lon,
        p.bbox_min_lat,
        p.bbox_max_lon,
        p.bbox_max_lat,
        p.zoning,
        p.zone_code,
        p.gen_lu,
        pa.id AS property_internal_id,
        pa.public_id AS property_public_id,
        pa.parent_asset_id AS parent_property_internal_id,
        pa.asset_type AS property_kind,
        pa.display_code AS property_code,
        to_jsonb(pa)->>'unit_label' AS property_unit_label,
        l.id AS listing_id,
        l.agency_id,
        l.agent_user_id,
        agent.full_name AS agent_full_name,
        agent.phone AS agent_phone,
        l.status AS listing_status,
        l.visibility AS listing_visibility,
        l.marketing_type,
        l.asking_price_rwf,
        l.currency,
        l.created_at AS listing_created_at,
        l.updated_at AS listing_updated_at,
        l.location_hidden,
        COALESCE(
          NULLIF(BTRIM(property_profile.property_type), ''),
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'land' THEN 'Land'
            WHEN 'apartment_building' THEN 'Apartment building'
            WHEN 'commercial_building' THEN 'Commercial building'
            WHEN 'apartment_unit' THEN 'Apartment Unit'
            WHEN 'commercial_unit' THEN 'Commercial Unit'
            ELSE NULL
          END
        ) AS property_type,
        property_profile.bedrooms,
        property_profile.bathrooms,
        property_profile.interior_area_sqm,
        property_profile.year_built,
        l.og_image_url
      FROM target_parcel tp
      JOIN parcel_anchor_point_preview parcel_anchor
        ON parcel_anchor.parcel_id = tp.parcel_id
      LEFT JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = tp.parcel_id
      LEFT JOIN LATERAL (
        SELECT
          pa_inner.id,
          pa_inner.public_id,
          pa_inner.parent_asset_id,
          pa_inner.asset_type,
          pa_inner.display_code,
          pa_inner.unit_label
        FROM property_asset pa_inner
        WHERE pa_inner.parcel_id = parcel_anchor.parcel_id
        ORDER BY
          CASE
            WHEN pa_inner.public_id = $1 THEN 0
            WHEN parcel_anchor.public_id = $1 AND pa_inner.is_primary_for_parcel THEN 1
            WHEN pa_inner.is_primary_for_parcel THEN 2
            ELSE 3
          END,
          pa_inner.created_at ASC,
          pa_inner.id ASC
        LIMIT 1
      ) pa
        ON TRUE
      LEFT JOIN listing l
        ON l.property_asset_id = pa.id
       AND l.status = 'active'
       AND (
         l.visibility = 'public'
         OR l.visibility = 'unlisted'
         OR (
           l.visibility = 'private'
           AND $2::TEXT IS NOT NULL
           AND (
             l.agent_user_id::TEXT = $2::TEXT
             OR EXISTS (
               SELECT 1 FROM listing_access_grant lag
               WHERE lag.listing_id = l.id
                 AND lag.granted_to_user_id::TEXT = $2::TEXT
             )
           )
         )
       )
      LEFT JOIN app_user agent
        ON agent.id = l.agent_user_id
      LEFT JOIN property_asset_profile property_profile
        ON property_profile.property_asset_id = pa.id
      LIMIT 1
    `,
    [propertyId, viewerUserId ?? null],
  );

  let row = result.rows[0];

  // Parcel-based resolution returned nothing — try direct listing path.
  if (!row) {
    const directResult = await getPgPool().query<ListingParcelRow>(
      `
        SELECT
          NULL::TEXT                  AS parcel_id,
          pa.public_id                AS public_id,
          NULL::TEXT                  AS upi,
          pa.display_name             AS display_id,
          pa.location_source,
          pa.admin_district           AS district,
          pa.admin_sector             AS sector,
          pa.admin_cell               AS cell,
          pa.admin_village            AS village,
          NULL::DOUBLE PRECISION      AS representative_size,
          pa.anchor_lon,
          pa.anchor_lat,
          NULL::TEXT                  AS anchor_source,
          NULL::DOUBLE PRECISION      AS centroid_lon,
          NULL::DOUBLE PRECISION      AS centroid_lat,
          NULL::DOUBLE PRECISION      AS bbox_min_lon,
          NULL::DOUBLE PRECISION      AS bbox_min_lat,
          NULL::DOUBLE PRECISION      AS bbox_max_lon,
          NULL::DOUBLE PRECISION      AS bbox_max_lat,
          NULL::TEXT                  AS zoning,
          NULL::TEXT                  AS zone_code,
          NULL::TEXT                  AS gen_lu,
          pa.id                       AS property_internal_id,
          pa.public_id                AS property_public_id,
          pa.parent_asset_id          AS parent_property_internal_id,
          pa.asset_type               AS property_kind,
          pa.display_code             AS property_code,
          pa.unit_label               AS property_unit_label,
          l.id                        AS listing_id,
          l.agency_id,
          l.agent_user_id,
          agent.full_name             AS agent_full_name,
          agent.phone                 AS agent_phone,
          l.status                    AS listing_status,
          l.visibility                AS listing_visibility,
          l.marketing_type,
          l.asking_price_rwf,
          l.currency,
          l.created_at                AS listing_created_at,
          l.updated_at                AS listing_updated_at,
          l.location_hidden,
          COALESCE(
            NULLIF(BTRIM(pap.property_type), ''),
            CASE pa.asset_type
              WHEN 'house'               THEN 'House'
              WHEN 'land'                THEN 'Land'
              WHEN 'apartment_building'  THEN 'Apartment building'
              WHEN 'commercial_building' THEN 'Commercial building'
              WHEN 'apartment_unit'      THEN 'Apartment Unit'
              WHEN 'commercial_unit'     THEN 'Commercial Unit'
              ELSE NULL
            END
          )                           AS property_type,
          pap.bedrooms,
          pap.bathrooms,
          pap.interior_area_sqm,
          pap.year_built
        FROM property_asset pa
        LEFT JOIN listing l
          ON l.property_asset_id = pa.id
         AND l.status = 'active'
         AND (
           l.visibility = 'public'
           OR l.visibility = 'unlisted'
           OR (
             l.visibility = 'private'
             AND $2::TEXT IS NOT NULL
             AND (
               l.agent_user_id::TEXT = $2::TEXT
               OR EXISTS (
                 SELECT 1 FROM listing_access_grant lag
                 WHERE lag.listing_id = l.id
                   AND lag.granted_to_user_id::TEXT = $2::TEXT
               )
             )
           )
         )
        LEFT JOIN app_user agent
          ON agent.id = l.agent_user_id
        LEFT JOIN property_asset_profile pap
          ON pap.property_asset_id = pa.id
        WHERE pa.public_id = $1
          AND pa.parcel_id IS NULL
        LIMIT 1
      `,
      [propertyId, viewerUserId ?? null],
    );
    row = directResult.rows[0];
  }

  if (!row) {
    return undefined;
  }

  const property = buildPropertyFromRow(row);
  const imageUrls = row.listing_id ? await getListingImages(row.listing_id) : [];
  const listing = buildListingFromRow(row, imageUrls);
  const agency = row.agency_id ? await getAgencyByIdFromDb(row.agency_id) : undefined;
  const contactName = row.agent_full_name?.trim()
    || (row.listing_id ? (row.agency_id ? agency?.businessName : "For sale by owner") : undefined);
  const valuations = await getApprovedValuationsForProperty({
    propertyInternalId: property.internalId,
    propertyId: property.id,
  });

  property.valuationHistoryIds = valuations.map((valuation) => valuation.id);

  return {
    property,
    listing,
    agency,
    contactName,
    valuations,
  };
}

export async function getPublicPropertyWhatsappUrl(
  propertyId: string,
  viewerUserId?: string,
  host?: string,
): Promise<string | undefined> {
  const result = await getPgPool().query<PropertyWhatsappRow>(
    `
      WITH target_parcel AS (
        SELECT p.parcel_id
        FROM parcel_app_ready_seed_preview p
        WHERE p.public_id = $1
        UNION
        SELECT pa.parcel_id
        FROM property_asset pa
        WHERE pa.public_id = $1
        UNION
        SELECT pap.parcel_id
        FROM parcel_anchor_point_preview pap
        WHERE pap.public_id = $1
        LIMIT 1
      )
      SELECT
        l.id AS listing_id,
        l.agency_id,
        l.marketing_type,
        agent.phone AS agent_phone,
        parcel_anchor.public_id,
        parcel_label(p.upi, p.cell, p.sector) AS display_id,
        pa.public_id AS property_public_id,
        pa.asset_type AS property_kind,
        property_profile.property_type,
        to_jsonb(pa)->>'unit_label' AS property_unit_label
      FROM target_parcel tp
      JOIN parcel_anchor_point_preview parcel_anchor
        ON parcel_anchor.parcel_id = tp.parcel_id
      LEFT JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = tp.parcel_id
      LEFT JOIN LATERAL (
        SELECT pa_inner.id
             , pa_inner.public_id
             , pa_inner.asset_type
             , pa_inner.unit_label
        FROM property_asset pa_inner
        WHERE pa_inner.parcel_id = parcel_anchor.parcel_id
        ORDER BY
          CASE
            WHEN pa_inner.public_id = $1 THEN 0
            WHEN parcel_anchor.public_id = $1 AND pa_inner.is_primary_for_parcel THEN 1
            WHEN pa_inner.is_primary_for_parcel THEN 2
            ELSE 3
          END,
          pa_inner.created_at ASC,
          pa_inner.id ASC
        LIMIT 1
      ) pa
        ON TRUE
      LEFT JOIN listing l
        ON l.property_asset_id = pa.id
       AND l.status = 'active'
       AND (
         l.visibility = 'public'
         OR l.visibility = 'unlisted'
         OR (
           l.visibility = 'private'
           AND $2::TEXT IS NOT NULL
           AND (
             l.agent_user_id::TEXT = $2::TEXT
             OR EXISTS (
               SELECT 1 FROM listing_access_grant lag
               WHERE lag.listing_id = l.id
                 AND lag.granted_to_user_id::TEXT = $2::TEXT
             )
           )
         )
       )
      LEFT JOIN app_user agent
        ON agent.id = l.agent_user_id
      LEFT JOIN property_asset_profile property_profile
        ON property_profile.property_asset_id = pa.id
      LIMIT 1
    `,
    [propertyId, viewerUserId ?? null],
  );

  let row = result.rows[0];

  if (!row) {
    const directResult = await getPgPool().query<PropertyWhatsappRow>(
      `
        SELECT
          l.id AS listing_id,
          l.agency_id,
          l.marketing_type,
          agent.phone AS agent_phone,
          pa.public_id,
          pa.display_name AS display_id,
          pa.public_id AS property_public_id,
          pa.asset_type AS property_kind,
          pap.property_type,
          pa.unit_label AS property_unit_label
        FROM property_asset pa
        LEFT JOIN listing l
          ON l.property_asset_id = pa.id
         AND l.status = 'active'
         AND (
           l.visibility = 'public'
           OR l.visibility = 'unlisted'
           OR (
             l.visibility = 'private'
             AND $2::TEXT IS NOT NULL
             AND (
               l.agent_user_id::TEXT = $2::TEXT
               OR EXISTS (
                 SELECT 1 FROM listing_access_grant lag
                 WHERE lag.listing_id = l.id
                   AND lag.granted_to_user_id::TEXT = $2::TEXT
               )
             )
           )
         )
        LEFT JOIN app_user agent ON agent.id = l.agent_user_id
        LEFT JOIN property_asset_profile pap ON pap.property_asset_id = pa.id
        WHERE pa.public_id = $1
          AND pa.parcel_id IS NULL
        LIMIT 1
      `,
      [propertyId, viewerUserId ?? null],
    );
    row = directResult.rows[0];
  }

  if (!row?.listing_id) {
    return undefined;
  }

  const agency = row.agency_id ? await getAgencyByIdFromDb(row.agency_id) : undefined;
  const assetType = (row.property_type || propertyKindToPropertyType(row.property_kind) || "property").toLowerCase();
  const listingIntent = row.marketing_type === "rent" ? "for rent" : "for sale";
  const propertyRouteId = row.property_public_id || row.public_id;
  const propertyPath = buildPublicPropertyPath(propertyRouteId, {
    propertyTitle: row.display_id,
    parcelDisplayId: row.display_id,
    propertyKind: row.property_kind,
    unitLabel: row.property_unit_label,
  });
  const resolvedHost = host || "amazuga.vercel.app";
  const propertyUrl = `https://${resolvedHost}${propertyPath}`;
  const message = `I saw the ${assetType} ${listingIntent} at ${propertyUrl} and would like to know more about the property.`;

  return buildWhatsappUrl(agency?.whatsappPhone || row.agent_phone, message);
}
