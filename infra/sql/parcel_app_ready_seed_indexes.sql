-- Basic indexes for the seeded parcel_app_ready table shape.
-- Replace the table name below if you seed into a different target.

CREATE UNIQUE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_parcel_id_idx
ON parcel_app_ready_seed_preview (parcel_id);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_upi_idx
ON parcel_app_ready_seed_preview (upi);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_public_id_idx
ON parcel_app_ready_seed_preview (public_id);

CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_inventory_status_idx
ON parcel_app_ready_seed_preview (inventory_status);

CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_district_idx
ON parcel_app_ready_seed_preview (district);

CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_sector_idx
ON parcel_app_ready_seed_preview (sector);

CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_location_status_idx
ON parcel_app_ready_seed_preview (inventory_status, district, sector);

ANALYZE parcel_app_ready_seed_preview;
