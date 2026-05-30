import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Supabase uses Svix-style webhook signing:
//   Header:  Webhook-Signature: v1,<base64_hmac>
//   Signed:  "{Webhook-Id}.{Webhook-Timestamp}.{body}"
//   Key:     raw SUPABASE_HOOK_SECRET bytes (the hex string itself, not decoded)
function verifyHmac(request: NextRequest, body: string): boolean {
  const secret = process.env.SUPABASE_HOOK_SECRET;
  const signatureHeader = request.headers.get("webhook-signature");
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");

  if (!secret || !signatureHeader || !webhookId || !webhookTimestamp) return false;

  const [, receivedB64] = signatureHeader.split(",");
  if (!receivedB64) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const expected = createHmac("sha256", Buffer.from(secret))
    .update(signedContent)
    .digest("base64");

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(receivedB64));
  } catch {
    return false;
  }
}

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

  if (!verifyHmac(request, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
