import "server-only";

import type { Property } from "@/types/domain";

import { pgPool } from "./postgres";

interface ParcelRow {
  upi: string;
  parcel_id: string;
  public_id: string;
  display_id: string | null;
  address_like_label: string | null;
  province: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  representative_size: number | null;
  centroid_lon: number | null;
  centroid_lat: number | null;
  bbox_min_lon: number | null;
  bbox_min_lat: number | null;
  bbox_max_lon: number | null;
  bbox_max_lat: number | null;
  zoning: string | null;
  zone_code: string | null;
  gen_lu: string | null;
  inventory_status: "approved" | "provisional" | "blocked";
}

function buildPlaceholderGeometry(row: ParcelRow): Property["geometry"] {
  if (
    row.bbox_min_lon !== null &&
    row.bbox_min_lat !== null &&
    row.bbox_max_lon !== null &&
    row.bbox_max_lat !== null
  ) {
    return {
      type: "polygon",
      coordinates: [[
        [row.bbox_min_lon, row.bbox_min_lat],
        [row.bbox_max_lon, row.bbox_min_lat],
        [row.bbox_max_lon, row.bbox_max_lat],
        [row.bbox_min_lon, row.bbox_max_lat],
        [row.bbox_min_lon, row.bbox_min_lat],
      ]],
    };
  }

  const lng = row.centroid_lon ?? 0;
  const lat = row.centroid_lat ?? 0;
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

function mapParcelRowToProperty(row: ParcelRow): Property {
  const title = row.display_id || `Parcel ${row.public_id}`;
  const zoningLabel = row.zoning || row.gen_lu || row.zone_code;

  return {
    id: row.parcel_id,
    publicId: row.public_id,
    upi: row.upi,
    title,
    description: undefined,
    location: {
      district: row.district || "Unknown district",
      sector: row.sector || undefined,
      cell: row.cell || undefined,
      village: row.village || undefined,
      lat: row.centroid_lat ?? 0,
      lng: row.centroid_lon ?? 0,
      bbox:
        row.bbox_min_lon !== null &&
        row.bbox_min_lat !== null &&
        row.bbox_max_lon !== null &&
        row.bbox_max_lat !== null
          ? {
              minLng: row.bbox_min_lon,
              minLat: row.bbox_min_lat,
              maxLng: row.bbox_max_lon,
              maxLat: row.bbox_max_lat,
            }
          : undefined,
    },
    geometry: buildPlaceholderGeometry(row),
    facts: {
      propertyType: "Parcel",
      landAreaSqm: row.representative_size ?? undefined,
      zoningLabel: zoningLabel || undefined,
    },
    listingState: "not_listed",
    activeListingId: undefined,
    valuationHistoryIds: [],
  };
}

export async function getPropertyByIdFromDb(propertyId: string): Promise<Property | undefined> {
  const result = await pgPool.query<ParcelRow>(
    `
      SELECT
        upi,
        COALESCE(parcel_id, 'prcl_' || substr(md5('amazuga:parcel:' || upi), 1, 20)) AS parcel_id,
        public_id,
        display_id,
        address_like_label,
        province,
        district,
        sector,
        cell,
        village,
        representative_size,
        centroid_lon,
        centroid_lat,
        bbox_min_lon,
        bbox_min_lat,
        bbox_max_lon,
        bbox_max_lat,
        zoning,
        zone_code,
        gen_lu,
        inventory_status
      FROM parcel_app_ready_seed_preview
      WHERE COALESCE(parcel_id, 'prcl_' || substr(md5('amazuga:parcel:' || upi), 1, 20)) = $1 OR public_id = $1
      LIMIT 1
    `,
    [propertyId],
  );

  const row = result.rows[0];
  return row ? mapParcelRowToProperty(row) : undefined;
}

export async function getPropertyByUpiFromDb(upi: string): Promise<Property | undefined> {
  const result = await pgPool.query<ParcelRow>(
    `
      SELECT
        upi,
        COALESCE(parcel_id, 'prcl_' || substr(md5('amazuga:parcel:' || upi), 1, 20)) AS parcel_id,
        public_id,
        display_id,
        address_like_label,
        province,
        district,
        sector,
        cell,
        village,
        representative_size,
        centroid_lon,
        centroid_lat,
        bbox_min_lon,
        bbox_min_lat,
        bbox_max_lon,
        bbox_max_lat,
        zoning,
        zone_code,
        gen_lu,
        inventory_status
      FROM parcel_app_ready_seed_preview
      WHERE upi = $1
      LIMIT 1
    `,
    [upi.trim()],
  );

  const row = result.rows[0];
  return row ? mapParcelRowToProperty(row) : undefined;
}

export async function findPropertyIdByUpi(upi: string): Promise<string | undefined> {
  const result = await pgPool.query<{ public_id: string }>(
    `
      SELECT public_id
      FROM parcel_app_ready_seed_preview
      WHERE upi = $1
      LIMIT 1
    `,
    [upi.trim()],
  );

  return result.rows[0]?.public_id;
}
