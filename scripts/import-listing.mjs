#!/usr/bin/env node
/**
 * Import a single listing from a JSON specification file.
 *
 * Usage:
 *   node scripts/import-listing.mjs path/to/listing.json [--dry-run]
 *
 * Two modes, determined by whether "upi" is present in the JSON:
 *
 *   UPI mode   (upi present)  — creates property_claim_request + property_asset
 *                               backed by the actual RNRA parcel, then listing.
 *                               Location fields come from parcel data; no
 *                               admin_district etc. needed.
 *
 *   Direct mode (no upi)      — creates property_asset from supplied admin unit
 *                               location. No parcel linkage.
 *
 * Photos are resolved relative to the directory containing listing.json.
 * See scripts/listing-example.json for the full format.
 *
 * Reads config from .env.infra.local and .env.local (same sources as the app):
 *   DATABASE_URL_PREVIEW          — Postgres connection string
 *   LISTING_IMAGE_UPLOAD_URL      — R2/Cloudflare Worker upload endpoint
 *   LISTING_IMAGES_PUBLIC_BASE_URL — CDN public base URL
 *   LISTING_IMAGE_UPLOAD_SECRET   — HMAC signing secret for upload tokens
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

const DATABASE_URL = getEnv("DATABASE_URL_PREVIEW") || getEnv("DATABASE_URL");

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL_PREVIEW or DATABASE_URL must be set in .env.infra.local or environment");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });

// ─── Image upload signing ──────────────────────────────────────────────────────

const UPLOAD_URL = getEnv("LISTING_IMAGE_UPLOAD_URL");
const PUBLIC_BASE_URL = getEnv("LISTING_IMAGES_PUBLIC_BASE_URL");
const UPLOAD_SECRET = getEnv("LISTING_IMAGE_UPLOAD_SECRET");

function createUploadIntent({ listingId, userId, contentType, fileName }) {
  if (!UPLOAD_URL || !PUBLIC_BASE_URL || !UPLOAD_SECRET) {
    throw new Error(
      "Image upload env vars not configured. Set LISTING_IMAGE_UPLOAD_URL, " +
        "LISTING_IMAGES_PUBLIC_BASE_URL, and LISTING_IMAGE_UPLOAD_SECRET in .env.local",
    );
  }
  const payload = {
    version: 1, intentId: randomUUID(), listingId, userId,
    contentType, fileName, maxBytes: 8 * 1024 * 1024,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", UPLOAD_SECRET).update(encoded).digest("base64url");
  return { token: `${encoded}.${sig}`, uploadUrl: UPLOAD_URL };
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function md5hex(value) {
  return createHash("md5").update(value).digest("hex");
}

// Deterministic IDs for UPI path — must match workflows.ts so re-runs are idempotent.
function upiAssetId(parcelId) { return "ast_" + md5hex("claim-primary:" + parcelId).slice(0, 20); }
function upiDisplayCode(parcelId) { return "AST-" + md5hex("claim-display:" + parcelId).slice(0, 10).toUpperCase(); }
function upiOwnershipId(assetId) { return `property-ownership-${assetId}`; }
function recordId(prefix) { return `${prefix}-${Date.now()}`; }

// Random IDs for direct path.
const uid = () => randomUUID().replace(/-/g, "");
function directAssetId() { return "ast_" + uid().slice(0, 20); }
function directPublicId() { return uid().slice(0, 10).toUpperCase(); }
function directDisplayCode() { return "DLT-" + uid().slice(0, 8).toUpperCase(); }
function directListingId() { return "listing-" + randomUUID(); }
function genImageId() { return "listing-image-" + randomUUID(); }
function genPriceHistoryId() { return "lph_" + uid(); }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROPERTY_TYPE_LABELS = {
  house: "House",
  apartment_unit: "Apartment unit",
  apartment_building: "Apartment building",
  commercial_unit: "Commercial unit",
  commercial_building: "Commercial building",
  land: "Land",
};

function directDisplayName({ assetType, bedrooms, adminVillage, adminSector, adminDistrict }) {
  const label = PROPERTY_TYPE_LABELS[assetType] ?? "Property";
  const prefix = bedrooms != null && (assetType === "house" || assetType === "apartment_unit")
    ? `${bedrooms}BR ` : "";
  const parts = [adminVillage, adminSector, adminDistrict].filter(Boolean);
  return `${prefix}${label}${parts.length ? ` · ${parts.join(", ")}` : ""}`;
}

function contentTypeFromPath(filePath) {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" }[ext] ?? "image/jpeg";
}

async function resolveVillageCentroid({ adminDistrict, adminSector, adminCell, adminVillage }) {
  if (!adminVillage) return null;
  const r = await pool.query(
    `SELECT centroid_lat, centroid_lon FROM admin_village_centroid
     WHERE district_name ILIKE $1
       AND ($2::TEXT IS NULL OR sector_name ILIKE $2)
       AND ($3::TEXT IS NULL OR cell_name   ILIKE $3)
       AND village_name ILIKE $4
     LIMIT 1`,
    [adminDistrict, adminSector ?? null, adminCell ?? null, adminVillage],
  );
  if (r.rows[0]) return r.rows[0];
  const fb = await pool.query(
    `SELECT AVG(centroid_lat) AS centroid_lat, AVG(centroid_lon) AS centroid_lon
     FROM parcel_app_ready_seed_preview
     WHERE district ILIKE $1
       AND ($2::TEXT IS NULL OR sector ILIKE $2)
       AND ($3::TEXT IS NULL OR cell   ILIKE $3)
       AND village ILIKE $4
       AND centroid_lat IS NOT NULL`,
    [adminDistrict, adminSector ?? null, adminCell ?? null, adminVillage],
  );
  const row = fb.rows[0];
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
  if (!VALID_ASSET_TYPES.includes(spec.asset_type))
    errors.push(`asset_type must be one of: ${VALID_ASSET_TYPES.join(", ")}`);
  if (!spec.upi && !spec.admin_district)
    errors.push("either upi or admin_district is required");
  if (errors.length > 0)
    throw new Error(`Validation errors in listing.json:\n  - ${errors.join("\n  - ")}`);
}

// ─── UPI path ─────────────────────────────────────────────────────────────────

async function importUpiListing(spec, agent) {
  // 1. Resolve parcel from UPI.
  const parcelResult = await pool.query(
    `SELECT parcel_id, public_id, district, sector, cell, village,
            centroid_lat, centroid_lon,
            parcel_label(upi, cell, sector) AS display_name
     FROM parcel_app_ready_seed_preview
     WHERE upi = $1
     LIMIT 1`,
    [spec.upi],
  );
  if (!parcelResult.rows.length) {
    throw new Error(`No parcel found for UPI: ${spec.upi} — check it exists in parcel_app_ready_seed_preview`);
  }
  const parcel = parcelResult.rows[0];

  // 2. Anchor point (prefer point-on-surface over centroid).
  const anchorResult = await pool.query(
    `SELECT anchor_lat, anchor_lon FROM parcel_anchor_point_preview WHERE parcel_id = $1 LIMIT 1`,
    [parcel.parcel_id],
  );
  const anchor = anchorResult.rows[0];

  const assetId = upiAssetId(parcel.parcel_id);
  const displayCode = upiDisplayCode(parcel.parcel_id);
  const claimId = recordId("property-claim");
  const listingId = recordId("listing");

  console.log(`\n  Parcel    : ${parcel.parcel_id}`);
  console.log(`  Name      : ${parcel.display_name ?? parcel.public_id}`);
  console.log(`  Location  : ${[parcel.village, parcel.cell, parcel.sector, parcel.district].filter(Boolean).join(", ")}`);
  console.log(`  Anchor    : ${anchor ? `${anchor.anchor_lat.toFixed(6)}, ${anchor.anchor_lon.toFixed(6)}` : `centroid ${parcel.centroid_lat?.toFixed(6)}, ${parcel.centroid_lon?.toFixed(6)}`}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Claim request (status='approved' immediately — no pending phase).
    await client.query(
      `INSERT INTO property_claim_request (
        id, user_id, parcel_id, upi, claim_scope, declared_asset_type,
        tenure_type, tenure_source, status, seed_source
      ) VALUES ($1, $2, $3, $4, 'full_parcel', $5, 'unspecified', 'unspecified', 'approved', 'script_import_v1')`,
      [claimId, agent.id, parcel.parcel_id, spec.upi, spec.asset_type],
    );
    console.log(`\n  ✓ property_claim_request : ${claimId}`);

    // property_asset — deterministic ID so re-runs are idempotent.
    await client.query(
      `INSERT INTO property_asset (
        id, parcel_id, asset_type, public_id, display_code,
        is_primary_for_parcel, location_source, display_name,
        admin_district, admin_sector, admin_cell, admin_village,
        anchor_lat, anchor_lon, seed_source
      ) VALUES ($1, $2, $3, $4, $5, TRUE, 'parcel', $6, $7, $8, $9, $10, $11, $12, 'script_import_v1')
      ON CONFLICT (id) DO UPDATE
        SET asset_type = EXCLUDED.asset_type, updated_at = NOW()`,
      [
        assetId, parcel.parcel_id, spec.asset_type,
        parcel.public_id, displayCode,
        parcel.display_name ?? parcel.public_id,
        parcel.district, parcel.sector, parcel.cell, parcel.village,
        anchor?.anchor_lat ?? parcel.centroid_lat,
        anchor?.anchor_lon ?? parcel.centroid_lon,
      ],
    );
    console.log(`  ✓ property_asset         : ${parcel.public_id}  (${displayCode})`);

    // Update claim with resolved asset IDs.
    await client.query(
      `UPDATE property_claim_request SET property_internal_id = $2, property_id = $3 WHERE id = $1`,
      [claimId, assetId, parcel.public_id],
    );

    // property_asset_profile — type label only; no inferred facts for scripts.
    await client.query(
      `INSERT INTO property_asset_profile (
        property_asset_id, created_by_user_id, property_type,
        bedrooms, bathrooms, interior_area_sqm, year_built, seed_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'script_import_v1')
      ON CONFLICT (property_asset_id) DO UPDATE
        SET property_type = COALESCE(NULLIF(BTRIM(property_asset_profile.property_type),''), EXCLUDED.property_type),
            bedrooms       = COALESCE(property_asset_profile.bedrooms,       EXCLUDED.bedrooms),
            bathrooms      = COALESCE(property_asset_profile.bathrooms,      EXCLUDED.bathrooms),
            interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
            year_built     = COALESCE(property_asset_profile.year_built,     EXCLUDED.year_built),
            updated_at     = NOW()`,
      [
        assetId, agent.id,
        PROPERTY_TYPE_LABELS[spec.asset_type],
        spec.bedrooms ?? null, spec.bathrooms ?? null,
        spec.interior_area_sqm ?? null, spec.year_built ?? null,
      ],
    );

    // property_ownership — links agent to asset via claim.
    const ownershipId = upiOwnershipId(assetId);
    await client.query(
      `INSERT INTO property_ownership (
        id, user_id, property_id, property_internal_id,
        parcel_id, ownership_scope, created_from_claim_request_id, seed_source
      ) VALUES ($1, $2, $3, $4, $5, 'full', $6, 'script_import_v1')
      ON CONFLICT (property_internal_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
            updated_at = NOW()`,
      [ownershipId, agent.id, parcel.public_id, assetId, parcel.parcel_id, claimId],
    );
    console.log(`  ✓ property_ownership`);

    // listing — parcel_id is populated (enables map bbox queries).
    await client.query(
      `INSERT INTO listing (
        id, parcel_id, property_asset_id, agency_id, agent_user_id,
        status, marketing_type, asking_price_rwf, location_hidden,
        visibility, currency, seed_source
      ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, 'RWF', 'script_import_v1')`,
      [
        listingId, parcel.parcel_id, assetId,
        spec.agency_id ?? null, agent.id,
        spec.marketing_type, spec.asking_price_rwf ?? null,
        spec.location_hidden ?? false,
        spec.visibility ?? "public",
      ],
    );
    console.log(`  ✓ listing                : ${listingId}`);

    // Grant private_lister role (idempotent).
    await client.query(
      `UPDATE app_user
       SET roles = CASE WHEN roles @> ARRAY['private_lister']::TEXT[] THEN roles
                        ELSE roles || 'private_lister'::TEXT END,
           updated_at = NOW()
       WHERE id = $1`,
      [agent.id],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  return { listingId, assetPublicId: parcel.public_id };
}

// ─── Direct path ──────────────────────────────────────────────────────────────

async function importDirectListing(spec, agent) {
  const centroid = await resolveVillageCentroid({
    adminDistrict: spec.admin_district,
    adminSector: spec.admin_sector,
    adminCell: spec.admin_cell,
    adminVillage: spec.admin_village,
  });

  const locationSource = spec.pin_lat != null ? "pin_derived" : "admin_unit";
  const name = directDisplayName({
    assetType: spec.asset_type,
    bedrooms: spec.bedrooms,
    adminVillage: spec.admin_village,
    adminSector: spec.admin_sector,
    adminDistrict: spec.admin_district,
  });

  const assetId = directAssetId();
  const assetPublicId = directPublicId();
  const assetDisplayCode = directDisplayCode();
  const listingId = directListingId();

  console.log(`\n  Name      : ${name}`);
  console.log(`  Location  : ${[spec.admin_village, spec.admin_cell, spec.admin_sector, spec.admin_district].filter(Boolean).join(", ")}`);
  if (centroid) {
    console.log(`  Anchor    : ${centroid.centroid_lat.toFixed(6)}, ${centroid.centroid_lon.toFixed(6)}`);
  } else {
    console.log(`  Anchor    : ⚠ no centroid found`);
  }

  const hasProfile = spec.bedrooms != null || spec.bathrooms != null ||
    spec.interior_area_sqm != null || spec.year_built != null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO property_asset (
        id, parcel_id, asset_type, public_id, display_code,
        is_primary_for_parcel, location_source, display_name,
        admin_district, admin_sector, admin_cell, admin_village,
        anchor_lat, anchor_lon, private_pin_lat, private_pin_lon,
        seed_source
      ) VALUES ($1, NULL, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'script_import_v1')`,
      [
        assetId, spec.asset_type, assetPublicId, assetDisplayCode,
        locationSource, name,
        spec.admin_district, spec.admin_sector ?? null,
        spec.admin_cell ?? null, spec.admin_village ?? null,
        centroid?.centroid_lat ?? null, centroid?.centroid_lon ?? null,
        spec.pin_lat ?? null, spec.pin_lon ?? null,
      ],
    );
    console.log(`\n  ✓ property_asset  : ${assetPublicId}  (${assetDisplayCode})`);

    if (hasProfile) {
      await client.query(
        `INSERT INTO property_asset_profile (
          property_asset_id, created_by_user_id, property_type,
          bedrooms, bathrooms, interior_area_sqm, year_built, seed_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'script_import_v1')`,
        [
          assetId, agent.id, PROPERTY_TYPE_LABELS[spec.asset_type],
          spec.bedrooms ?? null, spec.bathrooms ?? null,
          spec.interior_area_sqm ?? null, spec.year_built ?? null,
        ],
      );
      console.log(`  ✓ property_asset_profile`);
    }

    await client.query(
      `INSERT INTO listing (
        id, parcel_id, property_asset_id, agency_id, agent_user_id,
        status, marketing_type, visibility, currency,
        asking_price_rwf, seed_source
      ) VALUES ($1, NULL, $2, $3, $4, 'draft', $5, $6, 'RWF', $7, 'script_import_v1')`,
      [
        listingId, assetId, spec.agency_id ?? null, agent.id,
        spec.marketing_type, spec.visibility ?? "public",
        spec.asking_price_rwf ?? null,
      ],
    );
    console.log(`  ✓ listing         : ${listingId}`);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  return { listingId, assetPublicId };
}

// ─── Shared: photo upload + activation ────────────────────────────────────────

async function uploadPhotos(listingId, agentId, photoPaths) {
  console.log(`\n  Uploading photos...`);
  for (let i = 0; i < photoPaths.length; i++) {
    const photoPath = photoPaths[i];
    const baseName = photoPath.split("/").pop() ?? `photo-${i + 1}.jpg`;
    const contentType = contentTypeFromPath(photoPath);
    const intent = createUploadIntent({ listingId, userId: agentId, contentType, fileName: baseName });

    const fileBuffer = readFileSync(photoPath);
    const formData = new FormData();
    formData.append("token", intent.token);
    formData.append("file", new Blob([fileBuffer], { type: contentType }), baseName);

    const uploadRes = await fetch(intent.uploadUrl, { method: "POST", body: formData });
    if (!uploadRes.ok) {
      const body = await uploadRes.text().catch(() => `HTTP ${uploadRes.status}`);
      throw new Error(`Photo upload failed for ${baseName}: ${body}`);
    }
    const uploaded = await uploadRes.json();

    const orderResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order FROM listing_image WHERE listing_id = $1`,
      [listingId],
    );
    const sortOrder = Number(orderResult.rows[0]?.next_order ?? i);

    await pool.query(
      `INSERT INTO listing_image (
        id, listing_id, sort_order, image_url, storage_key,
        content_type, width, height, file_size_bytes,
        uploaded_by_user_id, status, seed_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', 'script_import_v1')`,
      [
        genImageId(), listingId, sortOrder,
        uploaded.imageUrl, uploaded.storageKey,
        uploaded.contentType ?? contentType,
        uploaded.width ?? null, uploaded.height ?? null,
        uploaded.fileSizeBytes ?? fileBuffer.length,
        agentId,
      ],
    );
    console.log(`  ✓ photo ${i + 1}/${photoPaths.length} → ${uploaded.imageUrl}`);
  }
}

async function activateListing(listingId, agentId, askingPriceRwf) {
  if (askingPriceRwf == null) {
    console.log(`\n  ⚠ asking_price_rwf not set — listing left as draft.`);
    return;
  }
  await pool.query(
    `UPDATE listing SET status = 'active', published_at = NOW(), asking_price_rwf = $2 WHERE id = $1`,
    [listingId, askingPriceRwf],
  );
  await pool.query(
    `INSERT INTO listing_price_history (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
     VALUES ($1, $2, $3, $4, 1)`,
    [genPriceHistoryId(), listingId, askingPriceRwf, agentId],
  );
  console.log(`\n  ✓ Activated at ${Number(askingPriceRwf).toLocaleString()} RWF`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error("Usage: node scripts/import-listing.mjs path/to/listing.json [--dry-run]");
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

  console.log(`\n📋 Importing listing from: ${absPath}${dryRun ? "  [DRY RUN]" : ""}`);
  console.log(`   Mode: ${mode}${spec.upi ? `  (UPI: ${spec.upi})` : ""}\n`);

  validate(spec);

  // Agent lookup.
  const agentResult = await pool.query(
    `SELECT id, full_name, phone, roles FROM app_user WHERE phone = $1 AND status = 'active' LIMIT 1`,
    [spec.agent_phone],
  );
  if (!agentResult.rows.length) {
    throw new Error(`No active user found with phone: ${spec.agent_phone}`);
  }
  const agent = agentResult.rows[0];
  console.log(`  Agent  : ${agent.full_name}  (${agent.phone})`);
  console.log(`  ID     : ${agent.id}`);

  // Listing summary.
  console.log(`\n  Type   : ${PROPERTY_TYPE_LABELS[spec.asset_type]}  —  for ${spec.marketing_type}`);
  console.log(`  Price  : ${spec.asking_price_rwf != null ? `${Number(spec.asking_price_rwf).toLocaleString()} RWF` : "not set"}`);
  console.log(`  Vis    : ${spec.visibility ?? "public"}${spec.location_hidden ? "  (location hidden)" : ""}`);
  console.log(`  Act    : ${spec.activate ? "yes" : "no (draft)"}`);

  // Photo validation.
  const photoPaths = (spec.photos ?? []).map((rel) => resolve(listingDir, rel));
  const missing = photoPaths.filter((fp) => !existsSync(fp));
  if (missing.length > 0) throw new Error(`Missing photo files:\n  ${missing.join("\n  ")}`);
  console.log(`  Photos : ${photoPaths.length}`);

  if (dryRun) {
    console.log("\n✅ Dry run complete — no changes made.\n");
    await pool.end();
    return;
  }

  // Import.
  const { listingId, assetPublicId } = spec.upi
    ? await importUpiListing(spec, agent)
    : await importDirectListing(spec, agent);

  if (photoPaths.length > 0) await uploadPhotos(listingId, agent.id, photoPaths);
  if (spec.activate) await activateListing(listingId, agent.id, spec.asking_price_rwf);

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
