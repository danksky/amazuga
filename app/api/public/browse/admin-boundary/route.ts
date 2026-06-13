import { NextResponse } from "next/server";

import { getPgPool, isDatabaseUrlMissingError } from "@/lib/server/postgres";

export const dynamic = "force-dynamic";

const EMPTY_FC = { type: "FeatureCollection", features: [] };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const level    = searchParams.get("level") ?? "";
  const district = searchParams.get("district") ?? null;
  const sector   = searchParams.get("sector")   ?? null;
  const cell     = searchParams.get("cell")     ?? null;
  const village  = searchParams.get("village")  ?? null;

  if (!district) {
    return NextResponse.json({ error: "district is required" }, { status: 400 });
  }

  let sql: string;
  let params: (string | null)[];

  switch (level) {
    case "district":
      sql = `
        SELECT geometry FROM admin_boundary_preview
        WHERE level = 'district' AND lower(district) = lower($1)
        LIMIT 1
      `;
      params = [district];
      break;

    case "sector":
      if (!sector) return NextResponse.json({ error: "sector is required" }, { status: 400 });
      sql = `
        SELECT geometry FROM admin_boundary_preview
        WHERE level = 'sector'
          AND lower(district) = lower($1)
          AND lower(sector)   = lower($2)
        LIMIT 1
      `;
      params = [district, sector];
      break;

    case "cell":
      if (!sector || !cell) return NextResponse.json({ error: "sector and cell are required" }, { status: 400 });
      sql = `
        SELECT geometry FROM admin_boundary_preview
        WHERE level = 'cell'
          AND lower(district) = lower($1)
          AND lower(sector)   = lower($2)
          AND lower(cell)     = lower($3)
        LIMIT 1
      `;
      params = [district, sector, cell];
      break;

    case "village":
      if (!sector || !cell || !village) {
        return NextResponse.json({ error: "sector, cell, and village are required" }, { status: 400 });
      }
      sql = `
        SELECT geometry FROM admin_boundary_preview
        WHERE level = 'village'
          AND lower(district) = lower($1)
          AND lower(sector)   = lower($2)
          AND lower(cell)     = lower($3)
          AND lower(village)  = lower($4)
        LIMIT 1
      `;
      params = [district, sector, cell, village];
      break;

    default:
      return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  try {
    const result = await getPgPool().query<{ geometry: unknown }>(sql, params);

    if (result.rows.length === 0) {
      return NextResponse.json(EMPTY_FC, { status: 404 });
    }

    const fc = {
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: result.rows[0].geometry, properties: {} }],
    };

    return NextResponse.json(fc, {
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    });
  } catch (error) {
    if (isDatabaseUrlMissingError(error)) {
      return NextResponse.json(EMPTY_FC);
    }
    throw error;
  }
}
