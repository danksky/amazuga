import "server-only";

import { getPgPool } from "./postgres";

export interface BrowseMapPin {
  listingId: string;
  parcelPublicId?: string;
  assetPublicId?: string;
  routeId: string;
  priceLabelRwf: number;
  marketingType: "sale" | "rent";
  anchorLng: number;
  anchorLat: number;
  locationSource?: string;
}

export interface BrowseMapCard {
  listingId: string;
  parcelPublicId?: string;
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
  landAreaSqm?: number;
  locationSource?: string;
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
  parcel_public_id: string | null;
  asset_display_name: string | null;
  asset_public_id: string | null;
  asset_unit_label: string | null;
  route_id: string;
  marketing_type: "sale" | "rent";
  asking_price_rwf: number | string | null;
  anchor_lon: number | string;
  anchor_lat: number | string;
  location_source: string | null;
  location_hidden: boolean;
  district: string | null;
  sector: string | null;
  property_type: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  interior_area_sqm: number | string | null;
  representative_size: number | string | null;
  hero_image_url: string | null;
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function buildTitle(row: BrowseMapRow): string {
  const base = (row.asset_display_name?.trim() || row.asset_public_id?.trim() || row.parcel_public_id || "").trim();
  const unit = row.asset_unit_label?.trim();
  return unit && base ? `${base} · ${unit}` : base || row.route_id;
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
    extraClauses.push(`AND pa.admin_district ILIKE $${queryParams.length}`);
  }
  if (filters?.sector) {
    queryParams.push(filters.sector);
    extraClauses.push(`AND pa.admin_sector ILIKE $${queryParams.length}`);
  }
  if (filters?.cell) {
    queryParams.push(filters.cell);
    extraClauses.push(`AND pa.admin_cell ILIKE $${queryParams.length}`);
  }
  if (filters?.village) {
    queryParams.push(filters.village);
    extraClauses.push(`AND pa.admin_village ILIKE $${queryParams.length}`);
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
        COALESCE(parcel_label(p.upi, p.cell, p.sector), CONCAT_WS(' · ', pa.display_name, pa.admin_sector, pa.admin_district)) AS asset_display_name,
        pa.public_id                                AS asset_public_id,
        pa.unit_label                               AS asset_unit_label,
        pa.public_id                                AS route_id,
        l.marketing_type,
        l.asking_price_rwf,
        pa.anchor_lon,
        pa.anchor_lat,
        pa.location_source,
        l.location_hidden,
        pa.admin_district                           AS district,
        pa.admin_sector                             AS sector,
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
        p.representative_size,
        (
          SELECT li.image_url
          FROM listing_image li
          WHERE li.listing_id = l.id
            AND COALESCE(to_jsonb(li)->>'status', 'ready') = 'ready'
          ORDER BY li.sort_order ASC
          LIMIT 1
        )                                           AS hero_image_url
      FROM listing l
      JOIN property_asset pa
        ON pa.id = l.property_asset_id
      LEFT JOIN parcel_app_ready_seed_preview p
        ON p.parcel_id = l.parcel_id
      LEFT JOIN property_asset_profile property_profile
        ON property_profile.property_asset_id = pa.id
      WHERE l.status     = 'active'
        AND l.visibility = 'public'
        AND l.marketing_type = $1
        AND pa.anchor_lon BETWEEN $2 AND $4
        AND pa.anchor_lat BETWEEN $3 AND $5
        ${extraClauses.join("\n        ")}
      ORDER BY
        CASE WHEN pa.location_source = 'parcel' THEN 0 ELSE 1 END,
        l.published_at DESC NULLS LAST,
        l.created_at DESC,
        l.id ASC
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

    if ((!row.location_source || row.location_source === "parcel") && !row.location_hidden) {
      pins.push({
        listingId: row.listing_id,
        parcelPublicId: row.parcel_public_id ?? undefined,
        assetPublicId: row.asset_public_id ?? undefined,
        routeId: row.route_id,
        priceLabelRwf,
        marketingType: row.marketing_type,
        anchorLng,
        anchorLat,
        locationSource: row.location_source ?? undefined,
      });
    }

    cards.push({
      listingId: row.listing_id,
      parcelPublicId: row.parcel_public_id ?? undefined,
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
      landAreaSqm: toNumber(row.representative_size),
      locationSource: row.location_source ?? undefined,
    });

    if (row.parcel_public_id) {
      suppressionKeys.push(row.parcel_public_id);
    }
  }

  return {
    pins,
    cards,
    suppressionKeys,
    resultEnvelope: { minLng, minLat, maxLng, maxLat },
  };
}
