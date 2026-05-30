import { Webhook, WebhookVerificationError } from "standardwebhooks";
import { NextRequest, NextResponse } from "next/server";

// Supabase signs hook requests using Standard Webhooks (https://www.standardwebhooks.com).
// SUPABASE_HOOK_SECRET must be in whsec_<base64> format — set it to the value
// provided when configuring the hook in Supabase (strip the leading "v1," if present).

interface HookPayload {
  user: { phone: string };
  sms: { otp: string };
}

async function sendViaAfricasTalking(to: string, message: string): Promise<void> {
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
}

async function sendViaTelnyx(to: string, message: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY!;
  const from = process.env.TELNYX_PHONE_NUMBER!;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, text: message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telnyx error ${res.status}: ${text}`);
  }
}

export async function POST(request: NextRequest) {
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

  try {
    if (phone.startsWith("+1")) {
      await sendViaTelnyx(phone, message);
    } else {
      await sendViaAfricasTalking(phone, message);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-sms hook]", err);
    return NextResponse.json({ error: "SMS send failed" }, { status: 500 });
  }
}
