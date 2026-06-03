-- Migration: 0005_auth_sms_attempts
-- Adds provider-neutral SMS attempt tracking for OTP delivery diagnostics.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth_sms_attempt (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment                TEXT NOT NULL DEFAULT 'unknown'
                               CHECK (environment IN ('production', 'preview', 'development', 'unknown')),
  provider                   TEXT NOT NULL CHECK (provider IN ('africas_talking', 'telnyx')),
  purpose                    TEXT NOT NULL DEFAULT 'otp',
  phone_e164                 TEXT NOT NULL,
  phone_masked               TEXT NOT NULL,
  otp_fingerprint            TEXT,
  correlation_id             TEXT NOT NULL UNIQUE,
  provider_message_id        TEXT,
  initial_status             TEXT,
  initial_status_code        TEXT,
  delivery_status            TEXT,
  delivery_status_code       TEXT,
  delivery_error_code        TEXT,
  delivery_error_detail      TEXT,
  delivery_event_type        TEXT,
  provider_request_payload   JSONB NOT NULL DEFAULT '{}'::JSONB,
  provider_response_payload  JSONB NOT NULL DEFAULT '{}'::JSONB,
  delivery_payload           JSONB NOT NULL DEFAULT '{}'::JSONB,
  sent_at                    TIMESTAMPTZ,
  delivered_at               TIMESTAMPTZ,
  failed_at                  TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sms_attempt_provider_message_id_idx
  ON auth_sms_attempt (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS auth_sms_attempt_phone_created_at_idx
  ON auth_sms_attempt (phone_e164, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_sms_attempt_created_at_idx
  ON auth_sms_attempt (created_at DESC);

COMMENT ON TABLE auth_sms_attempt IS
'Provider-neutral audit trail for OTP SMS send attempts and delivery receipts.';

