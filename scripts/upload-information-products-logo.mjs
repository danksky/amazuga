#!/usr/bin/env node
/**
 * upload-agency-logo.mjs
 *
 * Uploads a logo image for a specific agency to Cloudflare R2 and writes the
 * resulting URL into agency.logo_url. Safe to re-run — skips if logo_url is
 * already set.
 *
 * Usage:
 *   AGENCY_SLUG=my-agency FILE_PATH=/path/to/logo.png \
 *     node --env-file=.env.local --env-file=.env.infra.local \
 *     scripts/upload-information-products-logo.mjs
 *
 * Targets preview DB by default (DATABASE_URL_PREVIEW). Pass DATABASE_URL
 * directly to target production:
 *   DATABASE_URL=<prod_url> AGENCY_SLUG=... FILE_PATH=... node ...
 */

import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";

import pg from "pg";
import sharp from "sharp";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL;
const UPLOAD_URL = process.env.LISTING_IMAGE_UPLOAD_URL;
const UPLOAD_SECRET = process.env.LISTING_IMAGE_UPLOAD_SECRET;
const AGENCY_SLUG = process.env.AGENCY_SLUG;
const FILE_PATH = process.env.FILE_PATH;

if (!DATABASE_URL) { console.error("No DATABASE_URL_PREVIEW or DATABASE_URL set"); process.exit(1); }
if (!UPLOAD_URL || !UPLOAD_SECRET) { console.error("LISTING_IMAGE_UPLOAD_URL / LISTING_IMAGE_UPLOAD_SECRET not set"); process.exit(1); }
if (!AGENCY_SLUG) { console.error("AGENCY_SLUG not set"); process.exit(1); }
if (!FILE_PATH) { console.error("FILE_PATH not set"); process.exit(1); }

const pool = new Pool({ connectionString: DATABASE_URL });

async function uploadLogo(agencyId, filePath) {
  const raw = await fs.readFile(filePath);
  const fileBuffer = await sharp(raw).jpeg({ quality: 92 }).toBuffer();
  const contentType = "image/jpeg";
  const fileName = "logo.jpg";

  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId: `agency-logos/${agencyId}`,
    userId: "system",
    contentType,
    fileName,
    maxBytes: 4 * 1024 * 1024,
    exp: Date.now() + 10 * 60 * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", UPLOAD_SECRET).update(encodedPayload).digest("base64url");
  const token = `${encodedPayload}.${signature}`;

  const uploadHost = new URL(UPLOAD_URL).hostname;
  const origin = `https://${uploadHost.split(".").slice(-2).join(".")}`;

  const form = new FormData();
  form.append("token", token);
  form.append("file", new Blob([fileBuffer], { type: contentType }), fileName);

  const res = await fetch(UPLOAD_URL, { method: "POST", body: form, headers: { Origin: origin } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!data.imageUrl) throw new Error(`No imageUrl in response`);
  return data.imageUrl;
}

async function run() {
  const agencyResult = await pool.query(
    `SELECT id, logo_url FROM agency WHERE slug = $1 AND status = 'approved' LIMIT 1`,
    [AGENCY_SLUG],
  );
  const agency = agencyResult.rows[0];

  if (!agency) { console.error(`Agency not found or not approved: ${AGENCY_SLUG}`); process.exit(1); }
  if (agency.logo_url) { console.log(`Already has logo_url — skipping: ${agency.logo_url}`); process.exit(0); }

  console.log(`Uploading ${FILE_PATH} for agency ${agency.id}…`);
  const logoUrl = await uploadLogo(agency.id, FILE_PATH);
  console.log(`Uploaded → ${logoUrl}`);

  await pool.query(`UPDATE agency SET logo_url = $1, updated_at = NOW() WHERE id = $2`, [logoUrl, agency.id]);
  console.log(`Updated agency.logo_url ✓`);

  await pool.end();
}

run().catch((err) => {
  console.error(err);
  pool.end().catch(() => {});
  process.exit(1);
});
