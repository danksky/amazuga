import { type NextRequest, NextResponse } from "next/server";

import { getCurrentUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const currentUser = await getCurrentUser();
  if (!isAdminUser(currentUser)) {
    return new NextResponse(null, { status: 401 });
  }

  const adminReadSecret = process.env.AGENT_ID_PHOTO_ADMIN_READ_SECRET;
  const uploadUrl = process.env.LISTING_IMAGE_UPLOAD_URL;
  if (!adminReadSecret || !uploadUrl) {
    return new NextResponse(null, { status: 503 });
  }

  const { key } = await params;
  const storageKey = key.join("/");
  const workerUrl = `${uploadUrl.replace(/\/+$/, "")}/admin-read/${storageKey}`;

  try {
    const res = await fetch(workerUrl, {
      headers: { Authorization: `Bearer ${adminReadSecret}` },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const blob = await res.blob();
    return new NextResponse(blob, {
      status: 200,
      headers: {
        "content-type": res.headers.get("content-type") ?? "image/jpeg",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
