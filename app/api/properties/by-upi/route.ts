import { NextResponse } from "next/server";

import { findPropertyIdByUpi } from "@/lib/server/parcels";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upi = searchParams.get("upi")?.trim();

  if (!upi) {
    return NextResponse.json({ error: "Missing upi parameter." }, { status: 400 });
  }

  const propertyId = await findPropertyIdByUpi(upi);

  return NextResponse.json({
    propertyId: propertyId ?? null,
  });
}
