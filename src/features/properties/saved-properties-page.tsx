import { PropertyCard } from "@/components/property/property-card";
import type { PublicPropertyPageData } from "@/lib/server/public-listings";
import type { User } from "@/types/domain";

import styles from "./saved-properties-page.module.css";

interface SavedPropertiesPageProps {
  currentUser: User;
  savedEntries: PublicPropertyPageData[];
  unresolvedCount: number;
}

export function SavedPropertiesPage({ currentUser, savedEntries, unresolvedCount }: SavedPropertiesPageProps) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Saved</div>
          <h1 className={styles.title}>Saved properties</h1>
          <div className={styles.body}>
            Saved properties now use asset-aware route IDs when available, while older legacy references can continue to
            age out as we replace them.
          </div>
        </div>

        {savedEntries.length > 0 ? (
          <div className={styles.stack}>
            {savedEntries.map(({ property, listing, valuations }) => (
              <PropertyCard
                key={property.id}
                latestValuation={valuations[0]}
                listing={listing}
                property={property}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            {currentUser.savedPropertyIds.length > 0
              ? "This account still has saved references that are not yet resolvable in the preview dataset."
              : "You have not saved any asset-backed properties yet."}
          </div>
        )}
        {unresolvedCount > 0 ? (
          <div className={styles.body}>
            {unresolvedCount} saved reference{unresolvedCount === 1 ? "" : "s"} could not be resolved and may still be
            pointing at older mock IDs.
          </div>
        ) : null}
      </div>
    </div>
  );
}
