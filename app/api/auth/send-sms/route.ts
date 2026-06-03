import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { NextRequest, NextResponse } from "next/server";
import { getLogger, scheduleLogFlush } from "@/lib/logger";
import {
  createSmsAttempt,
  markSmsAttemptFailed,
  markSmsAttemptSent,
  type SmsProvider,
} from "@/lib/server/sms-attempts";

// Supabase signs hook requests using Standard Webhooks (https://www.standardwebhooks.com).
// SUPABASE_HOOK_SECRET must be in whsec_<base64> format — set it to the value
// provided when configuring the hook in Supabase (strip the leading "v1," if present).

interface HookPayload {
  user: { phone: string };
  sms: { otp: string };
}

const routeLogger = getLogger("api/auth/send-sms");

interface AfricasTalkingRecipient {
  cost?: string;
  messageId?: string;
  number?: string;
  status?: string;
  statusCode?: number;
}

interface AfricasTalkingResponse {
  SMSMessageData?: {
    Message?: string;
    Recipients?: AfricasTalkingRecipient[];
  };
}

interface SendResult {
  messageId?: string | null;
  status?: string | null;
  statusCode?: string | number | null;
  responsePayload?: Record<string, unknown>;
}

interface TelnyxResponse {
  data?: {
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
}

function maskPhone(value: string) {
  return value.replace(/(\+\d{3})\d+(\d{4})$/, "$1***$2");
}

async function sendViaAfricasTalking(to: string, message: string): Promise<SendResult> {
  const sandbox = process.env.AFRICAS_TALKING_SANDBOX === "true";
  const apiKey = process.env.AFRICAS_TALKING_API_KEY!;
  const username = process.env.AFRICAS_TALKING_USERNAME ?? "sandbox";
  const url = sandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  const body = new URLSearchParams({ username, to, message });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Africa's Talking error ${res.status}: ${text}`);
  }

  const responseText = await res.text();
  let data: AfricasTalkingResponse | null = null;

  try {
    data = JSON.parse(responseText) as AfricasTalkingResponse;
  } catch {
    routeLogger.warn("Africa's Talking returned non-JSON response", {
      httpStatus: res.status,
      to: maskPhone(to),
    });
  }

  const recipient = data?.SMSMessageData?.Recipients?.[0];
  const providerStatus = recipient?.status;
  const providerStatusCode = recipient?.statusCode;
  const responsePayload = data ? (data as Record<string, unknown>) : { raw: responseText };

  routeLogger.info("Africa's Talking response", {
    to: maskPhone(to),
    messageId: recipient?.messageId,
    status: providerStatus,
    statusCode: providerStatusCode,
  });

  if (!recipient || providerStatus !== "Success") {
    throw new Error(
      `Africa's Talking recipient status ${providerStatus ?? "unknown"} (${providerStatusCode ?? "unknown"}) for ${maskPhone(to)}`,
    );
  }

  return {
    messageId: recipient.messageId,
    status: providerStatus,
    statusCode: providerStatusCode,
    responsePayload,
  };
}

async function sendViaTelnyx(to: string, message: string): Promise<SendResult> {
  const apiKey = process.env.TELNYX_API_KEY!;
  const from = process.env.TELNYX_PHONE_NUMBER!;
  const webhookUrl = process.env.TELNYX_DELIVERY_WEBHOOK_URL?.trim();
  const payload: Record<string, unknown> = { from, to, text: message };
  if (webhookUrl) {
    payload.webhook_url = webhookUrl;
  }

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`Telnyx error ${res.status}: ${responseText}`);
  }

  let data: TelnyxResponse | null = null;
  try {
    data = JSON.parse(responseText) as TelnyxResponse;
  } catch {
    routeLogger.warn("Telnyx returned non-JSON response", {
      httpStatus: res.status,
      to: maskPhone(to),
    });
  }

  const recipient = data?.data?.to?.[0];
  routeLogger.info("Telnyx response", {
    to: maskPhone(to),
    messageId: data?.data?.id,
    status: recipient?.status,
    httpStatus: res.status,
  });

  return {
    messageId: data?.data?.id,
    status: recipient?.status ?? String(res.status),
    statusCode: res.status,
    responsePayload: data ? (data as Record<string, unknown>) : { raw: responseText },
  };
}

export async function POST(request: NextRequest) {
  scheduleLogFlush(routeLogger);

  const rawBody = await request.text();

  const secret = process.env.SUPABASE_HOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Hook secret not configured" }, { status: 500 });
  }

  // Strip "v1," prefix if present (Supabase sometimes includes it in the env value)
  const webhookSecret = secret.startsWith("v1,") ? secret.slice(3) : secret;

  try {
    const wh = new Webhook(webhookSecret);
    wh.verify(rawBody, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    throw err;
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone: rawPhone } = payload.user;
  const { otp } = payload.sms;
  // Supabase omits the leading + in hook payloads — normalise to E.164
  const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;
  const message = `Your Amazuga verification code is: ${otp}`;
  const provider: SmsProvider = phone.startsWith("+1") ? "telnyx" : "africas_talking";
  const attempt = await createSmsAttempt({
    provider,
    phoneE164: phone,
    phoneMasked: maskPhone(phone),
    otp,
    requestPayload: { provider, phone: maskPhone(phone) },
  });

  if (!attempt.persisted) {
    routeLogger.warn("SMS attempt persistence failed before send", {
      error: attempt.error,
      correlationId: attempt.correlationId,
      provider,
      to: maskPhone(phone),
    });
  }

  try {
    routeLogger.info("Sending OTP SMS", {
      correlationId: attempt.correlationId,
      provider,
      to: maskPhone(phone),
    });

    const result =
      provider === "telnyx"
        ? await sendViaTelnyx(phone, message)
        : await sendViaAfricasTalking(phone, message);

    if (attempt.persisted) {
      await markSmsAttemptSent({
        id: attempt.id,
        providerMessageId: result.messageId,
        initialStatus: result.status,
        initialStatusCode: result.statusCode,
        responsePayload: result.responsePayload,
      }).catch((error: unknown) => {
        routeLogger.warn("SMS attempt persistence failed after send", {
          error,
          correlationId: attempt.correlationId,
          provider,
          to: maskPhone(phone),
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    await markSmsAttemptFailed({
      id: attempt.persisted ? attempt.id : undefined,
      provider,
      phoneE164: phone,
      deliveryStatus: "send_failed",
      errorDetail: err instanceof Error ? err.message : String(err),
      responsePayload: { error: err instanceof Error ? err.message : String(err) },
    }).catch((error: unknown) => {
      routeLogger.warn("SMS attempt persistence failed after send failure", {
        error,
        correlationId: attempt.correlationId,
        provider,
        to: maskPhone(phone),
      });
    });

    routeLogger.error("SMS send failed", {
      correlationId: attempt.correlationId,
      error: err,
      provider,
      to: maskPhone(phone),
    });
    return NextResponse.json({ error: "SMS send failed" }, { status: 500 });
  }
}
