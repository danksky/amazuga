#!/usr/bin/env node
/**
 * backfill-agency-logos.mjs
 *
 * Uploads logo images for specific agencies and writes the resulting URL into
 * agency.logo_url. Run against the preview DB first.
 *
 * Run against preview:
 *   node --env-file=.env.local --env-file=.env.infra.local scripts/backfill-agency-logos.mjs
 *
 * Run against production (set DATABASE_URL manually):
 *   DATABASE_URL=<prod_url> node --env-file=.env.local scripts/backfill-agency-logos.mjs
 *
 * Safe to re-run — skips agencies that already have a logo_url.
 */

import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import pg from "pg";

const { Pool } = pg;

// ---------- config ----------

const DATABASE_URL = process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL;
const UPLOAD_URL = process.env.LISTING_IMAGE_UPLOAD_URL;
const UPLOAD_SECRET = process.env.LISTING_IMAGE_UPLOAD_SECRET;

if (!DATABASE_URL) { console.error("No DATABASE_URL or DATABASE_URL_PREVIEW set"); process.exit(1); }
if (!UPLOAD_URL || !UPLOAD_SECRET) { console.error("LISTING_IMAGE_UPLOAD_URL / LISTING_IMAGE_UPLOAD_SECRET not set"); process.exit(1); }

// Map agency slug → absolute path to logo file.
const LOGOS = [
  { slug: "nicolas-real-estate", filePath: "/Users/danielkawalsky/Downloads/nicolas-real-estate-rwanda-logo.png" },
  { slug: "green-real-estate", filePath: "/Users/danielkawalsky/Downloads/green-real-estate-rwanda-logo.png" },
];

const pool = new Pool({ connectionString: DATABASE_URL });

// ---------- upload ----------

async function uploadLogo(agencyId, filePath) {
  const fileBuffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const fileName = `logo${ext}`;

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
    throw new Error(`Upload failed for ${agencyId}: ${res.status} ${body}`);
  }

  const data = await res.json();
  if (!data.imageUrl) throw new Error(`No imageUrl in response for ${agencyId}`);
  return data.imageUrl;
}

// ---------- main ----------

async function run() {
  for (const { slug, filePath } of LOGOS) {
    console.log(`\nProcessing: ${slug}`);

    const agencyResult = await pool.query(
      `SELECT id, logo_url FROM agency WHERE slug = $1 AND status = 'approved' LIMIT 1`,
      [slug],
    );
    const agency = agencyResult.rows[0];

    if (!agency) {
      console.log(`  ⚠  Agency not found or not approved: ${slug}`);
      continue;
    }

    if (agency.logo_url) {
      console.log(`  ✓  Already has logo_url — skipping`);
      continue;
    }

    let fileExists = true;
    try { await fs.access(filePath); } catch { fileExists = false; }

    if (!fileExists) {
      console.log(`  ⚠  File not found: ${filePath}`);
      continue;
    }

    console.log(`  Uploading ${filePath}…`);
    const logoUrl = await uploadLogo(agency.id, filePath);
    console.log(`  Uploaded → ${logoUrl}`);

    await pool.query(
      `UPDATE agency SET logo_url = $1, updated_at = NOW() WHERE id = $2`,
      [logoUrl, agency.id],
    );
    console.log(`  ✓  Updated agency.logo_url`);
  }

  await pool.end();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  pool.end().catch(() => {});
  process.exit(1);
});
