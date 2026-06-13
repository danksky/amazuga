const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

async function streamApiRequest({ accountId, apiToken }, path, init = {}) {
  if (!accountId || !apiToken) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN are required");
  }

  const response = await fetch(
    `${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success || payload.result === undefined) {
    const details = payload?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ");
    throw new Error(`Cloudflare Stream request failed: ${details || `${response.status} ${response.statusText}`}`);
  }

  return payload.result;
}

export function streamHlsUrl(uid) {
  return `https://videodelivery.net/${encodeURIComponent(uid)}/manifest/video.m3u8`;
}

export function streamThumbnailUrl(uid, time = "2s") {
  return `https://videodelivery.net/${encodeURIComponent(uid)}/thumbnails/thumbnail.jpg?time=${encodeURIComponent(time)}`;
}

export async function createStreamDirectUpload(config, listingId) {
  return streamApiRequest(config, "/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: 300,
      requireSignedURLs: false,
      meta: { listingId },
    }),
  });
}

export async function copyVideoToStream(config, videoUrl, listingId) {
  return streamApiRequest(config, "/copy", {
    method: "POST",
    body: JSON.stringify({
      url: videoUrl,
      meta: { listingId },
      requireSignedURLs: false,
    }),
  });
}

export async function getStreamVideo(config, uid) {
  const result = await streamApiRequest(config, `/${encodeURIComponent(uid)}`);
  return {
    readyToStream: result.readyToStream === true,
    duration: typeof result.duration === "number" && result.duration >= 0
      ? result.duration
      : null,
    status: result.status?.state || null,
    errorReason: result.status?.errorReasonText || null,
  };
}

export async function waitForStreamVideo(config, uid, {
  intervalMs = 5_000,
  timeoutMs = 3 * 60_000,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const video = await getStreamVideo(config, uid);

    if (video.readyToStream) {
      return video;
    }
    if (video.status === "error") {
      throw new Error(video.errorReason || `Cloudflare Stream failed to process ${uid}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for Cloudflare Stream video ${uid}`);
}
