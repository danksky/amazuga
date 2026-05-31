import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createAgentIdPhotoUploadIntent, isAgentIdPhotoUploadConfigured } from "@/lib/server/agent-id-photo-storage";

export const dynamic = "force-dynamic";

export async function POST() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!isAgentIdPhotoUploadConfigured()) {
    return NextResponse.json({ error: "ID photo upload is not configured." }, { status: 503 });
  }

  try {
    const intent = createAgentIdPhotoUploadIntent(currentUser.id);
    return NextResponse.json({ intent });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create upload intent." },
      { status: 500 },
    );
  }
}
