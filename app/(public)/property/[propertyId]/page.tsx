import { notFound } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

interface PropertyRouteProps {
  params: Promise<{
    propertyId: string;
  }>;
}

export default async function PropertyDetailsPage({ params }: PropertyRouteProps) {
  const { propertyId } = await params;
  const propertyPageData = await getPublicPropertyPageData(propertyId);

  if (!propertyPageData) {
    notFound();
  }

  return (
    <PropertyPage
      agency={propertyPageData.agency}
      listing={propertyPageData.listing}
      property={propertyPageData.property}
      valuations={propertyPageData.valuations}
    />
  );
}
