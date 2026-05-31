import "server-only";

import { createHmac, randomUUID } from "node:crypto";

// ID photos are uploaded to the same listing media bucket and worker,
// scoped under the "agent-id-photos" path prefix instead of a listing ID.
// The storage key becomes: listing-images/agent-id-photos/{imageId}/gallery.jpg
// Files are publicly accessible via media.amazuga.com but URLs are UUID-based
// and unguessable — acceptable for MVP.

const AGENT_ID_PHOTO_CONTEXT = "agent-id-photos";
const MAX_ID_PHOTO_BYTES = 8 * 1024 * 1024;

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

export function isAgentIdPhotoUploadConfigured() {
  return Boolean(
    getRequiredEnv("LISTING_IMAGE_UPLOAD_URL") &&
    getRequiredEnv("LISTING_IMAGES_PUBLIC_BASE_URL") &&
    getRequiredEnv("LISTING_IMAGE_UPLOAD_SECRET"),
  );
}

export function createAgentIdPhotoUploadIntent(userId: string) {
  const uploadUrl = getRequiredEnv("LISTING_IMAGE_UPLOAD_URL");
  const publicBaseUrl = getRequiredEnv("LISTING_IMAGES_PUBLIC_BASE_URL");
  const signingSecret = getRequiredEnv("LISTING_IMAGE_UPLOAD_SECRET");

  if (!uploadUrl || !publicBaseUrl || !signingSecret) {
    throw new Error("Agent ID photo upload is not configured.");
  }

  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId: AGENT_ID_PHOTO_CONTEXT,
    userId,
    contentType: "image/jpeg",
    fileName: "id-photo.jpg",
    maxBytes: MAX_ID_PHOTO_BYTES,
    exp: Date.now() + 15 * 60 * 1000, // 15 min — longer than listing photos
  };

  return {
    token: createSignedToken(payload, signingSecret),
    uploadUrl,
    maxBytes: MAX_ID_PHOTO_BYTES,
  };
}
