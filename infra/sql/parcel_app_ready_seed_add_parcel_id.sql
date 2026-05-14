ALTER TABLE IF EXISTS parcel_app_ready_seed_preview
ADD COLUMN IF NOT EXISTS parcel_id TEXT;

COMMENT ON COLUMN parcel_app_ready_seed_preview.parcel_id IS
'Internal opaque parcel identifier. Existing preview rows may derive this lazily from UPI until the next full reload from parcel-app-ready.parquet.';

CREATE UNIQUE INDEX IF NOT EXISTS parcel_app_ready_seed_preview_parcel_id_idx
ON public.parcel_app_ready_seed_preview (parcel_id)
WHERE parcel_id IS NOT NULL;
