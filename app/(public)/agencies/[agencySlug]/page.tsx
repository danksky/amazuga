import { PlaceholderPage } from "@/components/layout/placeholder-page";

interface AgencyPageProps {
  params: Promise<{ agencySlug: string }>;
}

export default async function AgencyPage({ params }: AgencyPageProps) {
  const { agencySlug } = await params;

  return (
    <PlaceholderPage
      eyebrow="Agency"
      title={agencySlug.replaceAll("-", " ")}
      description="Agency pages will show approved agency details, active properties, and a request-to-join path for eligible agents."
    />
  );
}
