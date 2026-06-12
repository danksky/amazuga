#!/usr/bin/env node
/**
 * backfill-og-images.mjs
 *
 * Generates and stores branded OG images for all listings that have at least
 * one ready image but no og_image_url yet.
 *
 * Run against preview:
 *   node --env-file=.env.local --env-file=.env.infra.local scripts/backfill-og-images.mjs
 *
 * Run against production (set DATABASE_URL manually):
 *   DATABASE_URL=<prod_url> node --env-file=.env.local scripts/backfill-og-images.mjs
 *
 * Processes 3 listings concurrently. Safe to re-run — skips rows with an
 * existing og_image_url.
 */

import pg from "pg";

import { buildOgImageBuffer, storeOgImage } from "./og-image-generator.mjs";

const { Pool } = pg;

// ---------- config ----------

const DATABASE_URL = process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL;
const UPLOAD_URL = process.env.LISTING_IMAGE_UPLOAD_URL;
const UPLOAD_SECRET = process.env.LISTING_IMAGE_UPLOAD_SECRET;
const CONCURRENCY = 3;

if (!DATABASE_URL) { console.error("No DATABASE_URL or DATABASE_URL_PREVIEW set"); process.exit(1); }
if (!UPLOAD_URL || !UPLOAD_SECRET) { console.error("LISTING_IMAGE_UPLOAD_URL / LISTING_IMAGE_UPLOAD_SECRET not set"); process.exit(1); }

// ---------- DB queries ----------

async function fetchListingsNeedingOg(pool) {
  const { rows } = await pool.query(`
    SELECT
      l.id AS listing_id,
      l.asking_price_rwf,
      l.marketing_type,
      COALESCE(
        NULLIF(BTRIM(pap.property_type), ''),
        CASE pa.asset_type
          WHEN 'house'               THEN 'House'
          WHEN 'apartment_unit'      THEN 'Apartment'
          WHEN 'apartment_building'  THEN 'Apartment'
          WHEN 'land'                THEN 'Land'
          WHEN 'commercial_building' THEN 'Commercial'
          WHEN 'commercial_unit'     THEN 'Commercial'
          ELSE 'Property'
        END
      ) AS property_type,
      pap.bedrooms,
      pap.bathrooms,
      pap.interior_area_sqm,
      ARRAY(
        SELECT image_url FROM listing_image
        WHERE listing_id = l.id AND status = 'ready'
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 3
      ) AS image_urls
    FROM listing l
    JOIN property_asset pa ON pa.id = l.property_asset_id
    LEFT JOIN property_asset_profile pap ON pap.property_asset_id = pa.id
    WHERE l.og_image_url IS NULL
      AND EXISTS (
        SELECT 1 FROM listing_image
        WHERE listing_id = l.id AND status = 'ready'
      )
    ORDER BY l.updated_at DESC
  `);
  return rows;
}

async function saveOgImageUrl(pool, listingId, url) {
  await pool.query(
    `UPDATE listing SET og_image_url = $1, updated_at = NOW() WHERE id = $2`,
    [url, listingId],
  );
}

// ---------- processing ----------

async function downloadBuffer(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function processListing(pool, row, index, total) {
  const { listing_id, asking_price_rwf, marketing_type, property_type, bedrooms, bathrooms, interior_area_sqm, image_urls } = row;
  const label = `[${index + 1}/${total}] ${listing_id}`;

  try {
    const priceRwf = Number(asking_price_rwf);
    if (!isFinite(priceRwf) || priceRwf <= 0) {
      console.log(`${label} — skip (no valid price)`);
      return;
    }

    console.log(`${label} — generating (${image_urls.length} photos)…`);
    const photoBuffers = await Promise.all(image_urls.map(downloadBuffer));

    const jpegBuffer = await buildOgImageBuffer({
      photoBuffers,
      priceRwf,
      marketingType: marketing_type,
      propertyType: property_type ?? "Property",
      beds: bedrooms != null ? Number(bedrooms) : null,
      baths: bathrooms != null ? Number(bathrooms) : null,
      areaSqm: interior_area_sqm != null ? Number(interior_area_sqm) : null,
    });

    const imageUrl = await storeOgImage(listing_id, jpegBuffer, UPLOAD_URL, UPLOAD_SECRET);
    await saveOgImageUrl(pool, listing_id, imageUrl);
    console.log(`${label} — done: ${imageUrl}`);
  } catch (err) {
    console.error(`${label} — ERROR: ${err.message}`);
  }
}

// ---------- main ----------

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    const rows = await fetchListingsNeedingOg(pool);
    console.log(`Found ${rows.length} listings needing OG images.`);

    if (rows.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const batch = rows.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((row, j) => processListing(pool, row, i + j, rows.length)));
    }

    console.log("Backfill complete.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
