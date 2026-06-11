import { NextResponse } from "next/server";

import { getPgPool } from "@/lib/server/postgres";
import { generateAndStoreOgImage } from "@/lib/server/og-image";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  return Boolean(expected && authHeader === `Bearer ${expected}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  // Single listing mode.
  if (typeof body?.listingId === "string" && body.listingId) {
    await generateAndStoreOgImage(body.listingId);
    return NextResponse.json({ ok: true, listingId: body.listingId });
  }

  // Backfill mode: regenerate OG for active listings missing og_image_url.
  if (body?.backfill === true) {
    const limit = typeof body.limit === "number" && body.limit > 0 ? body.limit : 50;
    const { rows } = await getPgPool().query<{ id: string }>(
      `SELECT id FROM listing WHERE status = 'active' AND og_image_url IS NULL ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await generateAndStoreOgImage(row.id);
        succeeded++;
      } catch (err) {
        failed++;
        errors.push(`${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ ok: true, total: rows.length, succeeded, failed, errors });
  }

  return NextResponse.json(
    { error: "Provide { listingId } for a single listing or { backfill: true } to run a batch." },
    { status: 400 },
  );
}
