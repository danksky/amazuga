import { requireCurrentUser } from "@/lib/auth";
import { SavedPropertiesPage } from "@/features/properties/saved-properties-page";
import { getPublicPropertyPageData } from "@/lib/server/public-listings";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const currentUser = await requireCurrentUser();
  const savedEntries = (
    await Promise.all(currentUser.savedPropertyIds.map((propertyId) => getPublicPropertyPageData(propertyId)))
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <SavedPropertiesPage
      currentUser={currentUser}
      savedEntries={savedEntries}
      unresolvedCount={currentUser.savedPropertyIds.length - savedEntries.length}
    />
  );
}
