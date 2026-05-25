import { NextResponse } from "next/server";

import { runListingImageCleanupBatch } from "@/lib/server/listing-image-cleanup";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!expected) {
    return false;
  }

  return authHeader === `Bearer ${expected}`;
}

async function handleCleanup(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const limit = Number(process.env.LISTING_IMAGE_CLEANUP_BATCH_SIZE || 20);
  const summary = await runListingImageCleanupBatch(Number.isFinite(limit) ? limit : 20);

  return NextResponse.json({
    ok: true,
    summary,
  });
}

export async function GET(request: Request) {
  return handleCleanup(request);
}

export async function POST(request: Request) {
  return handleCleanup(request);
}
