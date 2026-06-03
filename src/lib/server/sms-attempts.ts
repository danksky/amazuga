import "server-only";

import crypto from "node:crypto";

import { getPgPool } from "./postgres";

export type SmsProvider = "africas_talking" | "telnyx";

export interface CreateSmsAttemptInput {
  provider: SmsProvider;
  phoneE164: string;
  phoneMasked: string;
  otp: string;
  requestPayload?: Record<string, unknown>;
}

export interface MarkSmsAttemptSentInput {
  id: string;
  providerMessageId?: string | null;
  initialStatus?: string | null;
  initialStatusCode?: string | number | null;
  responsePayload?: Record<string, unknown>;
}

export interface MarkSmsAttemptFailedInput {
  id?: string;
  provider: SmsProvider;
  phoneE164: string;
  deliveryStatus?: string | null;
  deliveryStatusCode?: string | number | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  responsePayload?: Record<string, unknown>;
}

export interface RecordSmsDeliveryInput {
  provider: SmsProvider;
  providerMessageId?: string | null;
  phoneE164?: string | null;
  deliveryStatus?: string | null;
  deliveryStatusCode?: string | number | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  eventType?: string | null;
  payload: Record<string, unknown>;
}

function resolveEnvironment() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") {
    return "production";
  }
  if (vercelEnv === "preview") {
    return "preview";
  }
  if (process.env.NODE_ENV === "development") {
    return "development";
  }
  return "unknown";
}

function otpFingerprint(otp: string) {
  const salt = process.env.SUPABASE_HOOK_SECRET ?? process.env.SMS_DELIVERY_CALLBACK_SECRET ?? "amazuga";
  return crypto.createHash("sha256").update(`${salt}:${otp}`).digest("hex").slice(0, 16);
}

function asJson(value: Record<string, unknown> | undefined) {
  return JSON.stringify(value ?? {});
}

function asText(value: string | number | null | undefined) {
  return value == null ? null : String(value);
}

export function createCorrelationId() {
  return crypto.randomUUID();
}

export async function createSmsAttempt(input: CreateSmsAttemptInput) {
  const id = crypto.randomUUID();
  const correlationId = createCorrelationId();

  try {
    await getPgPool().query(
      `
        INSERT INTO auth_sms_attempt (
          id,
          environment,
          provider,
          phone_e164,
          phone_masked,
          otp_fingerprint,
          correlation_id,
          provider_request_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        id,
        resolveEnvironment(),
        input.provider,
        input.phoneE164,
        input.phoneMasked,
        otpFingerprint(input.otp),
        correlationId,
        asJson(input.requestPayload),
      ],
    );
  } catch (error) {
    return { id, correlationId, persisted: false, error };
  }

  return { id, correlationId, persisted: true, error: null };
}

export async function markSmsAttemptSent(input: MarkSmsAttemptSentInput) {
  await getPgPool().query(
    `
      UPDATE auth_sms_attempt
      SET
        provider_message_id = COALESCE($2, provider_message_id),
        initial_status = COALESCE($3, initial_status),
        initial_status_code = COALESCE($4, initial_status_code),
        provider_response_payload = $5::jsonb,
        sent_at = COALESCE(sent_at, NOW()),
        updated_at = NOW()
      WHERE id = $1
    `,
    [
      input.id,
      input.providerMessageId ?? null,
      input.initialStatus ?? null,
      asText(input.initialStatusCode),
      asJson(input.responsePayload),
    ],
  );
}

export async function markSmsAttemptFailed(input: MarkSmsAttemptFailedInput) {
  if (input.id) {
    await getPgPool().query(
      `
        UPDATE auth_sms_attempt
        SET
          initial_status = COALESCE($2, initial_status),
          initial_status_code = COALESCE($3, initial_status_code),
          delivery_status = COALESCE($2, delivery_status),
          delivery_status_code = COALESCE($3, delivery_status_code),
          delivery_error_code = COALESCE($4, delivery_error_code),
          delivery_error_detail = COALESCE($5, delivery_error_detail),
          provider_response_payload = $6::jsonb,
          failed_at = COALESCE(failed_at, NOW()),
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        input.id,
        input.deliveryStatus ?? null,
        asText(input.deliveryStatusCode),
        input.errorCode ?? null,
        input.errorDetail ?? null,
        asJson(input.responsePayload),
      ],
    );
    return;
  }

  await getPgPool().query(
    `
      INSERT INTO auth_sms_attempt (
        environment,
        provider,
        phone_e164,
        phone_masked,
        correlation_id,
        initial_status,
        initial_status_code,
        delivery_status,
        delivery_status_code,
        delivery_error_code,
        delivery_error_detail,
        provider_response_payload,
        failed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $7, $8, $9, $10::jsonb, NOW())
    `,
    [
      resolveEnvironment(),
      input.provider,
      input.phoneE164,
      input.phoneE164.replace(/(\+\d{3})\d+(\d{4})$/, "$1***$2"),
      createCorrelationId(),
      input.deliveryStatus ?? null,
      asText(input.deliveryStatusCode),
      input.errorCode ?? null,
      input.errorDetail ?? null,
      asJson(input.responsePayload),
    ],
  );
}

function isDeliveredStatus(status: string | null | undefined) {
  return status === "delivered";
}

function isFailedStatus(status: string | null | undefined) {
  return Boolean(status && /failed|failure|rejected|undeliverable/i.test(status));
}

export async function recordSmsDelivery(input: RecordSmsDeliveryInput) {
  const status = input.deliveryStatus ?? null;
  const deliveredAt = isDeliveredStatus(status) ? "NOW()" : "delivered_at";
  const failedAt = isFailedStatus(status) ? "NOW()" : "failed_at";

  const result = await getPgPool().query(
    `
      UPDATE auth_sms_attempt
      SET
        delivery_status = COALESCE($3, delivery_status),
        delivery_status_code = COALESCE($4, delivery_status_code),
        delivery_error_code = COALESCE($5, delivery_error_code),
        delivery_error_detail = COALESCE($6, delivery_error_detail),
        delivery_event_type = COALESCE($7, delivery_event_type),
        delivery_payload = $8::jsonb,
        delivered_at = ${deliveredAt},
        failed_at = ${failedAt},
        updated_at = NOW()
      WHERE provider = $1
        AND provider_message_id = $2
        AND $2 IS NOT NULL
    `,
    [
      input.provider,
      input.providerMessageId ?? null,
      status,
      asText(input.deliveryStatusCode),
      input.errorCode ?? null,
      input.errorDetail ?? null,
      input.eventType ?? null,
      asJson(input.payload),
    ],
  );

  if ((result.rowCount ?? 0) > 0) {
    return { matched: true };
  }

  await getPgPool().query(
    `
      INSERT INTO auth_sms_attempt (
        environment,
        provider,
        phone_e164,
        phone_masked,
        correlation_id,
        provider_message_id,
        delivery_status,
        delivery_status_code,
        delivery_error_code,
        delivery_error_detail,
        delivery_event_type,
        delivery_payload,
        delivered_at,
        failed_at
      )
      VALUES (
        $1, $2, COALESCE($3, 'unknown'), COALESCE($4, 'unknown'), $5, $6, $7, $8, $9, $10, $11, $12::jsonb,
        CASE WHEN $13 THEN NOW() ELSE NULL END,
        CASE WHEN $14 THEN NOW() ELSE NULL END
      )
    `,
    [
      resolveEnvironment(),
      input.provider,
      input.phoneE164 ?? null,
      input.phoneE164 ? input.phoneE164.replace(/(\+\d{3})\d+(\d{4})$/, "$1***$2") : null,
      createCorrelationId(),
      input.providerMessageId ?? null,
      status,
      asText(input.deliveryStatusCode),
      input.errorCode ?? null,
      input.errorDetail ?? null,
      input.eventType ?? null,
      asJson(input.payload),
      isDeliveredStatus(status),
      isFailedStatus(status),
    ],
  );

  return { matched: false };
}
