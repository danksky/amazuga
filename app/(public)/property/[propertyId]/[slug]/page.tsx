import { notFound, redirect } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";
import { getUserPropertyRelationship } from "@/lib/server/workflows";
import { hasCapability } from "@/types/permissions";

export const dynamic = "force-dynamic";

interface PropertySlugRouteProps {
  params: Promise<{
    propertyId: string;
    slug: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    claim?: string;
  }>;
}

export default async function PropertySlugDetailsPage({ params, searchParams }: PropertySlugRouteProps) {
  const [{ propertyId, slug }, { saved, claim }, currentUser] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);
  const propertyPageData = await getPublicPropertyPageData(propertyId, currentUser?.id);

  if (!propertyPageData) {
    notFound();
  }

  const canonicalPath = routes.public.property(propertyPageData.property.id, {
    propertyTitle: propertyPageData.property.title,
    parcelDisplayId: propertyPageData.property.parcelDisplayId,
    propertyKind: propertyPageData.property.facts.propertyKind,
    unitLabel: propertyPageData.property.unitLabel,
  });
  const currentPath = `/property/${encodeURIComponent(propertyId)}/${slug}`;

  if (currentPath !== canonicalPath) {
    const paramsString = new URLSearchParams(
      Object.entries({ saved, claim }).flatMap(([key, value]) => (typeof value === "string" ? [[key, value]] : [])),
    ).toString();

    redirect(paramsString ? `${canonicalPath}?${paramsString}` : canonicalPath);
  }

  const propertyRouteId = propertyPageData.property.id;
  const propertyRelationship =
    currentUser && propertyPageData.property.internalId
      ? await getUserPropertyRelationship(currentUser.id, propertyPageData.property.internalId)
      : undefined;
  const isSaved = Boolean(currentUser?.savedPropertyIds.includes(propertyRouteId));
  const statusMessage =
    saved === "1"
      ? "Saved to your account."
      : saved === "0"
        ? "Removed from your saved properties."
        : claim === "created"
          ? "Claim request received and sent for review."
          : claim === "pending"
            ? "Your claim request is already pending review."
            : claim === "owned"
              ? "This property is already owned by your account in the portal."
          : undefined;

  return (
    <PropertyPage
      agency={propertyPageData.agency}
      canCreateListing={Boolean(currentUser && hasCapability(currentUser.roles, "create_listing"))}
      claimState={
        propertyRelationship?.ownership
          ? "owned"
          : propertyRelationship?.latestClaimRequest?.status === "pending"
            ? "pending"
            : "claimable"
      }
      isSaved={isSaved}
      listing={propertyPageData.listing}
      property={propertyPageData.property}
      statusMessage={statusMessage}
      valuations={propertyPageData.valuations}
    />
  );
}
