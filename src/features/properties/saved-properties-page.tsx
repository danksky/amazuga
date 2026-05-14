import type { User } from "@/types/domain";

import styles from "./saved-properties-page.module.css";

export function SavedPropertiesPage({ currentUser }: { currentUser: User }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.stack}>
        <div className={styles.header}>
          <div className={styles.eyebrow}>Saved</div>
          <h1 className={styles.title}>Saved properties</h1>
          <div className={styles.body}>
            Saved properties are being migrated from legacy mock IDs to preview-backed parcel records. Once the save flow
            is wired to the preview database, properties you save will appear here.
          </div>
        </div>

        <div className={styles.empty}>
          {currentUser.savedPropertyIds.length > 0
            ? "This account still has legacy saved-property references that are not yet mapped to preview parcel IDs."
            : "You have not saved any preview-backed properties yet."}
        </div>
      </div>
    </div>
  );
}
