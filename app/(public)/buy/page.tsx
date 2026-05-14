import { BrowsePage } from "@/features/browse/browse-page";
import { getBrowseListingCards } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

export default async function BuyPage() {
  const listings = await getBrowseListingCards("sale");

  return <BrowsePage listings={listings} mode="buy" />;
}
