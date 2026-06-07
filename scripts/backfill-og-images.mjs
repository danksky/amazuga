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

import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";
import sharp from "sharp";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- config ----------

const DATABASE_URL = process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL;
const UPLOAD_URL = process.env.LISTING_IMAGE_UPLOAD_URL;
const UPLOAD_SECRET = process.env.LISTING_IMAGE_UPLOAD_SECRET;
const CONCURRENCY = 3;

if (!DATABASE_URL) { console.error("No DATABASE_URL or DATABASE_URL_PREVIEW set"); process.exit(1); }
if (!UPLOAD_URL || !UPLOAD_SECRET) { console.error("LISTING_IMAGE_UPLOAD_URL / LISTING_IMAGE_UPLOAD_SECRET not set"); process.exit(1); }

// ---------- canvas geometry ----------

const OG_W = 1200;
const OG_H = 630;
const GAP = 2;
const PRIMARY_RATIO = 1.45 / (1.45 + 0.85);

// ---------- image compositing ----------

async function coverCrop(input, w, h) {
  return sharp(input).resize(w, h, { fit: "cover", position: "centre" }).jpeg({ quality: 92 }).toBuffer();
}

async function buildCollage(photos) {
  if (photos.length === 1) return coverCrop(photos[0], OG_W, OG_H);

  const primaryW = Math.floor(OG_W * PRIMARY_RATIO);
  const secondaryX = primaryW + GAP;
  const secondaryW = OG_W - primaryW - GAP;
  const composites = [];

  const primary = await coverCrop(photos[0], primaryW, OG_H);
  composites.push({ input: primary, top: 0, left: 0 });

  if (photos.length === 2) {
    const sec = await coverCrop(photos[1], secondaryW, OG_H);
    composites.push({ input: sec, top: 0, left: secondaryX });
  } else {
    const halfH = Math.floor((OG_H - GAP) / 2);
    const bottomH = OG_H - halfH - GAP;
    const [sec1, sec2] = await Promise.all([
      coverCrop(photos[1], secondaryW, halfH),
      coverCrop(photos[2], secondaryW, bottomH),
    ]);
    composites.push(
      { input: sec1, top: 0, left: secondaryX },
      { input: sec2, top: halfH + GAP, left: secondaryX },
    );
    const hGap = await sharp({
      create: { width: secondaryW, height: GAP, channels: 4, background: { r: 229, g: 231, b: 235, alpha: 1 } },
    }).png().toBuffer();
    composites.push({ input: hGap, top: halfH, left: secondaryX });
  }

  const vGap = await sharp({
    create: { width: GAP, height: OG_H, channels: 4, background: { r: 229, g: 231, b: 235, alpha: 1 } },
  }).png().toBuffer();
  composites.push({ input: vGap, top: 0, left: primaryW });

  const base = await sharp({
    create: { width: OG_W, height: OG_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
  }).png().toBuffer();

  return sharp(base).composite(composites).png().toBuffer();
}

// ---------- SVG overlay ----------

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function approxW(text, size, weight = "400") {
  return text.length * size * (weight === "700" ? 0.62 : 0.55);
}

function buildOverlaySvg(priceLabel, factsLabel, propertyType, listingType) {
  const W = OG_W, H = OG_H, pad = 52;
  const stateLabel = listingType === "rent" ? "FOR RENT" : "FOR SALE";
  const BF = 22, BH = 35, BR = BH / 2, BD = 11, BPX = 20;

  const blueContentW = BPX + approxW(propertyType, BF, "700") + BPX;
  const bx = pad, by = pad;
  const blueTopRight = bx + blueContentW + BD;
  const blueBottomRight = bx + blueContentW;
  const yellowX = blueBottomRight;
  const yellowTopLeft = yellowX + BD;
  const yellowEndX = yellowTopLeft + approxW(stateLabel, BF, "700") + BPX * 2;

  const bluePath = [
    `M ${bx + BR} ${by}`,
    `L ${blueTopRight} ${by}`,
    `L ${blueBottomRight} ${by + BH}`,
    `L ${bx + BR} ${by + BH}`,
    `A ${BR} ${BR} 0 0 1 ${bx} ${by + BR}`,
    `A ${BR} ${BR} 0 0 1 ${bx + BR} ${by}`,
    "Z",
  ].join(" ");

  const yellowPath = [
    `M ${yellowTopLeft} ${by}`,
    `L ${yellowEndX - BR} ${by}`,
    `A ${BR} ${BR} 0 0 1 ${yellowEndX} ${by + BR}`,
    `L ${yellowEndX} ${by + BH - BR}`,
    `A ${BR} ${BR} 0 0 1 ${yellowEndX - BR} ${by + BH}`,
    `L ${yellowX} ${by + BH}`,
    "Z",
  ].join(" ");

  const priceY = by + BH + 16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="black" flood-opacity="0.5"/>
    </filter>
    <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.72)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.78)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H * 0.45}" fill="url(#tg)"/>
  <rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#bg)"/>
  <path d="${yellowPath}" fill="#fad201" stroke="none"/>
  <path d="${bluePath}" fill="#00a1de" stroke="none"/>
  <text x="${bx + BPX}" y="${by + BH / 2}"
    font-family="Helvetica Neue,Helvetica,Arial,sans-serif"
    font-size="${BF}" font-weight="700" fill="white" dominant-baseline="middle"
  >${escXml(propertyType.toUpperCase())}</text>
  <text x="${yellowTopLeft + BPX}" y="${by + BH / 2}"
    font-family="Helvetica Neue,Helvetica,Arial,sans-serif"
    font-size="${BF}" font-weight="700" fill="black" dominant-baseline="middle"
  >${escXml(stateLabel)}</text>
  <text x="${pad}" y="${priceY}"
    font-family="Helvetica Neue,Helvetica,Arial,sans-serif"
    font-size="58" font-weight="700" fill="white" dominant-baseline="hanging"
    filter="url(#sh)"
  >${escXml(priceLabel)}</text>
  <text x="${W - pad}" y="${pad}"
    font-family="Helvetica Neue,Helvetica,Arial,sans-serif"
    font-size="28" font-weight="500" fill="white"
    text-anchor="end" dominant-baseline="hanging"
    filter="url(#sh)"
  >${escXml(factsLabel)}</text>
</svg>`;
}

// ---------- label helpers ----------

function buildPriceLabel(priceRwf, marketingType) {
  const m = priceRwf / 1_000_000;
  const formatted = m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}B` : `${m}M`;
  return marketingType === "rent" ? `${formatted} RWF/mo` : `${formatted} RWF`;
}

function buildFactsLabel(beds, baths, areaSqm) {
  const parts = [];
  if (beds) parts.push(`${beds} bed${beds === 1 ? "" : "s"}`);
  if (baths) parts.push(`${baths} bath${baths === 1 ? "" : "s"}`);
  if (areaSqm) parts.push(`${Math.round(areaSqm)} m²`);
  return parts.join("  ·  ");
}

// ---------- main composite ----------

async function buildOgImageBuffer({ photoBuffers, priceRwf, marketingType, propertyType, beds, baths, areaSqm }) {
  const priceLabel = buildPriceLabel(priceRwf, marketingType);
  const factsLabel = buildFactsLabel(beds, baths, areaSqm);

  const logoPath = path.join(__dirname, "..", "public", "amazuga-logo-white.png");
  const logoRaw = await fs.readFile(logoPath);
  const logoMeta = await sharp(logoRaw).metadata();
  const logoH = 56;
  const logoW = Math.round((logoMeta.width ?? 200) * (logoH / (logoMeta.height ?? 56)));
  const logoBuf = await sharp(logoRaw).resize(logoW, logoH).png().toBuffer();

  const collageBuf = await buildCollage(photoBuffers);
  const svgBuf = Buffer.from(buildOverlaySvg(priceLabel, factsLabel, propertyType, marketingType));
  const pad = 52;

  return sharp(collageBuf)
    .composite([
      { input: svgBuf, top: 0, left: 0 },
      { input: logoBuf, top: OG_H - logoH - pad, left: pad },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

// ---------- Cloudflare Worker upload ----------

async function storeOgImage(listingId, pngBuffer) {
  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId,
    userId: "system",
    contentType: "image/jpeg",
    fileName: "og-image.jpg",
    maxBytes: 4 * 1024 * 1024,
    exp: Date.now() + 5 * 60 * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", UPLOAD_SECRET).update(encodedPayload).digest("base64url");
  const token = `${encodedPayload}.${signature}`;

  const uploadHost = new URL(UPLOAD_URL).hostname;
  const origin = `https://${uploadHost.split(".").slice(-2).join(".")}`;

  const form = new FormData();
  form.append("token", token);
  form.append("file", new Blob([pngBuffer], { type: "image/jpeg" }), "og-image.jpg");

  const res = await fetch(UPLOAD_URL, { method: "POST", body: form, headers: { Origin: origin } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!data.imageUrl) throw new Error("Upload returned no imageUrl");
  return data.imageUrl;
}

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

    const pngBuffer = await buildOgImageBuffer({
      photoBuffers,
      priceRwf,
      marketingType: marketing_type,
      propertyType: property_type ?? "Property",
      beds: bedrooms != null ? Number(bedrooms) : null,
      baths: bathrooms != null ? Number(bathrooms) : null,
      areaSqm: interior_area_sqm != null ? Number(interior_area_sqm) : null,
    });

    const imageUrl = await storeOgImage(listing_id, pngBuffer);
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
