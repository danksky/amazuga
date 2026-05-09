import { notFound } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getPropertyById } from "@/lib/mock-data";
import { getPropertyByIdFromDb } from "@/lib/server/parcels";

interface PropertyRouteProps {
  params: Promise<{
    propertyId: string;
  }>;
}

export default async function PropertyDetailsPage({ params }: PropertyRouteProps) {
  const { propertyId } = await params;
  const property = getPropertyById(propertyId) ?? (await getPropertyByIdFromDb(propertyId));

  if (!property) {
    notFound();
  }

  return <PropertyPage property={property} />;
}
