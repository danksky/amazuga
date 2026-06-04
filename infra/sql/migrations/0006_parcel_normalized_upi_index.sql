-- Migration: 0006_parcel_normalized_upi_index
-- Speeds up claim lookups that normalize UPI by stripping spaces and uppercasing.

CREATE INDEX CONCURRENTLY IF NOT EXISTS parcel_app_ready_seed_preview_upi_normalized_idx
  ON parcel_app_ready_seed_preview ((UPPER(REPLACE(upi, ' ', ''))));

