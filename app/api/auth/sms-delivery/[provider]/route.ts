import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { getLogger, scheduleLogFlush } from "@/lib/logger";
import { recordSmsDelivery, type SmsProvider } from "@/lib/server/sms-attempts";

const routeLogger = getLogger("api/auth/sms-delivery");
const TELNYX_TIMESTAMP_TOLERANCE_SECONDS = 300;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

type RouteContext = {
  params: Promise<{ provider: string }>;
};

interface TelnyxWebhookPayload {
  data?: {
    id?: string;
    event_type?: string;
    occurred_at?: string;
    payload?: {
      id?: string;
      record_type?: string;
      direction?: string;
      to?: Array<{
        phone_number?: string;
        status?: string;
      }>;
      errors?: Array<{
        code?: string;
        title?: string;
        detail?: string;
      }>;
    };
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseFormOrJson(rawBody: string, contentType: string) {
  if (contentType.includes("application/json") || rawBody.trimStart().startsWith("{")) {
    return toRecord(JSON.parse(rawBody));
  }

  const params = new URLSearchParams(rawBody);
  return Object.fromEntries(params.entries());
}

function normalizeProvider(value: string): SmsProvider | null {
  if (value === "africas-talking" || value === "africas_talking") {
    return "africas_talking";
  }
  if (value === "telnyx") {
    return "telnyx";
  }
  return null;
}

function safeString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

function verifySharedSecret(request: NextRequest) {
  const expected = process.env.SMS_DELIVERY_CALLBACK_SECRET?.trim();
  if (!expected) {
    return true;
  }

  const supplied =
    request.headers.get("x-amazuga-callback-secret") ??
    request.nextUrl.searchParams.get("secret") ??
    "";

  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function publicKeyObject(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN PUBLIC KEY")) {
    return crypto.createPublicKey(trimmed);
  }

  const raw = /^[0-9a-f]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (raw.length !== 32) {
    throw new Error("TELNYX_PUBLIC_KEY must be PEM, 32-byte hex, or 32-byte base64.");
  }

  return crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, raw]),
    format: "der",
    type: "spki",
  });
}

function verifyTelnyxSignature(request: NextRequest, rawBody: string) {
  const publicKey = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return verifySharedSecret(request);
  }

  const signature = request.headers.get("telnyx-signature-ed25519");
  const timestamp = request.headers.get("telnyx-timestamp");
  if (!signature || !timestamp) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > TELNYX_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  return crypto.verify(
    null,
    Buffer.from(`${timestamp}|${rawBody}`),
    publicKeyObject(publicKey),
    Buffer.from(signature, "base64"),
  );
}

function extractAfricasTalkingDelivery(payload: Record<string, unknown>) {
  const providerMessageId =
    safeString(payload.id) ??
    safeString(payload.messageId) ??
    safeString(payload.message_id);
  const phoneE164 =
    safeString(payload.phoneNumber) ??
    safeString(payload.phone_number) ??
    safeString(payload.number) ??
    safeString(payload.to);
  const status = safeString(payload.status);
  const statusCode = safeString(payload.statusCode) ?? safeString(payload.status_code);
  const errorDetail =
    safeString(payload.failureReason) ??
    safeString(payload.failure_reason) ??
    safeString(payload.errorMessage) ??
    safeString(payload.error_message);

  return {
    providerMessageId,
    phoneE164,
    deliveryStatus: status,
    deliveryStatusCode: statusCode,
    errorCode: statusCode,
    errorDetail,
  };
}

function extractTelnyxDelivery(payload: TelnyxWebhookPayload) {
  const message = payload.data?.payload;
  const recipient = message?.to?.[0];
  const error = message?.errors?.[0];

  return {
    providerMessageId: message?.id,
    phoneE164: recipient?.phone_number,
    deliveryStatus: recipient?.status,
    deliveryStatusCode: error?.code,
    errorCode: error?.code,
    errorDetail: error?.detail ?? error?.title,
    eventType: payload.data?.event_type,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  scheduleLogFlush(routeLogger);

  const { provider: rawProvider } = await context.params;
  const provider = normalizeProvider(rawProvider);
  if (!provider) {
    return NextResponse.json({ error: "Unknown SMS provider" }, { status: 404 });
  }

  const rawBody = await request.text();

  if (provider === "telnyx" && !verifyTelnyxSignature(request, rawBody)) {
    routeLogger.warn("Rejected Telnyx delivery callback signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (provider === "africas_talking" && !verifySharedSecret(request)) {
    routeLogger.warn("Rejected Africa's Talking delivery callback secret");
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const parsed = parseFormOrJson(rawBody, contentType);

    const delivery =
      provider === "telnyx"
        ? extractTelnyxDelivery(parsed as TelnyxWebhookPayload)
        : extractAfricasTalkingDelivery(parsed);

    const result = await recordSmsDelivery({
      provider,
      payload: parsed,
      ...delivery,
    });

    routeLogger.info("SMS delivery callback received", {
      provider,
      matchedAttempt: result.matched,
      ...delivery,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    routeLogger.error("SMS delivery callback failed", { error, provider });
    return NextResponse.json({ error: "Callback failed" }, { status: 500 });
  }
}
