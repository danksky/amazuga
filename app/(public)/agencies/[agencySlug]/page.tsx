import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgencyProfilePage } from "@/components/profile/agency-profile-page";
import { getAgencyMetaBySlug, getPublicAgencyPageData } from "@/lib/server/agency-agent-pages";

interface AgencyPageProps {
  params: Promise<{ agencySlug: string }>;
}

export async function generateMetadata({ params }: AgencyPageProps): Promise<Metadata> {
  const { agencySlug } = await params;
  const meta = await getAgencyMetaBySlug(agencySlug);
  if (!meta) return {};
  const title = `Properties by ${meta.name}`;
  const ogImage = meta.logoUrl ?? "/opengraph-image.png";
  return {
    title,
    openGraph: { title, images: [{ url: ogImage }] },
    twitter: { title, images: [ogImage] },
  };
}

export default async function AgencyPage({ params }: AgencyPageProps) {
  const { agencySlug } = await params;
  const data = await getPublicAgencyPageData(agencySlug);

  if (!data) {
    notFound();
  }

  return <AgencyProfilePage data={data} />;
}
