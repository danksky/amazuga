import "server-only";

import { createHmac, randomUUID } from "node:crypto";

const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_COUNT = 12;

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

export function getListingImageUploadConfig() {
  const uploadUrl = getRequiredEnv("LISTING_IMAGE_UPLOAD_URL");
  const publicBaseUrl = getRequiredEnv("LISTING_IMAGES_PUBLIC_BASE_URL");
  const signingSecret = getRequiredEnv("LISTING_IMAGE_UPLOAD_SECRET");

  return {
    uploadUrl,
    publicBaseUrl,
    signingSecret,
    maxImageBytes: Number(process.env.LISTING_IMAGE_MAX_BYTES || DEFAULT_MAX_IMAGE_BYTES),
    maxImageCount: Number(process.env.LISTING_IMAGE_MAX_COUNT || DEFAULT_MAX_IMAGE_COUNT),
  };
}

export function isListingImageUploadConfigured() {
  const config = getListingImageUploadConfig();
  return Boolean(config.uploadUrl && config.publicBaseUrl && config.signingSecret);
}

export function createListingImageUploadIntent(input: {
  listingId: string;
  userId: string;
  contentType: string;
  fileName: string;
}) {
  const config = getListingImageUploadConfig();

  if (!config.uploadUrl || !config.publicBaseUrl || !config.signingSecret) {
    throw new Error("Listing image upload is not configured");
  }

  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId: input.listingId,
    userId: input.userId,
    contentType: input.contentType,
    fileName: input.fileName,
    maxBytes: config.maxImageBytes,
    exp: Date.now() + 10 * 60 * 1000,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, config.signingSecret);

  return {
    token: `${encodedPayload}.${signature}`,
    uploadUrl: config.uploadUrl,
    maxImageBytes: config.maxImageBytes,
    publicBaseUrl: config.publicBaseUrl,
  };
}
