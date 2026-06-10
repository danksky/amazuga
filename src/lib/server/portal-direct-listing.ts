import "server-only";

import { randomUUID } from "node:crypto";

import type { ListingVisibility, PropertyKind } from "@/types/domain";

import { getPgPool } from "./postgres";

export interface DirectListingInput {
  createdByUserId: string;
  agencyId?: string;
  agentUserId: string;
  assetType: PropertyKind;
  adminDistrict: string;
  adminSector?: string;
  adminCell?: string;
  adminVillage?: string;
  pinLat?: number;
  pinLon?: number;
  marketingType: "sale" | "rent";
  visibility: ListingVisibility;
  askingPriceRwf?: number;
  bedrooms?: number;
  bathrooms?: number;
  interiorAreaSqm?: number;
  createOwnershipForUser?: string;
}

// Location is no longer baked in — queries compute it dynamically from
// admin_sector + admin_district at render time (same pattern as parcel_label).
function generateDirectListingDisplayName(input: {
  assetType: PropertyKind;
  bedrooms?: number;
}): string {
  const typeLabels: Record<PropertyKind, string> = {
    house: "House",
    apartment_unit: "Apartment unit",
    apartment_building: "Apartment building",
    commercial_unit: "Commercial unit",
    commercial_building: "Commercial building",
    land: "Land",
  };
  const typeLabel = typeLabels[input.assetType] ?? "Property";
  const bedroomPrefix =
    input.bedrooms != null && (input.assetType === "house" || input.assetType === "apartment_unit")
      ? `${input.bedrooms}BR `
      : "";
  return `${bedroomPrefix}${typeLabel}`;
}

function generatePublicId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

function generateDisplayCode(): string {
  return "DLT-" + randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function resolveVillageCentroid(input: {
  adminDistrict: string;
  adminSector?: string;
  adminCell?: string;
  adminVillage?: string;
}): Promise<{ centroid_lat: number; centroid_lon: number } | null> {
  if (!input.adminVillage) return null;

  // Primary: admin_village_centroid (NISR boundary data / parcel-seeded)
  const result = await getPgPool().query<{ centroid_lat: number; centroid_lon: number }>(
    `
      SELECT centroid_lat, centroid_lon
      FROM admin_village_centroid
      WHERE district_name ILIKE $1
        AND ($2::TEXT IS NULL OR sector_name ILIKE $2)
        AND ($3::TEXT IS NULL OR cell_name   ILIKE $3)
        AND village_name ILIKE $4
      LIMIT 1
    `,
    [input.adminDistrict, input.adminSector ?? null, input.adminCell ?? null, input.adminVillage],
  );

  if (result.rows[0]) return result.rows[0];

  // Fallback: derive approximate centroid from parcel dataset
  const fallback = await getPgPool().query<{ centroid_lat: number; centroid_lon: number }>(
    `
      SELECT AVG(centroid_lat) AS centroid_lat, AVG(centroid_lon) AS centroid_lon
      FROM parcel_app_ready_seed_preview
      WHERE district ILIKE $1
        AND ($2::TEXT IS NULL OR sector  ILIKE $2)
        AND ($3::TEXT IS NULL OR cell    ILIKE $3)
        AND village ILIKE $4
        AND centroid_lat IS NOT NULL
        AND centroid_lon IS NOT NULL
    `,
    [input.adminDistrict, input.adminSector ?? null, input.adminCell ?? null, input.adminVillage],
  );

  const row = fallback.rows[0];
  return row?.centroid_lat != null ? row : null;
}

export interface AdminUnitLevel {
  districts: string[];
}

export async function getAdminDistricts(): Promise<string[]> {
  const result = await getPgPool().query<{ district_name: string }>(
    `SELECT DISTINCT district_name FROM admin_village_centroid ORDER BY district_name ASC`,
  );
  return result.rows.map((r) => r.district_name);
}

export async function getAdminSectors(districtName: string): Promise<string[]> {
  const result = await getPgPool().query<{ sector_name: string }>(
    `SELECT DISTINCT sector_name FROM admin_village_centroid WHERE district_name ILIKE $1 ORDER BY sector_name ASC`,
    [districtName],
  );
  return result.rows.map((r) => r.sector_name);
}

export async function getAdminCells(districtName: string, sectorName: string): Promise<string[]> {
  const result = await getPgPool().query<{ cell_name: string }>(
    `SELECT DISTINCT cell_name FROM admin_village_centroid WHERE district_name ILIKE $1 AND sector_name ILIKE $2 ORDER BY cell_name ASC`,
    [districtName, sectorName],
  );
  return result.rows.map((r) => r.cell_name);
}

export async function getAdminVillages(districtName: string, sectorName: string, cellName: string): Promise<string[]> {
  const result = await getPgPool().query<{ village_name: string }>(
    `SELECT DISTINCT village_name FROM admin_village_centroid WHERE district_name ILIKE $1 AND sector_name ILIKE $2 AND cell_name ILIKE $3 ORDER BY village_name ASC`,
    [districtName, sectorName, cellName],
  );
  return result.rows.map((r) => r.village_name);
}

export async function createDirectListingInDb(input: DirectListingInput): Promise<{
  listingId: string;
  assetPublicId: string;
}> {
  const locationSource = input.pinLat != null ? "pin_derived" : "admin_unit";
  const displayName = generateDirectListingDisplayName({
    assetType: input.assetType,
    bedrooms: input.bedrooms,
  });
  const centroid = await resolveVillageCentroid({
    adminDistrict: input.adminDistrict,
    adminSector: input.adminSector,
    adminCell: input.adminCell,
    adminVillage: input.adminVillage,
  });

  const assetId = "ast_" + randomUUID().replace(/-/g, "").slice(0, 20);
  const assetPublicId = generatePublicId();
  const assetDisplayCode = generateDisplayCode();
  const listingId = "listing-" + randomUUID();

  const client = await getPgPool().connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        INSERT INTO property_asset (
          id, parcel_id, asset_type, public_id, display_code,
          is_primary_for_parcel, location_source, display_name,
          admin_district, admin_sector, admin_cell, admin_village,
          anchor_lat, anchor_lon, private_pin_lat, private_pin_lon,
          seed_source
        )
        VALUES ($1, NULL, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'manual_direct_listing_v1')
      `,
      [
        assetId,
        input.assetType,
        assetPublicId,
        assetDisplayCode,
        locationSource,
        displayName,
        input.adminDistrict,
        input.adminSector ?? null,
        input.adminCell ?? null,
        input.adminVillage ?? null,
        centroid?.centroid_lat ?? null,
        centroid?.centroid_lon ?? null,
        input.pinLat ?? null,
        input.pinLon ?? null,
      ],
    );

    if (input.bedrooms != null || input.bathrooms != null || input.interiorAreaSqm != null) {
      const propertyType =
        input.assetType === "house" ? "House"
        : input.assetType === "apartment_unit" ? "Apartment unit"
        : input.assetType === "apartment_building" ? "Apartment building"
        : input.assetType === "commercial_building" ? "Commercial building"
        : input.assetType === "commercial_unit" ? "Commercial unit"
        : input.assetType === "land" ? "Land"
        : "Property";

      await client.query(
        `
          INSERT INTO property_asset_profile (
            property_asset_id, created_by_user_id, property_type,
            bedrooms, bathrooms, interior_area_sqm, seed_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'manual_direct_listing_v1')
        `,
        [
          assetId,
          input.createdByUserId,
          propertyType,
          input.bedrooms ?? null,
          input.bathrooms ?? null,
          input.interiorAreaSqm ?? null,
        ],
      );
    }

    if (input.createOwnershipForUser) {
      const ownershipId = "property-ownership-" + assetId;
      await client.query(
        `
          INSERT INTO property_ownership (
            id, user_id, property_id, property_internal_id,
            parcel_id, ownership_scope, seed_source
          )
          VALUES ($1, $2, $3, $4, NULL, 'full', 'manual_direct_listing_v1')
        `,
        [ownershipId, input.createOwnershipForUser, assetPublicId, assetId],
      );
    }

    await client.query(
      `
        INSERT INTO listing (
          id, parcel_id, property_asset_id, agency_id, agent_user_id,
          status, marketing_type, asking_price_rwf, visibility, currency, seed_source
        )
        VALUES ($1, NULL, $2, $3, $4, 'draft', $5, $6, $7, 'RWF', 'manual_direct_listing_v1')
      `,
      [
        listingId,
        assetId,
        input.agencyId ?? null,
        input.agentUserId,
        input.marketingType,
        input.askingPriceRwf ?? null,
        input.visibility,
      ],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return { listingId, assetPublicId };
}
