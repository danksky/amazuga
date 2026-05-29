import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

// Supabase sends a webhook with an HMAC-SHA256 signature in x-supabase-signature.
// The secret is v1,whsec_<hex> — we verify against the raw hex portion.
function verifyHmac(body: string, signatureHeader: string | null): boolean {
  const secret = process.env.SUPABASE_HOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  // Supabase sends: "v1,<hmac_hex>"
  const [, receivedHex] = signatureHeader.split(",");
  if (!receivedHex) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(receivedHex, "hex"));
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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-supabase-signature");

  if (!verifyHmac(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { phone } = payload.user;
  const { otp } = payload.sms;
  const message = `Your Amazuga verification code is: ${otp}`;

  try {
    await sendViaAfricasTalking(phone, message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-sms hook]", err);
    return NextResponse.json({ error: "SMS send failed" }, { status: 500 });
  }
}
