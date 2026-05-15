import "server-only";

import fs from "node:fs";
import path from "node:path";

import { Pool } from "pg";

const MISSING_DATABASE_URL_ERROR =
  "DATABASE_URL or DATABASE_URL_PREVIEW must be set for server-side parcel queries.";

function isRemoteRuntime() {
  return Boolean(process.env.VERCEL || process.env.CI === "true");
}

function selectPreferredUrl(values: { databaseUrl?: string; previewDatabaseUrl?: string }) {
  if (isRemoteRuntime()) {
    return values.databaseUrl || values.previewDatabaseUrl;
  }

  return values.previewDatabaseUrl || values.databaseUrl;
}

function readLocalInfraDatabaseUrl() {
  if (isRemoteRuntime()) {
    return undefined;
  }

  try {
    const envPath = path.join(process.cwd(), ".env.infra.local");
    if (!fs.existsSync(envPath)) {
      return undefined;
    }

    const contents = fs.readFileSync(envPath, "utf8");
    const values = new Map<string, string>();

    for (const rawLine of contents.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }

      const equalsIndex = line.indexOf("=");
      if (equalsIndex <= 0) {
        continue;
      }

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values.set(key, value);
    }

    return selectPreferredUrl({
      databaseUrl: values.get("DATABASE_URL"),
      previewDatabaseUrl: values.get("DATABASE_URL_PREVIEW"),
    });
  } catch {
    return undefined;
  }
}

declare global {
  var __amazugaPgPool: Pool | undefined;
}

function resolveConnectionString() {
  return (
    selectPreferredUrl({
      databaseUrl: process.env.DATABASE_URL,
      previewDatabaseUrl: process.env.DATABASE_URL_PREVIEW,
    }) || readLocalInfraDatabaseUrl()
  );
}

export function getPgPool() {
  if (global.__amazugaPgPool) {
    return global.__amazugaPgPool;
  }

  const connectionString = resolveConnectionString();
  if (!connectionString) {
    throw new Error(MISSING_DATABASE_URL_ERROR);
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });

  if (process.env.NODE_ENV !== "production") {
    global.__amazugaPgPool = pool;
  }

  return pool;
}

export function isDatabaseUrlMissingError(error: unknown) {
  return error instanceof Error && error.message === MISSING_DATABASE_URL_ERROR;
}
