import { NextResponse } from "next/server";

import { findPropertyIdByUpi } from "@/lib/server/parcels";
import { isDatabaseUrlMissingError } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upi = searchParams.get("upi")?.trim();

  if (!upi) {
    return NextResponse.json({ error: "Missing upi parameter." }, { status: 400 });
  }

  try {
    const propertyId = await findPropertyIdByUpi(upi);

    return NextResponse.json({
      propertyId: propertyId ?? null,
    });
  } catch (error) {
    if (isDatabaseUrlMissingError(error)) {
      return NextResponse.json(
        { error: "Property lookup is unavailable because the database is not configured." },
        { status: 503 },
      );
    }

    throw error;
  }
}
