import { notFound } from "next/navigation";

import { PropertyPage } from "@/components/property/property-page";
import { getPropertyById } from "@/lib/mock-data";

interface PropertyRouteProps {
  params: Promise<{
    propertyId: string;
  }>;
}

export default async function PropertyDetailsPage({ params }: PropertyRouteProps) {
  const { propertyId } = await params;
  const property = getPropertyById(propertyId);

  if (!property) {
    notFound();
  }

  return <PropertyPage property={property} />;
}
