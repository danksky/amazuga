import { PlaceholderPage } from "@/components/layout/placeholder-page";

interface ValuatorPageProps {
  params: Promise<{ valuatorSlug: string }>;
}

export default async function ValuatorPage({ params }: ValuatorPageProps) {
  const { valuatorSlug } = await params;

  return (
    <PlaceholderPage
      eyebrow="Valuator"
      title={valuatorSlug.replaceAll("-", " ")}
      description="Valuator profiles will be public, even before they have approved valuation history, with more trust signals added later."
    />
  );
}
