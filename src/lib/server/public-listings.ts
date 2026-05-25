import "server-only";

import type {
  Agency,
  Listing,
  Property,
  PropertyKind,
  ValuationSubmission,
} from "@/types/domain";

import { getPgPool } from "./postgres";

type MarketingType = "sale" | "rent";

interface ListingParcelRow {
  parcel_id: string;
  public_id: string;
  upi: string;
  display_id: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  representative_size: number | string | null;
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
  property_title: string | null;
  property_description_override: string | null;
  listing_id: string | null;
  agency_id: string | null;
  agent_user_id: string | null;
  listing_status: Listing["status"] | null;
  marketing_type: Listing["marketingType"] | null;
  asking_price_rwf: number | string | null;
  currency: Listing["currency"] | null;
  listing_description: string | null;
  listing_created_at: string | null;
  listing_updated_at: string | null;
  profile_title: string | null;
  profile_description: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  year_built: number | string | null;
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

export interface PublicListingCardData {
  property: Property;
  listing: Listing;
}

export interface PublicPropertyPageData {
  property: Property;
  listing?: Listing;
  agency?: Agency;
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
      return "Parcel";
    case "building":
      return "Building";
    case "apartment_unit":
      return "Apartment";
    case "commercial_unit":
      return "Commercial";
    case "mixed_use":
      return "Mixed Use";
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

  const lng = toNullableNumber(row.centroid_lon) ?? 0;
  const lat = toNullableNumber(row.centroid_lat) ?? 0;
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
  const preferredTitle = row.property_title || row.profile_title;

  if (preferredTitle?.trim() && preferredTitle.trim().toLowerCase() !== "unlisted property") {
    return preferredTitle.trim();
  }

  if (row.display_id?.trim()) {
    return row.display_id.trim();
  }

  return `Parcel ${row.property_public_id || row.public_id}`;
}

function buildPropertyFromRow(row: ListingParcelRow): Property {
  const propertyId = row.property_public_id || row.public_id;
  const zoningLabel = row.zoning || row.gen_lu || row.zone_code;
  const listingState = row.listing_id ? "listed" : "not_listed";
  const propertyType = row.property_type || propertyKindToPropertyType(row.property_kind) || "Parcel";
  const title = normalizePropertyTitle(row);
  // Only use profile_description when there is no dedicated property asset — once an
  // asset exists, profile data (often mock-seeded) is stale and should be ignored.
  const description = row.property_description_override
    || (row.property_internal_id ? undefined : row.profile_description);
  const minLng = toNullableNumber(row.bbox_min_lon);
  const minLat = toNullableNumber(row.bbox_min_lat);
  const maxLng = toNullableNumber(row.bbox_max_lon);
  const maxLat = toNullableNumber(row.bbox_max_lat);

  return {
    id: propertyId,
    internalId: row.property_internal_id || undefined,
    parcelId: row.parcel_id,
    parcelPublicId: row.public_id,
    parcelDisplayId: row.display_id || undefined,
    code: row.property_code || undefined,
    parentInternalId: row.parent_property_internal_id || undefined,
    unitLabel: row.property_unit_label || undefined,
    upi: row.upi,
    title,
    description: description || undefined,
    location: {
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
      cell: row.cell || undefined,
      village: row.village || undefined,
      lat: toNullableNumber(row.centroid_lat) ?? 0,
      lng: toNullableNumber(row.centroid_lon) ?? 0,
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
    id: row.listing_id,
    propertyId: row.property_public_id || row.public_id,
    propertyInternalId: row.property_internal_id || undefined,
    agencyId: row.agency_id ?? undefined,
    agentUserId: row.agent_user_id,
    status: row.listing_status,
    marketingType: row.marketing_type,
    askingPrice: toNullableNumber(row.asking_price_rwf) ?? 0,
    currency: row.currency,
    description: row.listing_description || undefined,
    imageUrls,
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
        a.status,
        a.pending_manager_user_id,
        a.manager_user_id,
        COALESCE(
          ARRAY_AGG(am.user_id ORDER BY am.user_id) FILTER (WHERE am.status = 'active'),
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
        p.display_id,
        p.district,
        p.sector,
        p.cell,
        p.village,
        p.representative_size,
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
        pa.title AS property_title,
        pa.description AS property_description_override,
        l.id AS listing_id,
        l.agency_id,
        l.agent_user_id,
        l.status AS listing_status,
        l.marketing_type,
        l.asking_price_rwf,
        l.currency,
        l.description AS listing_description,
        l.created_at AS listing_created_at,
        l.updated_at AS listing_updated_at,
        pp.title AS profile_title,
        pp.description AS profile_description,
        COALESCE(
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'land' THEN 'Parcel'
            WHEN 'building' THEN 'Building'
            WHEN 'apartment_unit' THEN 'Apartment'
            WHEN 'commercial_unit' THEN 'Commercial'
            WHEN 'mixed_use' THEN 'Mixed Use'
            ELSE NULL
          END,
          pp.property_type
        ) AS property_type,
        pp.bedrooms,
        pp.bathrooms,
        pp.interior_area_sqm,
        pp.year_built
      FROM listing l
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_profile pp
        ON pp.parcel_id = l.parcel_id
      WHERE l.status = 'active'
        AND l.visibility = 'public'
        AND l.marketing_type = $1
      ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
    `,
    [marketingType],
  );

  return result.rows
    .map((row) => {
      const property = buildPropertyFromRow(row);
      const listing = buildListingFromRow(row);

      if (!listing) {
        return undefined;
      }

      return { property, listing };
    })
    .filter((entry): entry is PublicListingCardData => Boolean(entry));
}

export async function getPublicPropertyPageData(propertyId: string): Promise<PublicPropertyPageData | undefined> {
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
        LIMIT 1
      )
      SELECT
        p.parcel_id,
        p.public_id,
        p.upi,
        p.display_id,
        p.district,
        p.sector,
        p.cell,
        p.village,
        p.representative_size,
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
        pa.title AS property_title,
        pa.description AS property_description_override,
        l.id AS listing_id,
        l.agency_id,
        l.agent_user_id,
        l.status AS listing_status,
        l.marketing_type,
        l.asking_price_rwf,
        l.currency,
        l.description AS listing_description,
        l.created_at AS listing_created_at,
        l.updated_at AS listing_updated_at,
        pp.title AS profile_title,
        pp.description AS profile_description,
        COALESCE(
          CASE pa.asset_type
            WHEN 'house' THEN 'House'
            WHEN 'land' THEN 'Parcel'
            WHEN 'building' THEN 'Building'
            WHEN 'apartment_unit' THEN 'Apartment'
            WHEN 'commercial_unit' THEN 'Commercial'
            WHEN 'mixed_use' THEN 'Mixed Use'
            ELSE NULL
          END,
          pp.property_type
        ) AS property_type,
        pp.bedrooms,
        pp.bathrooms,
        pp.interior_area_sqm,
        pp.year_built
      FROM target_parcel tp
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = tp.parcel_id
      LEFT JOIN LATERAL (
        SELECT
          pa_inner.id,
          pa_inner.public_id,
          pa_inner.parent_asset_id,
          pa_inner.asset_type,
          pa_inner.display_code,
          pa_inner.unit_label,
          pa_inner.title,
          pa_inner.description
        FROM property_asset pa_inner
        WHERE pa_inner.parcel_id = p.parcel_id
        ORDER BY
          CASE
            WHEN pa_inner.public_id = $1 THEN 0
            WHEN p.public_id = $1 AND pa_inner.is_primary_for_parcel THEN 1
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
       AND l.visibility IN ('public', 'unlisted')
      LEFT JOIN property_profile pp
        ON pp.parcel_id = p.parcel_id
      LIMIT 1
    `,
    [propertyId],
  );

  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  const property = buildPropertyFromRow(row);
  const imageUrls = row.listing_id ? await getListingImages(row.listing_id) : [];
  const listing = buildListingFromRow(row, imageUrls);
  const agency = row.agency_id ? await getAgencyByIdFromDb(row.agency_id) : undefined;
  const valuations = await getApprovedValuationsForProperty({
    propertyInternalId: property.internalId,
    propertyId: property.id,
  });

  property.valuationHistoryIds = valuations.map((valuation) => valuation.id);

  return {
    property,
    listing,
    agency,
    valuations,
  };
}
