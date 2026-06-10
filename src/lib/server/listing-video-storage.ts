import "server-only";

import { createHmac, randomUUID } from "node:crypto";

const DEFAULT_MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const DEFAULT_DELETE_TIMEOUT_MS = 10_000;

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function createSignedToken(payload: Record<string, unknown>, secret: string) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function getListingVideoUploadConfig() {
  const uploadUrl = getRequiredEnv("LISTING_VIDEO_UPLOAD_URL");
  const publicBaseUrl = getRequiredEnv("LISTING_VIDEOS_PUBLIC_BASE_URL");
  const signingSecret = getRequiredEnv("LISTING_VIDEO_UPLOAD_SECRET");

  return {
    uploadUrl,
    publicBaseUrl,
    signingSecret,
    maxVideoBytes: Number(process.env.LISTING_VIDEO_MAX_BYTES || DEFAULT_MAX_VIDEO_BYTES),
  };
}

export function isListingVideoUploadConfigured() {
  const config = getListingVideoUploadConfig();
  return Boolean(config.uploadUrl && config.publicBaseUrl && config.signingSecret);
}

export function createListingVideoUploadIntent(input: {
  listingId: string;
  userId: string;
  contentType: string;
  fileName: string;
}) {
  const config = getListingVideoUploadConfig();

  if (!config.uploadUrl || !config.publicBaseUrl || !config.signingSecret) {
    throw new Error("Listing video upload is not configured");
  }

  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId: input.listingId,
    userId: input.userId,
    contentType: input.contentType,
    fileName: input.fileName,
    maxBytes: config.maxVideoBytes,
    exp: Date.now() + 15 * 60 * 1000,
  };

  return {
    token: createSignedToken(payload, config.signingSecret),
    uploadUrl: config.uploadUrl,
    maxVideoBytes: config.maxVideoBytes,
    publicBaseUrl: config.publicBaseUrl,
  };
}

export function createListingVideoDeleteIntent(input: {
  listingId: string;
  videoId: string;
  storageKey: string;
  userId: string;
}) {
  const config = getListingVideoUploadConfig();

  if (!config.uploadUrl || !config.signingSecret) {
    throw new Error("Listing video upload is not configured");
  }

  const payload = {
    version: 1,
    op: "delete",
    intentId: randomUUID(),
    listingId: input.listingId,
    videoId: input.videoId,
    storageKey: input.storageKey,
    userId: input.userId,
    exp: Date.now() + 10 * 60 * 1000,
  };

  return {
    token: createSignedToken(payload, config.signingSecret),
    uploadUrl: config.uploadUrl,
  };
}

export async function deleteListingVideoFromStorage(input: {
  listingId: string;
  videoId: string;
  storageKey: string;
  userId: string;
}) {
  const config = getListingVideoUploadConfig();

  if (!config.uploadUrl || !config.signingSecret) {
    throw new Error("Listing video upload is not configured");
  }

  const intent = createListingVideoDeleteIntent(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_DELETE_TIMEOUT_MS);

  try {
    const response = await fetch(config.uploadUrl, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: intent.token }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let details = `${response.status} ${response.statusText}`;
      try {
        const data = (await response.json()) as { error?: string };
        if (data?.error) details = data.error;
      } catch { /* ignore */ }
      throw new Error(`Listing video storage delete failed: ${details}`);
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Listing video storage delete timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
