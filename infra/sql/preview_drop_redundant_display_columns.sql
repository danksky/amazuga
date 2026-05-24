-- Drop redundant computed columns from parcel_app_ready_seed_preview.
-- display_id_base is fully derivable from parcel_number + village + sector.
-- address_like_label is also derivable and unused in the application.
-- display_id is kept because its letter suffix (e.g. "3996-A") distinguishes
-- sibling parcels sharing the same base number and cannot be reconstructed
-- from any other column.

ALTER TABLE parcel_app_ready_seed_preview
  DROP COLUMN IF EXISTS display_id_base,
  DROP COLUMN IF EXISTS address_like_label;
