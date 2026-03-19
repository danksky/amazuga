import { PropertyCard } from "@/components/property/property-card";
import { currentUser, properties } from "@/lib/mock-data";

import styles from "./saved-properties-page.module.css";

export function SavedPropertiesPage() {
  const savedProperties = properties.filter((property) => currentUser.savedPropertyIds.includes(property.id));

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Saved</div>
          <h1 className={styles.title}>Saved properties</h1>
          <div className={styles.body}>
            Keep track of the properties you want to come back to. Saved properties stay tied to your account so they are
            easy to revisit later.
          </div>
        </div>

        {savedProperties.length > 0 ? (
          <div className={styles.grid}>
            {savedProperties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>You have not saved any properties yet.</div>
        )}
      </div>
    </div>
  );
}
