import type { Metadata } from "next";

import { notFound, redirect } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";
import { getUserPropertyRelationship, listPropertyClaimRequestsForUser } from "@/lib/server/workflows";
import type { Listing, Property, PropertyKind } from "@/types/domain";
import { hasCapability } from "@/types/permissions";

function propertyKindLabel(kind: PropertyKind | undefined): string {
  switch (kind) {
    case "house": return "House";
    case "land": return "Land";
    case "apartment_building": return "Apartment building";
    case "commercial_building": return "Commercial building";
    case "apartment_unit": return "Apartment unit";
    case "commercial_unit": return "Commercial unit";
    default: return "Property";
  }
}

function buildPropertyOgTitle(property: Property, listing: Listing | undefined): string {
  const kind = propertyKindLabel(property.facts.propertyKind);
  const saleLabel = listing ? (listing.marketingType === "rent" ? "for rent" : "for sale") : null;
  const locationLabel = property.location.village ?? property.location.sector ?? property.location.district;
  const priceLabel = listing ? formatCurrency(listing.askingPrice, listing.currency) : null;

  const base = saleLabel ? `${kind} ${saleLabel} in ${locationLabel}` : `${kind} in ${locationLabel}`;
  return priceLabel ? `${base} | ${priceLabel}` : `${base} | Amazuga`;
}

export const dynamic = "force-dynamic";

interface PropertySlugParams {
  propertyId: string;
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<PropertySlugParams> }): Promise<Metadata> {
  const { propertyId } = await params;
  const propertyPageData = await getPublicPropertyPageData(propertyId);

  if (!propertyPageData) {
    return {};
  }

  const { property, listing } = propertyPageData;
  const firstImageUrl = listing?.imageUrls[0];
  const ogImage = firstImageUrl
    ? [{ url: firstImageUrl }]
    : [{ url: "/opengraph-image.png", width: 1200, height: 630 }];

  const title = buildPropertyOgTitle(property, listing);
  const description = listing
    ? `${listing.marketingType === "rent" ? "For rent" : "For sale"}: ${formatCurrency(listing.askingPrice, listing.currency)} — Find property in Rwanda on Amazuga.`
    : "Find property in Rwanda on Amazuga.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage,
      siteName: "Amazuga",
      locale: "en_RW",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [firstImageUrl ?? "/opengraph-image.png"],
    },
  };
}

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
