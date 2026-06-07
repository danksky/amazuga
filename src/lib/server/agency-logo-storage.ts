import "server-only";

import { createHmac, randomUUID } from "node:crypto";

// Agency logos are uploaded via the same listing-media worker used for listing images.
// The worker stores them in the public R2 bucket under agency-logos/{agencyId}/logo.jpg
// and returns a public media.amazuga.com URL that is stored in agency.logo_url.

const MAX_LOGO_BYTES = 4 * 1024 * 1024;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function isAgencyLogoUploadConfigured() {
  return Boolean(
    getRequiredEnv("LISTING_IMAGE_UPLOAD_URL") &&
    getRequiredEnv("LISTING_IMAGE_UPLOAD_SECRET") &&
    getRequiredEnv("LISTING_IMAGES_PUBLIC_BASE_URL"),
  );
}

export async function uploadAgencyLogo(agencyId: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  const uploadUrl = getRequiredEnv("LISTING_IMAGE_UPLOAD_URL");
  const signingSecret = getRequiredEnv("LISTING_IMAGE_UPLOAD_SECRET");

  if (!uploadUrl || !signingSecret) {
    throw new Error("Agency logo upload is not configured.");
  }

  const ext = contentType === "image/png" ? "png" : "jpg";
  const payload = {
    version: 1,
    intentId: randomUUID(),
    listingId: `agency-logos/${agencyId}`,
    userId: "system",
    contentType,
    fileName: `logo.${ext}`,
    maxBytes: MAX_LOGO_BYTES,
    exp: Date.now() + 10 * 60 * 1000,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", signingSecret).update(encodedPayload).digest("base64url");
  const token = `${encodedPayload}.${signature}`;

  const uploadHost = new URL(uploadUrl).hostname;
  const origin = `https://${uploadHost.split(".").slice(-2).join(".")}`;

  const form = new FormData();
  form.append("token", token);
  const ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
  form.append("file", new Blob([ab], { type: contentType }), `logo.${ext}`);

  const res = await fetch(uploadUrl, { method: "POST", body: form, headers: { Origin: origin } });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Agency logo upload failed: ${res.status} ${body}`);
  }

  const data = await res.json() as { imageUrl?: string };
  if (!data.imageUrl) throw new Error("Agency logo upload returned no imageUrl");
  return data.imageUrl;
}
