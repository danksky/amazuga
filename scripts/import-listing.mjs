#!/usr/bin/env node
/**
 * Import a single listing from a JSON specification file.
 *
 * Usage:
 *   node scripts/import-listing.mjs path/to/listing.json [--dry-run]
 *   node scripts/import-listing.mjs path/to/listing.json --photos-only <listing-id>
 *
 * --dry-run
 *   Validates the spec and resolves the parcel (UPI mode) without writing anything.
 *
 * --photos-only <listing-id>
 *   Skips DB record creation entirely. Uploads photos from the JSON spec to an
 *   already-existing listing and activates it. Use this to recover from a run
 *   where the listing record was created but photo uploads failed mid-way.
 *   Aborts if the listing already has images (use --force to override).
 *
 * Photos in the JSON are resolved relative to the directory containing listing.json.
 * See scripts/listing-example.json for the full format.
 *
 * Reads config from .env.infra.local and .env.local (same sources as the app):
 *   DATABASE_URL_PREVIEW           — Postgres connection string
 *   LISTING_IMAGE_UPLOAD_URL       — R2/Cloudflare Worker upload endpoint
 *   LISTING_IMAGES_PUBLIC_BASE_URL — CDN public base URL
 *   LISTING_IMAGE_UPLOAD_SECRET    — HMAC signing secret for upload tokens
 *   LISTING_IMAGE_UPLOAD_ORIGIN    — Origin header for upload worker (default: http://localhost:3001)
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

// ─── Env loading ───────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const result = {};
  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

const __dir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dir, "..");

const env = {
  ...parseEnvFile(join(projectRoot, ".env.infra.local")),
  ...parseEnvFile(join(projectRoot, ".env.local")),
  ...process.env,
};

function getEnv(key) {
  return env[key]?.trim() || undefined;
}

// ─── DB ────────────────────────────────────────────────────────────────────────

const DATABASE_URL =
  getEnv("DATABASE_URL_PREVIEW") || getEnv("DATABASE_URL");

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL_PREVIEW or DATABASE_URL must be set in .env.infra.local or environment",
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});

// ─── Image upload signing ──────────────────────────────────────────────────────

const UPLOAD_URL = getEnv("LISTING_IMAGE_UPLOAD_URL");
const PUBLIC_BASE_URL = getEnv("LISTING_IMAGES_PUBLIC_BASE_URL");
const UPLOAD_SECRET = getEnv("LISTING_IMAGE_UPLOAD_SECRET");
const UPLOAD_ORIGIN = getEnv("LISTING_IMAGE_UPLOAD_ORIGIN") ?? "http://localhost:3001";

function createSignedToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", UPLOAD_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function createUploadIntent({ listingId, userId, contentType, fileName }) {
  if (!UPLOAD_URL || !PUBLIC_BASE_URL || !UPLOAD_SECRET) {
    throw new Error(
      "Image upload env vars not configured. Set LISTING_IMAGE_UPLOAD_URL, " +
        "LISTING_IMAGES_PUBLIC_BASE_URL, and LISTING_IMAGE_UPLOAD_SECRET in .env.local",
    );
  }
  return {
    token: createSignedToken({
      version: 1,
      intentId: randomUUID(),
      listingId,
      userId,
      contentType,
      fileName,
      maxBytes: 8 * 1024 * 1024,
      exp: Date.now() + 10 * 60 * 1000,
    }),
    uploadUrl: UPLOAD_URL,
  };
}

// ─── Generators ───────────────────────────────────────────────────────────────

const uid = () => randomUUID().replace(/-/g, "");
function genAssetId() { return "ast_" + uid().slice(0, 20); }
function genPublicId() { return uid().slice(0, 10).toUpperCase(); }
function genDisplayCode() { return "DLT-" + uid().slice(0, 8).toUpperCase(); }
function genListingId() { return "listing-" + randomUUID(); }
function genImageId() { return "listing-image-" + randomUUID(); }
function genPriceHistoryId() { return "lph_" + uid(); }

// Deterministic IDs for UPI path — matches workflows.ts so re-runs are idempotent.
function md5hex(v) { return createHash("md5").update(v).digest("hex"); }
function upiAssetId(parcelId) { return "ast_" + md5hex("claim-primary:" + parcelId).slice(0, 20); }
function upiDisplayCode(parcelId) { return "AST-" + md5hex("claim-display:" + parcelId).slice(0, 10).toUpperCase(); }
function recordId(prefix) { return `${prefix}-${Date.now()}`; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS = {
  house: "House",
  apartment_unit: "Apartment unit",
  apartment_building: "Apartment building",
  commercial_unit: "Commercial unit",
  commercial_building: "Commercial building",
  land: "Land",
};

function displayName({ assetType, bedrooms, adminVillage, adminSector, adminDistrict }) {
  const label = PROPERTY_TYPE_LABELS[assetType] ?? "Property";
  const prefix =
    bedrooms != null && (assetType === "house" || assetType === "apartment_unit")
      ? `${bedrooms}BR `
      : "";
  const parts = [adminVillage, adminSector, adminDistrict].filter(Boolean);
  return `${prefix}${label}${parts.length ? ` · ${parts.join(", ")}` : ""}`;
}

function contentTypeFromPath(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return (
    { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" }[
      ext
    ] ?? "image/jpeg"
  );
}

async function resolveVillageCentroid({ adminDistrict, adminSector, adminCell, adminVillage }) {
  if (!adminVillage) return null;
  const primary = await pool.query(
    `SELECT centroid_lat, centroid_lon FROM admin_village_centroid
     WHERE district_name ILIKE $1
       AND ($2::TEXT IS NULL OR sector_name ILIKE $2)
       AND ($3::TEXT IS NULL OR cell_name   ILIKE $3)
       AND village_name ILIKE $4
     LIMIT 1`,
    [adminDistrict, adminSector ?? null, adminCell ?? null, adminVillage],
  );
  if (primary.rows[0]) return primary.rows[0];
  const fallback = await pool.query(
    `SELECT AVG(centroid_lat) AS centroid_lat, AVG(centroid_lon) AS centroid_lon
     FROM parcel_app_ready_seed_preview
     WHERE district ILIKE $1
       AND ($2::TEXT IS NULL OR sector  ILIKE $2)
       AND ($3::TEXT IS NULL OR cell    ILIKE $3)
       AND village ILIKE $4
       AND centroid_lat IS NOT NULL`,
    [adminDistrict, adminSector ?? null, adminCell ?? null, adminVillage],
  );
  const row = fallback.rows[0];
  return row?.centroid_lat != null ? row : null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_ASSET_TYPES = Object.keys(PROPERTY_TYPE_LABELS);
const VALID_MARKETING_TYPES = ["sale", "rent"];
const VALID_VISIBILITIES = ["public", "unlisted", "private"];

function validate(spec) {
  const errors = [];
  if (!spec.agent_phone)
    errors.push("agent_phone is required (E.164 format, e.g. +250788123456)");
  if (!VALID_MARKETING_TYPES.includes(spec.marketing_type))
    errors.push(`marketing_type must be one of: ${VALID_MARKETING_TYPES.join(", ")}`);
  if (spec.visibility && !VALID_VISIBILITIES.includes(spec.visibility))
    errors.push(`visibility must be one of: ${VALID_VISIBILITIES.join(", ")}`);

  const REQUIRES_BEDS_BATHS = ["house", "apartment_unit"];
  const REQUIRES_UNIT_LABEL = ["apartment_unit", "commercial_unit"];

  if (spec.upi) {
    // UPI mode — asset_type lives at top level; location comes from parcel.
    if (!VALID_ASSET_TYPES.includes(spec.asset_type))
      errors.push(`asset_type must be one of: ${VALID_ASSET_TYPES.join(", ")}`);
    if (REQUIRES_BEDS_BATHS.includes(spec.asset_type)) {
      if (spec.bedrooms == null) errors.push(`bedrooms is required for asset_type "${spec.asset_type}"`);
      if (spec.bathrooms == null) errors.push(`bathrooms is required for asset_type "${spec.asset_type}"`);
    }
    if (REQUIRES_UNIT_LABEL.includes(spec.asset_type)) {
      if (!spec.unit_label?.trim()) errors.push(`unit_label is required for asset_type "${spec.asset_type}" (e.g. "A-201", "Flat 3B")`);
    }
  } else {
    // Direct mode — property wrapper required with asset_type + admin_district.
    if (!spec.property) {
      errors.push("either upi (UPI mode) or a property object (direct mode) is required");
    } else {
      if (!VALID_ASSET_TYPES.includes(spec.property.asset_type))
        errors.push(`property.asset_type must be one of: ${VALID_ASSET_TYPES.join(", ")}`);
      if (!spec.property.admin_district)
        errors.push("property.admin_district is required for direct mode");
      if (REQUIRES_BEDS_BATHS.includes(spec.property.asset_type)) {
        if (spec.property.bedrooms == null) errors.push(`property.bedrooms is required for asset_type "${spec.property.asset_type}"`);
        if (spec.property.bathrooms == null) errors.push(`property.bathrooms is required for asset_type "${spec.property.asset_type}"`);
      }
    }
  }

  if (!spec.photos || spec.photos.length === 0)
    errors.push("photos array must contain at least one photo");

  if (errors.length > 0)
    throw new Error(`Validation errors in listing.json:\n  - ${errors.join("\n  - ")}`);
}

// ─── UPI path ─────────────────────────────────────────────────────────────────

async function createUpiListing(spec, agent, client) {
  // Look up parcel — provides all location info.
  const parcelResult = await pool.query(
    `SELECT parcel_id, public_id, district, sector, cell, village,
            centroid_lat, centroid_lon,
            parcel_label(upi, cell, sector) AS display_name
     FROM parcel_app_ready_seed_preview WHERE upi = $1 LIMIT 1`,
    [spec.upi],
  );
  if (!parcelResult.rows.length)
    throw new Error(`No parcel found for UPI: ${spec.upi}`);
  const parcel = parcelResult.rows[0];

  const anchorResult = await pool.query(
    `SELECT anchor_lat, anchor_lon FROM parcel_anchor_point_preview WHERE parcel_id = $1 LIMIT 1`,
    [parcel.parcel_id],
  );
  const anchor = anchorResult.rows[0];

  const assetId = upiAssetId(parcel.parcel_id);
  const displayCode = upiDisplayCode(parcel.parcel_id);
  const claimId = recordId("property-claim");
  const listingId = recordId("listing");

  console.log(`  Parcel   : ${parcel.parcel_id}`);
  console.log(`  Name     : ${parcel.display_name ?? parcel.public_id}`);
  console.log(`  Location : ${[parcel.village, parcel.cell, parcel.sector, parcel.district].filter(Boolean).join(", ")}`);
  console.log(`  Anchor   : ${anchor ? `${Number(anchor.anchor_lat).toFixed(6)}, ${Number(anchor.anchor_lon).toFixed(6)}` : `centroid ${Number(parcel.centroid_lat).toFixed(6)}, ${Number(parcel.centroid_lon).toFixed(6)}`}`);

  // Claim request — written approved immediately, no pending phase.
  await client.query(
    `INSERT INTO property_claim_request (
      id, user_id, parcel_id, upi, claim_scope, declared_asset_type,
      tenure_type, tenure_source, status, seed_source
    ) VALUES ($1,$2,$3,$4,'full_parcel',$5,'unspecified','unspecified','approved','script_import_v1')`,
    [claimId, agent.id, parcel.parcel_id, spec.upi, spec.asset_type],
  );

  // property_asset — deterministic ID; ON CONFLICT safe for re-runs.
  await client.query(
    `INSERT INTO property_asset (
      id, parcel_id, asset_type, public_id, display_code,
      is_primary_for_parcel, location_source, display_name,
      admin_district, admin_sector, admin_cell, admin_village,
      anchor_lat, anchor_lon, unit_label, seed_source
    ) VALUES ($1,$2,$3,$4,$5,TRUE,'parcel',$6,$7,$8,$9,$10,$11,$12,$13,'script_import_v1')
    ON CONFLICT (id) DO UPDATE SET asset_type = EXCLUDED.asset_type, unit_label = EXCLUDED.unit_label, updated_at = NOW()`,
    [
      assetId, parcel.parcel_id, spec.asset_type, parcel.public_id, displayCode,
      parcel.display_name ?? parcel.public_id,
      parcel.district, parcel.sector, parcel.cell, parcel.village,
      anchor?.anchor_lat ?? parcel.centroid_lat,
      anchor?.anchor_lon ?? parcel.centroid_lon,
      spec.unit_label ?? null,
    ],
  );

  // Back-fill claim with resolved asset IDs.
  await client.query(
    `UPDATE property_claim_request SET property_internal_id=$2, property_id=$3 WHERE id=$1`,
    [claimId, assetId, parcel.public_id],
  );

  // property_asset_profile — COALESCE so re-runs don't clobber manual edits.
  const hasProfile = spec.bedrooms != null || spec.bathrooms != null ||
    spec.interior_area_sqm != null || spec.year_built != null;
  await client.query(
    `INSERT INTO property_asset_profile (
      property_asset_id, created_by_user_id, property_type,
      bedrooms, bathrooms, interior_area_sqm, year_built, seed_source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'script_import_v1')
    ON CONFLICT (property_asset_id) DO UPDATE SET
      property_type     = COALESCE(NULLIF(BTRIM(property_asset_profile.property_type),''), EXCLUDED.property_type),
      bedrooms          = COALESCE(property_asset_profile.bedrooms,          EXCLUDED.bedrooms),
      bathrooms         = COALESCE(property_asset_profile.bathrooms,         EXCLUDED.bathrooms),
      interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
      year_built        = COALESCE(property_asset_profile.year_built,        EXCLUDED.year_built),
      updated_at        = NOW()`,
    [assetId, agent.id, PROPERTY_TYPE_LABELS[spec.asset_type],
     spec.bedrooms ?? null, spec.bathrooms ?? null,
     spec.interior_area_sqm ?? null, spec.year_built ?? null],
  );
  if (hasProfile) console.log(`  ✓ property_asset_profile`);

  // property_ownership — agent owns this asset via the claim.
  await client.query(
    `INSERT INTO property_ownership (
      id, user_id, property_id, property_internal_id,
      parcel_id, ownership_scope, created_from_claim_request_id, seed_source
    ) VALUES ($1,$2,$3,$4,$5,'full',$6,'script_import_v1')
    ON CONFLICT (property_internal_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
      updated_at = NOW()`,
    [`property-ownership-${assetId}`, agent.id, parcel.public_id, assetId, parcel.parcel_id, claimId],
  );

  // listing — parcel_id populated so map bbox queries work.
  await client.query(
    `INSERT INTO listing (
      id, parcel_id, property_asset_id, agency_id, agent_user_id,
      status, marketing_type, asking_price_rwf, location_hidden,
      visibility, currency, seed_source
    ) VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8,$9,'RWF','script_import_v1')`,
    [
      listingId, parcel.parcel_id, assetId, spec.agency_id ?? null, agent.id,
      spec.marketing_type, spec.asking_price_rwf ?? null,
      spec.location_hidden ?? false, spec.visibility ?? "public",
    ],
  );

  // Grant private_lister role (idempotent).
  await client.query(
    `UPDATE app_user
     SET roles = CASE WHEN roles @> ARRAY['private_lister']::TEXT[] THEN roles
                      ELSE roles || 'private_lister'::TEXT END,
         updated_at = NOW()
     WHERE id = $1`,
    [agent.id],
  );

  console.log(`  ✓ property_claim_request + asset + ownership`);
  console.log(`  ✓ listing  : ${listingId}`);
  return { listingId, assetPublicId: parcel.public_id };
}

// ─── Photos-only recovery path ────────────────────────────────────────────────

async function uploadPhotosToExisting({ spec, listingDir, listingId, force }) {
  // Resolve photo paths from the spec.
  const photoPaths = (spec.photos ?? []).map((rel) => resolve(listingDir, rel));
  if (photoPaths.length === 0) throw new Error("No photos in spec — nothing to upload.");
  const missing = photoPaths.filter((fp) => !existsSync(fp));
  if (missing.length > 0) throw new Error(`Missing photo files:\n  ${missing.join("\n  ")}`);

  // Look up the listing + agent.
  const listingResult = await pool.query(
    `SELECT l.id, l.status, l.agent_user_id, l.asking_price_rwf,
            pa.public_id AS asset_public_id
     FROM listing l
     JOIN property_asset pa ON pa.id = l.property_asset_id
     WHERE l.id = $1`,
    [listingId],
  );
  if (!listingResult.rows.length) throw new Error(`Listing not found: ${listingId}`);
  const listing = listingResult.rows[0];

  // Check for existing images.
  const imgCountResult = await pool.query(
    `SELECT COUNT(*) AS n FROM listing_image WHERE listing_id = $1`,
    [listingId],
  );
  const existingCount = Number(imgCountResult.rows[0].n);
  if (existingCount > 0 && !force) {
    throw new Error(
      `Listing ${listingId} already has ${existingCount} image(s).\n` +
      `  Pass --force to append photos anyway.`,
    );
  }
  if (existingCount > 0) {
    console.log(`  ⚠ Appending to ${existingCount} existing image(s) (--force)`);
  }

  console.log(`  Listing : ${listingId}  (${listing.status})`);
  console.log(`  Asset   : /property/${listing.asset_public_id}`);
  console.log(`  Photos  : ${photoPaths.length}\n`);
  console.log(`  Uploading photos...`);

  for (let i = 0; i < photoPaths.length; i++) {
    const photoPath = photoPaths[i];
    const baseName  = photoPath.split("/").pop() ?? `photo-${i + 1}.jpg`;
    const ct        = contentTypeFromPath(photoPath);
    const intent    = createUploadIntent({ listingId, userId: listing.agent_user_id, contentType: ct, fileName: baseName });

    const fileBuffer = readFileSync(photoPath);
    const formData   = new FormData();
    formData.append("token", intent.token);
    formData.append("file", new Blob([fileBuffer], { type: ct }), baseName);

    const uploadRes = await fetch(intent.uploadUrl, {
      method: "POST",
      body: formData,
      headers: { Origin: UPLOAD_ORIGIN },
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
      throw new Error(`Photo upload failed for ${baseName}: ${body}`);
    }
    const uploaded = await uploadRes.json();

    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM listing_image WHERE listing_id = $1`,
      [listingId],
    );
    await pool.query(
      `INSERT INTO listing_image (
        id, listing_id, sort_order, image_url, storage_key,
        content_type, width, height, file_size_bytes,
        uploaded_by_user_id, status, seed_source
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ready','script_import_v1')`,
      [
        genImageId(), listingId, Number(orderResult.rows[0]?.next_order ?? i),
        uploaded.imageUrl, uploaded.storageKey,
        uploaded.contentType ?? ct,
        uploaded.width ?? null, uploaded.height ?? null,
        uploaded.fileSizeBytes ?? fileBuffer.length,
        listing.agent_user_id,
      ],
    );
    console.log(`  ✓ photo ${i + 1}/${photoPaths.length} → ${uploaded.imageUrl}`);
  }

  // Activate if requested.
  if (spec.activate) {
    if (spec.asking_price_rwf == null) {
      console.log(`\n  ⚠ asking_price_rwf not set — listing left as draft.`);
    } else {
      await pool.query(
        `UPDATE listing SET status='active', published_at=NOW(), asking_price_rwf=$2 WHERE id=$1`,
        [listingId, spec.asking_price_rwf],
      );
      await pool.query(
        `INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
         VALUES ($1,$2,$3,$4,1)`,
        [genPriceHistoryId(), listingId, spec.asking_price_rwf, listing.agent_user_id],
      );
      console.log(`\n  ✓ Activated at ${Number(spec.asking_price_rwf).toLocaleString()} RWF`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Property : /property/${listing.asset_public_id}`);
  console.log(`   Listing  : ${listingId}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force   = args.includes("--force");

  // --photos-only <listing-id>
  const photosOnlyIdx = args.indexOf("--photos-only");
  const photosOnly    = photosOnlyIdx !== -1;
  const photosOnlyId  = photosOnly ? args[photosOnlyIdx + 1] : null;

  if (photosOnly && (!photosOnlyId || photosOnlyId.startsWith("--"))) {
    console.error("Usage: node scripts/import-listing.mjs path/to/listing.json --photos-only <listing-id>");
    process.exit(1);
  }

  const filePath = args.find((a) => !a.startsWith("--") && a !== photosOnlyId);

  if (!filePath) {
    console.error(
      "Usage:\n" +
      "  node scripts/import-listing.mjs path/to/listing.json [--dry-run]\n" +
      "  node scripts/import-listing.mjs path/to/listing.json --photos-only <listing-id> [--force]",
    );
    process.exit(1);
  }

  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    console.error(`❌ File not found: ${absPath}`);
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(absPath, "utf8"));
  const listingDir = dirname(absPath);

  const mode = spec.upi ? "UPI" : "direct";

  if (photosOnly) {
    console.log(`\n📸 Photos-only mode for listing: ${photosOnlyId}${force ? "  [--force]" : ""}`);
    console.log(`   Spec: ${absPath}\n`);
    await uploadPhotosToExisting({ spec, listingDir, listingId: photosOnlyId, force });
    await pool.end();
    return;
  }

  console.log(`\n📋 Importing listing from: ${absPath}${dryRun ? "  [DRY RUN]" : ""}`);
  console.log(`   Mode: ${mode}${spec.upi ? `  (${spec.upi})` : ""}\n`);

  validate(spec);

  // ── Look up agent ──────────────────────────────────────────────────────────

  const agentResult = await pool.query(
    `SELECT id, full_name, phone, roles FROM app_user
     WHERE phone = $1 AND status = 'active' LIMIT 1`,
    [spec.agent_phone],
  );
  if (!agentResult.rows.length) {
    throw new Error(
      `No active user found with phone: ${spec.agent_phone}\n` +
        `  (Agent must have signed in via OTP at least once)`,
    );
  }
  const agent = agentResult.rows[0];
  console.log(`  Agent  : ${agent.full_name}  (${agent.phone})`);
  console.log(`  ID     : ${agent.id}`);

  // ── Listing summary ────────────────────────────────────────────────────────

  const assetType = spec.upi ? spec.asset_type : spec.property.asset_type;
  console.log(`  Type   : ${PROPERTY_TYPE_LABELS[assetType]}  —  for ${spec.marketing_type}`);
  console.log(`  Price  : ${spec.asking_price_rwf != null ? `${Number(spec.asking_price_rwf).toLocaleString()} RWF` : "not set"}`);
  console.log(`  Vis    : ${spec.visibility ?? "public"}${spec.location_hidden ? "  (location hidden)" : ""}`);
  console.log(`  Act    : ${spec.activate ? "yes" : "no (draft)"}`);

  if (mode === "direct") {
    const p = spec.property;
    const centroid = await resolveVillageCentroid({
      adminDistrict: p.admin_district, adminSector: p.admin_sector,
      adminCell: p.admin_cell, adminVillage: p.admin_village,
    });
    const name = displayName({
      assetType: p.asset_type, bedrooms: p.bedrooms,
      adminVillage: p.admin_village, adminSector: p.admin_sector,
      adminDistrict: p.admin_district,
    });
    console.log(`  Name   : ${name}`);
    console.log(`  Loc    : ${[p.admin_village, p.admin_cell, p.admin_sector, p.admin_district].filter(Boolean).join(", ")}`);
    console.log(`  Anchor : ${centroid ? `${centroid.centroid_lat.toFixed(6)}, ${centroid.centroid_lon.toFixed(6)}` : "⚠ no centroid"}`);
  }

  // ── Photo validation ───────────────────────────────────────────────────────

  const photoPaths = (spec.photos ?? []).map((rel) => resolve(listingDir, rel));
  const missing = photoPaths.filter((fp) => !existsSync(fp));
  if (missing.length > 0) throw new Error(`Missing photo files:\n  ${missing.join("\n  ")}`);
  console.log(`  Photos : ${photoPaths.length}`);

  if (dryRun) {
    if (mode === "UPI") {
      // Still resolve the parcel in dry-run so we can show what would be created.
      const pr = await pool.query(
        `SELECT public_id, district, sector, cell, village,
                parcel_label(upi, cell, sector) AS display_name
         FROM parcel_app_ready_seed_preview WHERE upi = $1 LIMIT 1`,
        [spec.upi],
      );
      if (!pr.rows.length) console.log(`  ⚠ No parcel found for UPI: ${spec.upi}`);
      else {
        const r = pr.rows[0];
        console.log(`  Parcel : ${r.public_id}  "${r.display_name ?? r.public_id}"`);
        console.log(`  Loc    : ${[r.village, r.cell, r.sector, r.district].filter(Boolean).join(", ")}`);
      }
    }
    console.log("\n✅ Dry run complete — no changes made.\n");
    await pool.end();
    return;
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  let listingId, assetPublicId;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (mode === "UPI") {
      ({ listingId, assetPublicId } = await createUpiListing(spec, agent, client));
    } else {
      const p = spec.property;
      const centroid = await resolveVillageCentroid({
        adminDistrict: p.admin_district, adminSector: p.admin_sector,
        adminCell: p.admin_cell, adminVillage: p.admin_village,
      });
      const locationSource = p.pin_lat != null ? "pin_derived" : "admin_unit";
      const name = displayName({
        assetType: p.asset_type, bedrooms: p.bedrooms,
        adminVillage: p.admin_village, adminSector: p.admin_sector,
        adminDistrict: p.admin_district,
      });
      const hasProfile = p.bedrooms != null || p.bathrooms != null ||
        p.interior_area_sqm != null || p.year_built != null;
      const assetId = genAssetId();
      assetPublicId = genPublicId();
      const assetDisplayCode = genDisplayCode();
      listingId = genListingId();

      await client.query(
        `INSERT INTO property_asset (
          id, parcel_id, asset_type, public_id, display_code,
          is_primary_for_parcel, location_source, display_name,
          admin_district, admin_sector, admin_cell, admin_village,
          anchor_lat, anchor_lon, private_pin_lat, private_pin_lon,
          unit_label, seed_source
        ) VALUES ($1,NULL,$2,$3,$4,FALSE,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'script_import_v1')`,
        [
          assetId, p.asset_type, assetPublicId, assetDisplayCode, locationSource, name,
          p.admin_district, p.admin_sector ?? null, p.admin_cell ?? null, p.admin_village ?? null,
          centroid?.centroid_lat ?? null, centroid?.centroid_lon ?? null,
          p.pin_lat ?? null, p.pin_lon ?? null,
          p.unit_label ?? null,
        ],
      );
      console.log(`\n  ✓ property_asset  : ${assetPublicId}  (${assetDisplayCode})`);

      if (hasProfile) {
        await client.query(
          `INSERT INTO property_asset_profile (
            property_asset_id, created_by_user_id, property_type,
            bedrooms, bathrooms, interior_area_sqm, year_built, seed_source
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'script_import_v1')`,
          [assetId, agent.id, PROPERTY_TYPE_LABELS[p.asset_type],
           p.bedrooms ?? null, p.bathrooms ?? null, p.interior_area_sqm ?? null, p.year_built ?? null],
        );
        console.log(`  ✓ property_asset_profile`);
      }

      await client.query(
        `INSERT INTO listing (
          id, parcel_id, property_asset_id, agency_id, agent_user_id,
          status, marketing_type, visibility, currency, asking_price_rwf,
          location_hidden, seed_source
        ) VALUES ($1,NULL,$2,$3,$4,'draft',$5,$6,'RWF',$7,TRUE,'script_import_v1')`,
        [listingId, assetId, spec.agency_id ?? null, agent.id,
         spec.marketing_type, spec.visibility ?? "public", spec.asking_price_rwf ?? null],
      );
      console.log(`  ✓ listing         : ${listingId}`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  // ── Upload photos ──────────────────────────────────────────────────────────

  if (photoPaths.length > 0) {
    console.log(`\n  Uploading photos...`);
    for (let i = 0; i < photoPaths.length; i++) {
      const photoPath = photoPaths[i];
      const baseName = photoPath.split("/").pop() ?? `photo-${i + 1}.jpg`;
      const contentType = contentTypeFromPath(photoPath);
      const intent = createUploadIntent({ listingId, userId: agent.id, contentType, fileName: baseName });

      const fileBuffer = readFileSync(photoPath);
      const formData = new FormData();
      formData.append("token", intent.token);
      formData.append("file", new Blob([fileBuffer], { type: contentType }), baseName);

      const uploadRes = await fetch(intent.uploadUrl, {
        method: "POST",
        body: formData,
        headers: { Origin: UPLOAD_ORIGIN },
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
        throw new Error(`Photo upload failed for ${baseName}: ${body}`);
      }
      const uploaded = await uploadRes.json();

      const orderResult = await pool.query(
        `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM listing_image WHERE listing_id = $1`,
        [listingId],
      );
      await pool.query(
        `INSERT INTO listing_image (
          id, listing_id, sort_order, image_url, storage_key,
          content_type, width, height, file_size_bytes,
          uploaded_by_user_id, status, seed_source
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ready','script_import_v1')`,
        [
          genImageId(), listingId, Number(orderResult.rows[0]?.next_order ?? i),
          uploaded.imageUrl, uploaded.storageKey,
          uploaded.contentType ?? contentType,
          uploaded.width ?? null, uploaded.height ?? null,
          uploaded.fileSizeBytes ?? fileBuffer.length,
          agent.id,
        ],
      );
      console.log(`  ✓ photo ${i + 1}/${photoPaths.length} → ${uploaded.imageUrl}`);
    }
  }

  // ── Activate ───────────────────────────────────────────────────────────────

  if (spec.activate) {
    if (spec.asking_price_rwf == null) {
      console.log(`\n  ⚠ asking_price_rwf not set — listing left as draft.`);
    } else {
      await pool.query(
        `UPDATE listing SET status='active', published_at=NOW(), asking_price_rwf=$2 WHERE id=$1`,
        [listingId, spec.asking_price_rwf],
      );
      await pool.query(
        `INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
         VALUES ($1,$2,$3,$4,1)`,
        [genPriceHistoryId(), listingId, spec.asking_price_rwf, agent.id],
      );
      console.log(`\n  ✓ Activated at ${Number(spec.asking_price_rwf).toLocaleString()} RWF`);
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Property : /property/${assetPublicId}`);
  console.log(`   Listing  : ${listingId}\n`);

  await pool.end();
}

run().catch((err) => {
  console.error("\n❌", err.message);
  pool.end().catch(() => undefined);
  process.exit(1);
});
