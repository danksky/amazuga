import styles from "./filter-bar.module.css";

const defaultFilters = ["For sale", "Price", "Beds & baths", "Property type", "More filters"] as const;

export function FilterBar() {
  return (
    <div className={styles.bar}>
      {defaultFilters.map((filter) => (
        <div className={styles.chip} key={filter}>
          {filter}
        </div>
      ))}
    </div>
  );
}
