import "server-only";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_MAX_VIDEO_BYTES = 30 * 1024 * 1024;

interface CloudflareApiResponse<T> {
  result?: T;
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
}

interface StreamVideoResult {
  duration?: number;
  meta?: Record<string, unknown>;
  readyToStream?: boolean;
  status?: {
    errorReasonText?: string;
    state?: string;
  };
}

function getStreamConfig() {
  return {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim(),
  };
}

async function streamApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { accountId, apiToken } = getStreamConfig();

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream is not configured");
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as CloudflareApiResponse<T> | null;

  if (!response.ok || !payload?.success || payload.result === undefined) {
    const details = payload?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(`Cloudflare Stream request failed: ${details || `${response.status} ${response.statusText}`}`);
  }

  return payload.result;
}

export const MAX_STREAM_VIDEO_BYTES = DEFAULT_MAX_VIDEO_BYTES;

export function isCloudflareStreamConfigured() {
  const config = getStreamConfig();
  return Boolean(config.accountId && config.apiToken);
}

export async function createStreamDirectUpload(
  listingId: string,
): Promise<{ uid: string; uploadURL: string }> {
  return streamApiRequest<{ uid: string; uploadURL: string }>("/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: 300,
      requireSignedURLs: false,
      meta: { listingId },
    }),
  });
}

export async function deleteStreamVideo(uid: string): Promise<void> {
  await streamApiRequest<Record<string, never>>(`/${encodeURIComponent(uid)}`, {
    method: "DELETE",
  });
}

export function streamIframeUrl(uid: string): string {
  return `https://iframe.videodelivery.net/${encodeURIComponent(uid)}?muted=true&controls=true&playsinline=true`;
}

export function streamThumbnailUrl(uid: string, time?: string): string {
  const baseUrl = `https://videodelivery.net/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg`;
  return time ? `${baseUrl}?time=${encodeURIComponent(time)}` : baseUrl;
}

export function streamHlsUrl(uid: string): string {
  return `https://videodelivery.net/${encodeURIComponent(uid)}/manifest/video.m3u8`;
}

export async function getStreamVideo(uid: string): Promise<{
  readyToStream: boolean;
  duration: number | null;
  listingId: string | null;
  status: string | null;
  errorReason: string | null;
}> {
  const result = await streamApiRequest<StreamVideoResult>(`/${encodeURIComponent(uid)}`);
  const duration = typeof result.duration === "number" && result.duration >= 0
    ? result.duration
    : null;

  return {
    readyToStream: result.readyToStream === true,
    duration,
    listingId: typeof result.meta?.listingId === "string" ? result.meta.listingId : null,
    status: result.status?.state || null,
    errorReason: result.status?.errorReasonText || null,
  };
}
