import { requireCurrentUser } from "@/lib/auth";
import { SavedPropertiesPage } from "@/features/properties/saved-properties-page";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const currentUser = await requireCurrentUser();
  return <SavedPropertiesPage currentUser={currentUser} />;
}
