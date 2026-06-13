import { NextResponse } from "next/server";

import { getPgPool, isDatabaseUrlMissingError } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

interface LocationRow {
  level: "district" | "sector" | "cell" | "village";
  name: string;
  parent_name: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  bbox_min_lon: number | null;
  bbox_min_lat: number | null;
  bbox_max_lon: number | null;
  bbox_max_lat: number | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  // Split on first space: "Rubona Bur" → namePart="Rubona", contextPart="Bur"
  const spaceIdx = q.indexOf(" ");
  const namePart    = spaceIdx === -1 ? q : q.slice(0, spaceIdx);
  const contextPart = spaceIdx === -1 ? "" : q.slice(spaceIdx + 1).trim();

  if (namePart.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const result = await getPgPool().query<LocationRow>(
      `
      SELECT level, name, parent_name, district, sector, cell,
             bbox_min_lon, bbox_min_lat, bbox_max_lon, bbox_max_lat
      FROM browse_location_mv
      WHERE lower(name) LIKE lower($1) || '%'
        AND (
          $2 = ''
          OR lower(district)    LIKE lower($2) || '%'
          OR lower(sector)      LIKE lower($2) || '%'
          OR lower(cell)        LIKE lower($2) || '%'
          OR lower(parent_name) LIKE lower($2) || '%'
        )
      ORDER BY
        CASE level
          WHEN 'district' THEN 1
          WHEN 'sector'   THEN 2
          WHEN 'cell'     THEN 3
          WHEN 'village'  THEN 4
        END,
        parcel_count DESC,
        name
      LIMIT 15
      `,
      [namePart, contextPart],
    );

    return NextResponse.json({
      suggestions: result.rows.map((r) => ({
        level: r.level,
        name: r.name,
        parentName: r.parent_name ?? undefined,
        district: r.district ?? undefined,
        sector: r.sector ?? undefined,
        cell: r.cell ?? undefined,
        bbox: (
          r.bbox_min_lon != null &&
          r.bbox_min_lat != null &&
          r.bbox_max_lon != null &&
          r.bbox_max_lat != null
        )
          ? [r.bbox_min_lon, r.bbox_min_lat, r.bbox_max_lon, r.bbox_max_lat] as [number, number, number, number]
          : undefined,
      })),
    });
  } catch (error) {
    if (isDatabaseUrlMissingError(error)) {
      return NextResponse.json({ suggestions: [] });
    }
    throw error;
  }
}
