import { PlaceholderPage } from "@/components/layout/placeholder-page";

interface AreaPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AreaPage({ params }: AreaPageProps) {
  const { slug } = await params;

  return (
    <PlaceholderPage
      eyebrow="Area"
      title={slug.replaceAll("-", " ")}
      description="Area pages will combine market context, active properties, and neighborhood-level browse cues."
    />
  );
}
