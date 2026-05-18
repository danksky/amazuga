import { notFound, redirect } from "next/navigation";

import { routes } from "@/lib/routes";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

interface PropertyRouteProps {
  params: Promise<{
    propertyId: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    claim?: string;
  }>;
}

export default async function PropertyDetailsPage({ params, searchParams }: PropertyRouteProps) {
  const [{ propertyId }, query] = await Promise.all([params, searchParams]);
  const propertyPageData = await getPublicPropertyPageData(propertyId);

  if (!propertyPageData) {
    notFound();
  }

  const canonicalPath = routes.public.property(propertyPageData.property.id, {
    propertyTitle: propertyPageData.property.title,
    parcelDisplayId: propertyPageData.property.parcelDisplayId,
    propertyKind: propertyPageData.property.facts.propertyKind,
    unitLabel: propertyPageData.property.unitLabel,
  });
  const paramsString = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
  ).toString();

  redirect(paramsString ? `${canonicalPath}?${paramsString}` : canonicalPath);
}
