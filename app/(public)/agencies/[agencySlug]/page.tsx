import { notFound } from "next/navigation";

import { AgencyProfilePage } from "@/components/profile/agency-profile-page";
import { getPublicAgencyPageData } from "@/lib/server/agency-agent-pages";

interface AgencyPageProps {
  params: Promise<{ agencySlug: string }>;
}

export default async function AgencyPage({ params }: AgencyPageProps) {
  const { agencySlug } = await params;
  const data = await getPublicAgencyPageData(agencySlug);

  if (!data) {
    notFound();
  }

  return <AgencyProfilePage data={data} />;
}
