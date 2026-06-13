#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Pool } from "pg";

import {
  copyVideoToStream,
  streamHlsUrl,
  streamThumbnailUrl,
  waitForStreamVideo,
} from "./cloudflare-stream.mjs";

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const result = {};

  for (const rawLine of readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const env = {
  ...parseEnvFile(join(projectRoot, ".env.infra.local")),
  ...parseEnvFile(join(projectRoot, ".env.local")),
  ...process.env,
};
const databaseUrl = env.DATABASE_URL_PREVIEW?.trim();
const streamConfig = {
  accountId: env.CLOUDFLARE_ACCOUNT_ID?.trim(),
  apiToken: env.CLOUDFLARE_STREAM_API_TOKEN?.trim(),
};

if (!databaseUrl) {
  throw new Error("DATABASE_URL_PREVIEW is required; this script never falls back to production");
}
if (!streamConfig.accountId || !streamConfig.apiToken) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN are required");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const result = await pool.query(`
    SELECT id, listing_id, video_url
    FROM listing_video
    WHERE stream_uid IS NULL
    ORDER BY created_at ASC, id ASC
  `);

  console.log(`Found ${result.rows.length} preview video(s) to migrate.`);

  for (const [index, row] of result.rows.entries()) {
    console.log(`[${index + 1}/${result.rows.length}] Copying listing ${row.listing_id}...`);

    const copied = await copyVideoToStream(streamConfig, row.video_url, row.listing_id);
    const uid = copied.uid;
    if (!uid) {
      throw new Error(`Cloudflare did not return a UID for listing ${row.listing_id}`);
    }

    const video = await waitForStreamVideo(streamConfig, uid);
    await pool.query(
      `
        UPDATE listing_video
        SET
          stream_uid = $1,
          video_url = $2,
          thumbnail_url = $3,
          duration_seconds = COALESCE($4, duration_seconds),
          updated_at = NOW()
        WHERE id = $5
          AND stream_uid IS NULL
      `,
      [
        uid,
        streamHlsUrl(uid),
        streamThumbnailUrl(uid),
        video.duration == null ? null : Math.round(video.duration),
        row.id,
      ],
    );

    console.log(`  ready: ${uid}`);
  }
}

try {
  await run();
} finally {
  await pool.end();
}
