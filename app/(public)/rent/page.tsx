import { BrowsePage } from "@/features/browse/browse-page";
import { getBrowseListingCards } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

export default async function RentPage() {
  const listings = await getBrowseListingCards("rent");

  return <BrowsePage listings={listings} mode="rent" />;
}
