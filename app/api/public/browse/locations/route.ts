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
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const result = await getPgPool().query<LocationRow>(
      `
      SELECT level, name, parent_name, district, sector, cell
      FROM browse_location_mv
      WHERE lower(name) LIKE lower($1) || '%'
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
      [q],
    );

    return NextResponse.json({
      suggestions: result.rows.map((r) => ({
        level: r.level,
        name: r.name,
        parentName: r.parent_name ?? undefined,
        district: r.district ?? undefined,
        sector: r.sector ?? undefined,
        cell: r.cell ?? undefined,
      })),
    });
  } catch (error) {
    if (isDatabaseUrlMissingError(error)) {
      return NextResponse.json({ suggestions: [] });
    }
    throw error;
  }
}
