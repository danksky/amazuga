import { notFound } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getCurrentUser } from "@/lib/auth";
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
  const [{ propertyId }, { saved, claim }, currentUser] = await Promise.all([
    params,
    searchParams,
    getCurrentUser(),
  ]);
  const propertyPageData = await getPublicPropertyPageData(propertyId);

  if (!propertyPageData) {
    notFound();
  }

  const propertyRouteId = propertyPageData.property.id;
  const isSaved = Boolean(currentUser?.savedPropertyIds.includes(propertyRouteId));
  const statusMessage =
    saved === "1"
      ? "Saved to your account."
      : saved === "0"
        ? "Removed from your saved properties."
        : claim === "1"
          ? "Claim request received. We can use this as the starting point for the future verification flow."
          : undefined;

  return (
    <PropertyPage
      agency={propertyPageData.agency}
      isSaved={isSaved}
      listing={propertyPageData.listing}
      property={propertyPageData.property}
      statusMessage={statusMessage}
      valuations={propertyPageData.valuations}
    />
  );
}
