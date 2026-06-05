#!/usr/bin/env node
/**
 * Import a single listing from a JSON specification file.
 *
 * Usage:
 *   node scripts/import-listing.mjs path/to/listing.json [--dry-run]
 *
 * Photos in the JSON are resolved relative to the directory containing listing.json.
 * See scripts/listing-example.json for the full format.
 *
 * Reads config from .env.infra.local and .env.local (same sources as the app):
 *   DATABASE_URL_PREVIEW          — Postgres connection string
 *   LISTING_IMAGE_UPLOAD_URL      — R2/Cloudflare Worker upload endpoint
 *   LISTING_IMAGES_PUBLIC_BASE_URL — CDN public base URL
 *   LISTING_IMAGE_UPLOAD_SECRET   — HMAC signing secret for upload tokens
 */

import { createHmac, randomUUID } from "node:crypto";
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
  if (!spec.property) {
    errors.push("property object is required");
  } else {
    if (!VALID_ASSET_TYPES.includes(spec.property.asset_type))
      errors.push(
        `property.asset_type must be one of: ${VALID_ASSET_TYPES.join(", ")}`,
      );
    if (!spec.property.admin_district)
      errors.push("property.admin_district is required");
  }
  if (errors.length > 0)
    throw new Error(`Validation errors in listing.json:\n  - ${errors.join("\n  - ")}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const filePath = args.find((a) => !a.startsWith("--"));

  if (!filePath) {
    console.error(
      "Usage: node scripts/import-listing.mjs path/to/listing.json [--dry-run]",
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

  console.log(`\n📋 Importing listing from: ${absPath}${dryRun ? "  [DRY RUN]" : ""}\n`);

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
        `  (Check the Africa's Talking dashboard and sign in as that agent first)`,
    );
  }
  const agent = agentResult.rows[0];
  console.log(`  Agent : ${agent.full_name}  (${agent.phone})`);
  console.log(`  ID    : ${agent.id}`);
  console.log(`  Roles : ${agent.roles.join(", ")}`);

  // ── Resolve location ───────────────────────────────────────────────────────

  const p = spec.property;
  const centroid = await resolveVillageCentroid({
    adminDistrict: p.admin_district,
    adminSector: p.admin_sector,
    adminCell: p.admin_cell,
    adminVillage: p.admin_village,
  });
  const locationSource = p.pin_lat != null ? "pin_derived" : "admin_unit";
  const name = displayName({
    assetType: p.asset_type,
    bedrooms: p.bedrooms,
    adminVillage: p.admin_village,
    adminSector: p.admin_sector,
    adminDistrict: p.admin_district,
  });

  const hasProfile =
    p.bedrooms != null ||
    p.bathrooms != null ||
    p.interior_area_sqm != null ||
    p.year_built != null;

  console.log(`\n  Property`);
  console.log(`    Name     : ${name}`);
  console.log(`    Type     : ${PROPERTY_TYPE_LABELS[p.asset_type]}`);
  console.log(
    `    Location : ${[p.admin_village, p.admin_cell, p.admin_sector, p.admin_district].filter(Boolean).join(", ")}`,
  );
  if (centroid) {
    console.log(
      `    Anchor   : ${centroid.centroid_lat.toFixed(6)}, ${centroid.centroid_lon.toFixed(6)}`,
    );
  } else {
    console.log(`    Anchor   : ⚠ no centroid found — pin will be null`);
  }
  if (hasProfile) {
    const parts = [];
    if (p.bedrooms != null) parts.push(`${p.bedrooms} bed`);
    if (p.bathrooms != null) parts.push(`${p.bathrooms} bath`);
    if (p.interior_area_sqm != null) parts.push(`${p.interior_area_sqm} sqm`);
    if (p.year_built != null) parts.push(`built ${p.year_built}`);
    console.log(`    Profile  : ${parts.join(" · ")}`);
  }

  console.log(`\n  Listing`);
  console.log(`    Type       : ${spec.marketing_type}`);
  console.log(
    `    Price      : ${spec.asking_price_rwf != null ? `${Number(spec.asking_price_rwf).toLocaleString()} RWF` : "not set"}`,
  );
  console.log(`    Visibility : ${spec.visibility ?? "public"}`);
  console.log(`    Activate   : ${spec.activate ? "yes" : "no (will remain draft)"}`);
  if (spec.description) {
    console.log(`    Description: ${spec.description.slice(0, 80)}${spec.description.length > 80 ? "…" : ""}`);
  }

  // ── Validate photo paths ───────────────────────────────────────────────────

  const photoPaths = (spec.photos ?? []).map((rel) => resolve(listingDir, rel));
  const missing = photoPaths.filter((fp) => !existsSync(fp));
  if (missing.length > 0) {
    throw new Error(`Missing photo files:\n  ${missing.join("\n  ")}`);
  }
  console.log(`\n  Photos : ${photoPaths.length} file(s)`);
  for (const fp of photoPaths) console.log(`    ${fp}`);

  if (dryRun) {
    console.log("\n✅ Dry run complete — no changes made.\n");
    await pool.end();
    return;
  }

  // ── Create property_asset + profile + listing ──────────────────────────────

  const assetId = genAssetId();
  const assetPublicId = genPublicId();
  const assetDisplayCode = genDisplayCode();
  const listingId = genListingId();

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
      ) VALUES ($1, NULL, $2, $3, $4, FALSE, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                'script_import_v1')`,
      [
        assetId,
        p.asset_type,
        assetPublicId,
        assetDisplayCode,
        locationSource,
        name,
        p.admin_district,
        p.admin_sector ?? null,
        p.admin_cell ?? null,
        p.admin_village ?? null,
        centroid?.centroid_lat ?? null,
        centroid?.centroid_lon ?? null,
        p.pin_lat ?? null,
        p.pin_lon ?? null,
      ],
    );
    console.log(`\n  ✓ property_asset  : ${assetPublicId}  (${assetDisplayCode})`);

    if (hasProfile) {
      await client.query(
        `INSERT INTO property_asset_profile (
          property_asset_id, created_by_user_id, property_type,
          bedrooms, bathrooms, interior_area_sqm, year_built,
          seed_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'script_import_v1')`,
        [
          assetId,
          agent.id,
          PROPERTY_TYPE_LABELS[p.asset_type],
          p.bedrooms ?? null,
          p.bathrooms ?? null,
          p.interior_area_sqm ?? null,
          p.year_built ?? null,
        ],
      );
      console.log(`  ✓ property_asset_profile`);
    }

    await client.query(
      `INSERT INTO listing (
        id, parcel_id, property_asset_id, agency_id, agent_user_id,
        status, marketing_type, visibility, currency,
        asking_price_rwf, description, seed_source
      ) VALUES ($1, NULL, $2, $3, $4, 'draft', $5, $6, 'RWF', $7, $8, 'script_import_v1')`,
      [
        listingId,
        assetId,
        spec.agency_id ?? null,
        agent.id,
        spec.marketing_type,
        spec.visibility ?? "public",
        spec.asking_price_rwf ?? null,
        spec.description ?? null,
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

  // ── Upload photos ──────────────────────────────────────────────────────────

  if (photoPaths.length > 0) {
    console.log(`\n  Uploading photos...`);

    for (let i = 0; i < photoPaths.length; i++) {
      const photoPath = photoPaths[i];
      const baseName = photoPath.split("/").pop() ?? `photo-${i + 1}.jpg`;
      const contentType = contentTypeFromPath(photoPath);
      const intent = createUploadIntent({
        listingId,
        userId: agent.id,
        contentType,
        fileName: baseName,
      });

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
        `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next_order
         FROM listing_image WHERE listing_id = $1`,
        [listingId],
      );
      const sortOrder = Number(orderResult.rows[0]?.next_order ?? i);
      const imageId = genImageId();

      await pool.query(
        `INSERT INTO listing_image (
          id, listing_id, sort_order, image_url, storage_key,
          content_type, width, height, file_size_bytes,
          uploaded_by_user_id, status, seed_source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', 'script_import_v1')`,
        [
          imageId,
          listingId,
          sortOrder,
          uploaded.imageUrl,
          uploaded.storageKey,
          uploaded.contentType ?? contentType,
          uploaded.width ?? null,
          uploaded.height ?? null,
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
      console.log(
        `\n  ⚠ asking_price_rwf is null — listing left as draft. Set a price and activate manually.`,
      );
    } else {
      await pool.query(
        `UPDATE listing
         SET status = 'active', published_at = NOW(), asking_price_rwf = $2
         WHERE id = $1`,
        [listingId, spec.asking_price_rwf],
      );
      await pool.query(
        `INSERT INTO listing_price_history
           (id, listing_id, price_rwf, changed_by_user_id, campaign_index)
         VALUES ($1, $2, $3, $4, 1)`,
        [genPriceHistoryId(), listingId, spec.asking_price_rwf, agent.id],
      );
      console.log(
        `\n  ✓ Activated at ${Number(spec.asking_price_rwf).toLocaleString()} RWF`,
      );
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Property page : /property/${assetPublicId}`);
  console.log(`   Listing ID    : ${listingId}\n`);

  await pool.end();
}

run().catch((err) => {
  console.error("\n❌", err.message);
  pool.end().catch(() => undefined);
  process.exit(1);
});
