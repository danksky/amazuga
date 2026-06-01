import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPublicPropertyWhatsappUrl } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      propertyId: string;
    }>;
  },
) {
  const [{ propertyId }, currentUser] = await Promise.all([context.params, getCurrentUser()]);
  const requestUrl = new URL(request.url);
  const whatsappUrl = await getPublicPropertyWhatsappUrl(propertyId, currentUser?.id, requestUrl.host);

  if (!whatsappUrl) {
    return NextResponse.redirect(new URL(routes.public.property(propertyId), requestUrl), { status: 303 });
  }

  return NextResponse.redirect(whatsappUrl, { status: 303 });
}
