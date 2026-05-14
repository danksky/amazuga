const DEFAULT_MAX_RANGE_BYTES = 16 * 1024 * 1024;

function readAllowedOrigins(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return rawValue
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
}

function readPublicPath(rawValue) {
  if (!rawValue || rawValue === "/") {
    return "/";
  }

  return rawValue.startsWith("/") ? rawValue : `/${rawValue}`;
}

function buildCorsHeaders(origin) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Range, If-None-Match, If-Modified-Since");
  headers.set(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Cache-Control, Content-Length, Content-Range, Content-Type, ETag, Last-Modified",
  );
  headers.set("Access-Control-Max-Age", "3600");
  headers.set("Vary", "Origin");
  return headers;
}

function isOriginAllowed(origin, allowedOrigins) {
  return Boolean(origin) && allowedOrigins.includes(origin);
}

function parseRange(rangeHeader, maxRangeBytes) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) {
    return { error: "A single byte range is required." };
  }

  const spec = rangeHeader.slice("bytes=".length).trim();
  if (!spec || spec.includes(",")) {
    return { error: "Multiple byte ranges are not supported." };
  }

  if (spec.startsWith("-")) {
    const suffix = Number.parseInt(spec.slice(1), 10);
    if (!Number.isInteger(suffix) || suffix <= 0) {
      return { error: "Invalid suffix byte range." };
    }
    if (suffix > maxRangeBytes) {
      return { error: `Requested range exceeds ${maxRangeBytes} bytes.` };
    }
    return { kind: "suffix", suffix };
  }

  const [startRaw, endRaw] = spec.split("-", 2);
  const start = Number.parseInt(startRaw, 10);
  if (!Number.isInteger(start) || start < 0) {
    return { error: "Invalid byte range start." };
  }

  if (!endRaw) {
    return { kind: "open", start };
  }

  const end = Number.parseInt(endRaw, 10);
  if (!Number.isInteger(end) || end < start) {
    return { error: "Invalid byte range end." };
  }

  if (end - start + 1 > maxRangeBytes) {
    return { error: `Requested range exceeds ${maxRangeBytes} bytes.` };
  }

  return { kind: "bounded", start, end };
}

function resolveContentRange(parsedRange, objectSize, maxRangeBytes) {
  if (parsedRange.kind === "suffix") {
    const length = Math.min(parsedRange.suffix, objectSize);
    const start = Math.max(objectSize - length, 0);
    return { start, end: objectSize - 1 };
  }

  if (parsedRange.kind === "open") {
    const end = Math.min(parsedRange.start + maxRangeBytes - 1, objectSize - 1);
    return { start: parsedRange.start, end };
  }

  return {
    start: parsedRange.start,
    end: Math.min(parsedRange.end, objectSize - 1),
  };
}

function respond(status, body, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  return new Response(body, { status, headers });
}

function buildRateLimitKey(request) {
  const ipAddress =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "unknown";
  const url = new URL(request.url);
  return `${ipAddress}:${url.pathname}`;
}

export default {
  async fetch(request, env) {
    const allowedOrigins = readAllowedOrigins(env.ALLOWED_ORIGINS);
    const publicPath = readPublicPath(env.PUBLIC_PATH);
    const maxRangeBytes = Number.parseInt(env.MAX_RANGE_BYTES || "", 10) || DEFAULT_MAX_RANGE_BYTES;
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (url.pathname !== publicPath) {
      return respond(404, "Not found.");
    }

    if (request.method === "OPTIONS") {
      if (!isOriginAllowed(origin, allowedOrigins)) {
        return respond(403, "Origin not allowed.");
      }

      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin),
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return respond(405, "Method not allowed.", { Allow: "GET, HEAD, OPTIONS" });
    }

    if (!isOriginAllowed(origin, allowedOrigins)) {
      return respond(403, "Origin not allowed.");
    }

    const { success } = await env.TILE_RATE_LIMITER.limit({
      key: buildRateLimitKey(request),
    });
    if (!success) {
      const headers = isOriginAllowed(origin, allowedOrigins)
        ? buildCorsHeaders(origin)
        : new Headers();
      headers.set("Retry-After", String(env.RATE_LIMIT_PERIOD_SECONDS || 60));
      return new Response("Too many requests.", {
        status: 429,
        headers,
      });
    }

    if (request.method === "HEAD") {
      const object = await env.PARCEL_BUCKET.head(env.OBJECT_KEY);
      if (!object) {
        return respond(404, "Not found.");
      }

      const headers = buildCorsHeaders(origin);
      object.writeHttpMetadata(headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      headers.set("Content-Length", String(object.size));
      headers.set("ETag", object.httpEtag);
      return new Response(null, { status: 200, headers });
    }

    const parsedRange = parseRange(request.headers.get("Range"), maxRangeBytes);
    if ("error" in parsedRange) {
      return respond(416, parsedRange.error, { "Content-Range": "bytes */*" });
    }

    const object = await env.PARCEL_BUCKET.get(env.OBJECT_KEY, {
      range: request.headers,
    });

    if (!object || !("body" in object) || !object.body) {
      return respond(404, "Not found.");
    }

    const contentRange = resolveContentRange(parsedRange, object.size, maxRangeBytes);
    const headers = buildCorsHeaders(origin);
    object.writeHttpMetadata(headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    headers.set("Content-Length", String(contentRange.end - contentRange.start + 1));
    headers.set("Content-Range", `bytes ${contentRange.start}-${contentRange.end}/${object.size}`);
    headers.set("ETag", object.httpEtag);

    return new Response(object.body, {
      status: 206,
      headers,
    });
  },
};
