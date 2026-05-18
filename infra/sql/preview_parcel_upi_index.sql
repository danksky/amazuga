CREATE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_upi_normalized_idx
ON parcel_app_ready_seed_preview (UPPER(REPLACE(upi, ' ', '')));
