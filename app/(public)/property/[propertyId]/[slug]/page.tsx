import { notFound, redirect } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getCurrentUser } from "@/lib/auth";
import { routes } from "@/lib/routes";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";
import { getUserPropertyRelationship, listPropertyClaimRequestsForUser } from "@/lib/server/workflows";
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
  const propertyKind = propertyPageData.property.facts.propertyKind;
  const claimScope = propertyKind === "apartment_unit" || propertyKind === "commercial_unit" ? "unit_partial" : "full_parcel";
  const [propertyRelationship, parcelClaimRequests] = currentUser
    ? await Promise.all([
        propertyPageData.property.internalId
          ? getUserPropertyRelationship(currentUser.id, propertyPageData.property.internalId)
          : Promise.resolve(undefined),
        propertyPageData.property.internalId
          ? Promise.resolve([])
          : listPropertyClaimRequestsForUser(currentUser.id),
      ])
    : [undefined, []];
  const parcelPendingClaim = propertyPageData.property.internalId
    ? undefined
    : parcelClaimRequests.find(
        (claimRequest) =>
          claimRequest.parcelId === propertyPageData.property.parcelId &&
          claimRequest.claimScope === claimScope &&
          (claimScope !== "unit_partial" || (claimRequest.unitLabel || "") === (propertyPageData.property.unitLabel || "")) &&
          claimRequest.status === "pending",
      );
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
          : propertyRelationship?.latestClaimRequest?.status === "pending" || parcelPendingClaim
            ? "pending"
            : "claimable"
      }
      contactName={propertyPageData.contactName}
      isSaved={isSaved}
      listing={propertyPageData.listing}
      property={propertyPageData.property}
      statusMessage={statusMessage}
      valuations={propertyPageData.valuations}
    />
  );
}
