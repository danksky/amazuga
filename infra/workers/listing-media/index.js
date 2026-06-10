function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

function getAllowedOrigin(request, env) {
  const requestOrigin = request.headers.get("Origin");
  if (!requestOrigin) {
    return null;
  }

  try {
    const allowedOrigins = JSON.parse(env.ALLOWED_ORIGINS || "[]");
    if (!Array.isArray(allowedOrigins)) {
      return null;
    }

    const originUrl = new URL(requestOrigin);
    const isAllowed = allowedOrigins.some((candidate) => {
      if (typeof candidate !== "string" || !candidate) {
        return false;
      }

      if (candidate.startsWith(".")) {
        return originUrl.protocol === "https:" && originUrl.hostname.endsWith(candidate);
      }

      if (candidate.startsWith("*.")) {
        const suffix = candidate.slice(1);
        return originUrl.protocol === "https:" && originUrl.hostname.endsWith(suffix);
      }

      return candidate === requestOrigin;
    });

    return isAllowed ? requestOrigin : null;
  } catch {
    return null;
  }
}

function buildCorsHeaders(request, env) {
  const allowedOrigin = getAllowedOrigin(request, env);

  if (!allowedOrigin) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

function toBase64UrlFromUint8Array(value) {
  let binary = "";
  for (const item of value) {
    binary += String.fromCharCode(item);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeBase64Url(value) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return atob(padded);
}

async function verifyToken(token, env) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".", 2);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.UPLOAD_SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expectedSignature = toBase64UrlFromUint8Array(new Uint8Array(signed));

  if (normalizeBase64Url(signature) !== expectedSignature) {
    return null;
  }

  try {
    const payloadJson = JSON.parse(decodeBase64Url(payload));
    if (!payloadJson || typeof payloadJson !== "object") {
      return null;
    }

    if (typeof payloadJson.exp !== "number" || payloadJson.exp < Date.now()) {
      return null;
    }

    return payloadJson;
  } catch {
    return null;
  }
}

function buildPublicUrl(env, storageKey) {
  return `${env.PUBLIC_BASE_URL.replace(/\/+$/, "")}/${storageKey}`;
}

// Server-to-server read endpoint for private agent ID photos.
// Called by the Next.js admin proxy route; never exposed to browsers.
async function handleAdminRead(request, env) {
  if (!env.AGENT_ID_PHOTOS_BUCKET || !env.ADMIN_READ_SECRET) {
    return json({ error: "Admin read is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${env.ADMIN_READ_SECRET}`) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const ADMIN_READ_PREFIX = "/admin-read/";
  const key = url.pathname.startsWith(ADMIN_READ_PREFIX)
    ? url.pathname.slice(ADMIN_READ_PREFIX.length)
    : null;

  if (!key) {
    return json({ error: "Missing object key." }, { status: 400 });
  }

  const object = await env.AGENT_ID_PHOTOS_BUCKET.get(key);
  if (!object) {
    return json({ error: "Not found." }, { status: 404 });
  }

  return new Response(object.body, {
    status: 200,
    headers: {
      "content-type": object.httpMetadata?.contentType || "image/jpeg",
      "cache-control": "private, no-store",
      "content-length": String(object.size),
    },
  });
}

const AGENT_ID_PHOTO_LISTING_ID = "agent-id-photos";

const listingMediaWorker = {
  async fetch(request, env) {
    // Admin read: server-to-server only, no CORS involved.
    if (request.method === "GET") {
      return handleAdminRead(request, env);
    }

    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST" && request.method !== "DELETE") {
      return json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
    }

    if (!env.LISTING_MEDIA_BUCKET || !env.AGENT_ID_PHOTOS_BUCKET || !env.PUBLIC_BASE_URL || !env.UPLOAD_SHARED_SECRET) {
      return json({ error: "Worker is not configured." }, { status: 500, headers: corsHeaders });
    }

    if (request.method === "DELETE") {
      const payloadJson = await request.json().catch(() => null);
      const payload = await verifyToken(typeof payloadJson?.token === "string" ? payloadJson.token : "", env);

      if (!payload) {
        return json({ error: "Delete token is invalid or expired." }, { status: 401, headers: corsHeaders });
      }

      if (payload.op !== "delete" || typeof payload.storageKey !== "string" || !payload.storageKey) {
        return json({ error: "Delete token payload is invalid." }, { status: 400, headers: corsHeaders });
      }

      // Route delete to the correct bucket based on the storage key prefix.
      const isAgentIdPhoto = payload.storageKey.startsWith(`${AGENT_ID_PHOTO_LISTING_ID}/`);
      const bucket = isAgentIdPhoto ? env.AGENT_ID_PHOTOS_BUCKET : env.LISTING_MEDIA_BUCKET;
      await bucket.delete(payload.storageKey);

      if (!isAgentIdPhoto && env.CLOUDFLARE_ZONE_ID && env.CLOUDFLARE_API_TOKEN) {
        const publicUrl = buildPublicUrl(env, payload.storageKey);
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/purge_cache`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ files: [publicUrl] }),
          },
        ).catch(() => undefined);
      }

      return json(
        {
          deleted: true,
          storageKey: payload.storageKey,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    if (!getAllowedOrigin(request, env)) {
      return json({ error: "Origin not allowed." }, { status: 403, headers: corsHeaders });
    }

    const formData = await request.formData().catch(() => null);
    const token = formData?.get("token");
    const file = formData?.get("file");
    const width = formData?.get("width");
    const height = formData?.get("height");

    if (!(file instanceof File)) {
      return json({ error: "Missing file upload." }, { status: 400, headers: corsHeaders });
    }

    const payload = await verifyToken(typeof token === "string" ? token : "", env);
    if (!payload) {
      return json({ error: "Upload token is invalid or expired." }, { status: 401, headers: corsHeaders });
    }

    const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg"]);
    const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);
    const isVideoUpload = ALLOWED_VIDEO_TYPES.has(payload.contentType);
    const isImageUpload = ALLOWED_IMAGE_TYPES.has(payload.contentType);

    if (!isImageUpload && !isVideoUpload) {
      return json({ error: "Unsupported file type." }, { status: 400, headers: corsHeaders });
    }

    if (isImageUpload && file.type !== "image/jpeg") {
      return json({ error: "Listing photo uploads must arrive as JPEG files." }, { status: 400, headers: corsHeaders });
    }

    if (isVideoUpload && !ALLOWED_VIDEO_TYPES.has(file.type)) {
      return json({ error: "Unsupported video type." }, { status: 400, headers: corsHeaders });
    }

    if (typeof payload.maxBytes === "number" && file.size > payload.maxBytes) {
      return json({ error: "Upload exceeded the maximum allowed size." }, { status: 400, headers: corsHeaders });
    }

    const mediaId = crypto.randomUUID();

    // Agent ID photos — private bucket, no public URL.
    const isAgentIdPhoto = payload.listingId === AGENT_ID_PHOTO_LISTING_ID;
    if (isAgentIdPhoto) {
      const storageKey = `${AGENT_ID_PHOTO_LISTING_ID}/${mediaId}/gallery.jpg`;
      await env.AGENT_ID_PHOTOS_BUCKET.put(storageKey, file.stream(), {
        httpMetadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
        },
        customMetadata: {
          userId: String(payload.userId),
          intentId: String(payload.intentId),
        },
      });

      return json(
        { storageKey },
        { status: 201, headers: corsHeaders },
      );
    }

    if (isVideoUpload) {
      const ext = payload.contentType === "video/quicktime" ? "mov" : payload.contentType === "video/webm" ? "webm" : "mp4";
      const storageKey = `listing-videos/${payload.listingId}/${mediaId}/video.${ext}`;
      await env.LISTING_MEDIA_BUCKET.put(storageKey, file.stream(), {
        httpMetadata: {
          contentType: payload.contentType,
          cacheControl: "public, max-age=86400",
        },
        customMetadata: {
          listingId: String(payload.listingId),
          userId: String(payload.userId),
          intentId: String(payload.intentId),
        },
      });

      return json(
        {
          videoUrl: buildPublicUrl(env, storageKey),
          storageKey,
          contentType: payload.contentType,
          fileSizeBytes: file.size,
        },
        { status: 201, headers: corsHeaders },
      );
    }

    // Listing photos — public bucket.
    const storageKey = `listing-images/${payload.listingId}/${mediaId}/gallery.jpg`;
    await env.LISTING_MEDIA_BUCKET.put(storageKey, file.stream(), {
      httpMetadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=86400",
      },
      customMetadata: {
        listingId: String(payload.listingId),
        userId: String(payload.userId),
        intentId: String(payload.intentId),
      },
    });

    return json(
      {
        imageUrl: buildPublicUrl(env, storageKey),
        storageKey,
        width: typeof width === "string" ? Number(width) || undefined : undefined,
        height: typeof height === "string" ? Number(height) || undefined : undefined,
        contentType: "image/jpeg",
        fileSizeBytes: file.size,
      },
      {
        status: 201,
        headers: corsHeaders,
      },
    );
  },
};

export default listingMediaWorker;
