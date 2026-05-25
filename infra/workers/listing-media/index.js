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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const listingMediaWorker = {
  async fetch(request, env) {
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
    }

    if (!getAllowedOrigin(request, env)) {
      return json({ error: "Origin not allowed." }, { status: 403, headers: corsHeaders });
    }

    if (!env.LISTING_MEDIA_BUCKET || !env.PUBLIC_BASE_URL || !env.UPLOAD_SHARED_SECRET) {
      return json({ error: "Worker is not configured." }, { status: 500, headers: corsHeaders });
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

    if (file.type !== "image/jpeg" || payload.contentType !== "image/jpeg") {
      return json({ error: "Listing photo uploads must arrive as JPEG files." }, { status: 400, headers: corsHeaders });
    }

    if (typeof payload.maxBytes === "number" && file.size > payload.maxBytes) {
      return json({ error: "Processed upload exceeded the maximum allowed size." }, { status: 400, headers: corsHeaders });
    }

    const imageId = crypto.randomUUID();
    const storageKey = `listing-images/${payload.listingId}/${imageId}/gallery.jpg`;
    await env.LISTING_MEDIA_BUCKET.put(storageKey, file.stream(), {
      httpMetadata: {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
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
