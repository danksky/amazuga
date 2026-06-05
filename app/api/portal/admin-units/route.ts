import { NextResponse } from "next/server";

import { requireCurrentUser } from "@/lib/auth";
import { getAdminCells, getAdminDistricts, getAdminSectors, getAdminVillages } from "@/lib/server/portal-direct-listing";

export async function GET(request: Request) {
  await requireCurrentUser("/login");

  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");
  const district = searchParams.get("district") ?? "";
  const sector = searchParams.get("sector") ?? "";
  const cell = searchParams.get("cell") ?? "";

  switch (level) {
    case "district": {
      const districts = await getAdminDistricts();
      return NextResponse.json({ values: districts });
    }
    case "sector": {
      if (!district) return NextResponse.json({ values: [] });
      const sectors = await getAdminSectors(district);
      return NextResponse.json({ values: sectors });
    }
    case "cell": {
      if (!district || !sector) return NextResponse.json({ values: [] });
      const cells = await getAdminCells(district, sector);
      return NextResponse.json({ values: cells });
    }
    case "village": {
      if (!district || !sector || !cell) return NextResponse.json({ values: [] });
      const villages = await getAdminVillages(district, sector, cell);
      return NextResponse.json({ values: villages });
    }
    default:
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }
}
