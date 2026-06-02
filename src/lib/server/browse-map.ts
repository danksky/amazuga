import "server-only";

import { getPgPool } from "./postgres";

export interface BrowseMapPin {
  listingId: string;
  parcelPublicId: string;
  assetPublicId?: string;
  routeId: string;
  priceLabelRwf: number;
  marketingType: "sale" | "rent";
  anchorLng: number;
  anchorLat: number;
}

export interface BrowseMapCard {
  listingId: string;
  parcelPublicId: string;
  assetPublicId?: string;
  routeId: string;
  title: string;
  priceLabelRwf: number;
  marketingType: "sale" | "rent";
  heroImageUrl?: string;
  district?: string;
  sector?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number;
}

export interface BrowseMapResult {
  pins: BrowseMapPin[];
  cards: BrowseMapCard[];
  suppressionKeys: string[];
  resultEnvelope: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
  };
}

interface BrowseMapRow {
  listing_id: string;
  parcel_public_id: string;
  parcel_display_id: string | null;
  asset_public_id: string | null;
  asset_unit_label: string | null;
  route_id: string;
  marketing_type: "sale" | "rent";
  asking_price_rwf: number | string | null;
  anchor_lon: number | string;
  anchor_lat: number | string;
  district: string | null;
  sector: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  hero_image_url: string | null;
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildTitle(row: BrowseMapRow): string {
  if (row.parcel_display_id?.trim()) {
    const base = row.parcel_display_id.trim();
    const unit = row.asset_unit_label?.trim();
    return unit ? `${base} · ${unit}` : base;
  }
  if (row.asset_public_id?.trim()) {
    const unit = row.asset_unit_label?.trim();
    return unit ? `${row.asset_public_id.trim()} · ${unit}` : row.asset_public_id.trim();
  }
  return `Parcel ${row.parcel_public_id}`;
}

interface BrowseMapFilters {
  minPriceRwf?: number;
  maxPriceRwf?: number;
  propertyTypes?: string[];
  district?: string;
  sector?: string;
  cell?: string;
  village?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  exactBedrooms?: boolean;
}

export async function getBrowseMapData(params: {
  mode: "sale" | "rent";
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  filters?: BrowseMapFilters;
}): Promise<BrowseMapResult> {
  const { mode, minLng, minLat, maxLng, maxLat, filters } = params;

  const queryParams: (string | number | boolean)[] = [mode, minLng, minLat, maxLng, maxLat];
  const extraClauses: string[] = [];

  if (filters?.minPriceRwf !== undefined && filters.minPriceRwf > 0) {
    queryParams.push(filters.minPriceRwf);
    extraClauses.push(`AND l.asking_price_rwf >= $${queryParams.length}`);
  }
  if (filters?.maxPriceRwf !== undefined) {
    queryParams.push(filters.maxPriceRwf);
    extraClauses.push(`AND l.asking_price_rwf <= $${queryParams.length}`);
  }
  if (filters?.district) {
    queryParams.push(filters.district);
    extraClauses.push(`AND p.district ILIKE $${queryParams.length}`);
  }
  if (filters?.sector) {
    queryParams.push(filters.sector);
    extraClauses.push(`AND p.sector ILIKE $${queryParams.length}`);
  }
  if (filters?.cell) {
    queryParams.push(filters.cell);
    extraClauses.push(`AND p.cell ILIKE $${queryParams.length}`);
  }
  if (filters?.village) {
    queryParams.push(filters.village);
    extraClauses.push(`AND p.village ILIKE $${queryParams.length}`);
  }
  if (filters?.propertyTypes?.length) {
    const typeConditions: string[] = [];
    if (filters.propertyTypes.includes("House")) typeConditions.push("pa.asset_type = 'house'");
    if (filters.propertyTypes.includes("Apartment")) typeConditions.push("pa.asset_type IN ('apartment_building', 'apartment_unit')");
    if (filters.propertyTypes.includes("Land parcel")) typeConditions.push("(pa.id IS NULL OR pa.asset_type = 'land')");
    if (typeConditions.length) extraClauses.push(`AND (${typeConditions.join(" OR ")})`);
  }
  if (filters?.minBedrooms !== undefined) {
    queryParams.push(filters.minBedrooms);
    extraClauses.push(
      filters.exactBedrooms
        ? `AND property_profile.bedrooms = $${queryParams.length}`
        : `AND property_profile.bedrooms >= $${queryParams.length}`,
    );
  }
  if (filters?.minBathrooms !== undefined) {
    queryParams.push(filters.minBathrooms);
    extraClauses.push(`AND property_profile.bathrooms >= $${queryParams.length}`);
  }

  const result = await getPgPool().query<BrowseMapRow>(
    `
      SELECT
        l.id                                        AS listing_id,
        p.public_id                                 AS parcel_public_id,
        p.display_id                                AS parcel_display_id,
        pa.public_id                                AS asset_public_id,
        to_jsonb(pa)->>'unit_label'                 AS asset_unit_label,
        COALESCE(pa.public_id, p.public_id)         AS route_id,
        l.marketing_type,
        l.asking_price_rwf,
        parcel_anchor.anchor_lon,
        parcel_anchor.anchor_lat,
        p.district,
        p.sector,
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
        )                                           AS property_type,
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
        )                                           AS hero_image_url
      FROM listing l
      JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      JOIN parcel_anchor_point_preview parcel_anchor
        ON parcel_anchor.parcel_id = p.parcel_id
      LEFT JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN property_asset_profile property_profile
        ON property_profile.property_asset_id = pa.id
      WHERE l.status     = 'active'
        AND l.visibility = 'public'
        AND l.marketing_type = $1
        AND parcel_anchor.anchor_lon BETWEEN $2 AND $4
        AND parcel_anchor.anchor_lat BETWEEN $3 AND $5
        ${extraClauses.join("\n        ")}
      ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
      LIMIT 200
    `,
    queryParams,
  );

  const pins: BrowseMapPin[] = [];
  const cards: BrowseMapCard[] = [];
  const suppressionKeys: string[] = [];

  for (const row of result.rows) {
    const priceLabelRwf = toNumber(row.asking_price_rwf) ?? 0;
    const anchorLng = toNumber(row.anchor_lon) ?? 0;
    const anchorLat = toNumber(row.anchor_lat) ?? 0;

    pins.push({
      listingId: row.listing_id,
      parcelPublicId: row.parcel_public_id,
      assetPublicId: row.asset_public_id ?? undefined,
      routeId: row.route_id,
      priceLabelRwf,
      marketingType: row.marketing_type,
      anchorLng,
      anchorLat,
    });

    cards.push({
      listingId: row.listing_id,
      parcelPublicId: row.parcel_public_id,
      assetPublicId: row.asset_public_id ?? undefined,
      routeId: row.route_id,
      title: buildTitle(row),
      priceLabelRwf,
      marketingType: row.marketing_type,
      heroImageUrl: row.hero_image_url ?? undefined,
      district: row.district ?? undefined,
      sector: row.sector ?? undefined,
      propertyType: row.property_type ?? undefined,
      bedrooms: toNumber(row.bedrooms),
      bathrooms: toNumber(row.bathrooms),
      areaSqm: toNumber(row.interior_area_sqm),
    });

    suppressionKeys.push(row.parcel_public_id);
  }

  return {
    pins,
    cards,
    suppressionKeys,
    resultEnvelope: { minLng, minLat, maxLng, maxLat },
  };
}
