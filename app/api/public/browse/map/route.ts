import { NextResponse } from "next/server";

import { getBrowseMapData } from "@/lib/server/browse-map";
import { isDatabaseUrlMissingError } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

// Pad the visible viewport so the client can pan within the cached area
// before a refetch is needed. 0.3 = 30% on each side.
const PAD_FACTOR = 0.3;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("mode");
  const bboxParam = searchParams.get("bbox");

  if (!mode || (mode !== "sale" && mode !== "rent")) {
    return NextResponse.json({ error: "mode must be sale or rent" }, { status: 400 });
  }

  if (!bboxParam) {
    return NextResponse.json({ error: "bbox is required" }, { status: 400 });
  }

  const parts = bboxParam.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json(
      { error: "bbox must be minLng,minLat,maxLng,maxLat" },
      { status: 400 },
    );
  }

  const [minLng, minLat, maxLng, maxLat] = parts;

  const lngPad = (maxLng - minLng) * PAD_FACTOR;
  const latPad = (maxLat - minLat) * PAD_FACTOR;

  try {
    const result = await getBrowseMapData({
      mode,
      minLng: minLng - lngPad,
      minLat: minLat - latPad,
      maxLng: maxLng + lngPad,
      maxLat: maxLat + latPad,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (isDatabaseUrlMissingError(error)) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 },
      );
    }
    throw error;
  }
}
