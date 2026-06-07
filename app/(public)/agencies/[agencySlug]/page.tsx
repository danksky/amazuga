import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgencyProfilePage } from "@/components/profile/agency-profile-page";
import { getAgencyNameBySlug, getPublicAgencyPageData } from "@/lib/server/agency-agent-pages";

interface AgencyPageProps {
  params: Promise<{ agencySlug: string }>;
}

export async function generateMetadata({ params }: AgencyPageProps): Promise<Metadata> {
  const { agencySlug } = await params;
  const name = await getAgencyNameBySlug(agencySlug);
  if (!name) return {};
  const title = `Properties by ${name}`;
  return {
    title,
    openGraph: { title, images: [{ url: "/opengraph-image.png", width: 1200, height: 630 }] },
    twitter: { title, images: ["/opengraph-image.png"] },
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
