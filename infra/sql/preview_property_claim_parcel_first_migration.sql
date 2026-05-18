BEGIN;

ALTER TABLE property_claim_request
  ALTER COLUMN property_id DROP NOT NULL,
  ALTER COLUMN property_internal_id DROP NOT NULL;

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS upi TEXT,
  ADD COLUMN IF NOT EXISTS claim_scope TEXT NOT NULL DEFAULT 'full_parcel' CHECK (claim_scope IN ('full_parcel', 'unit_partial')),
  ADD COLUMN IF NOT EXISTS unit_label TEXT,
  ADD COLUMN IF NOT EXISTS tenure_type TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_type IN ('freehold', 'emphyteutic_lease', 'unspecified')),
  ADD COLUMN IF NOT EXISTS tenure_source TEXT NOT NULL DEFAULT 'unspecified' CHECK (tenure_source IN ('user_provided', 'auto_populated', 'unspecified'));

UPDATE property_claim_request pcr
SET upi = parcel.upi
FROM parcel_app_ready_seed_preview parcel
WHERE pcr.parcel_id = parcel.parcel_id
  AND pcr.upi IS NULL;

ALTER TABLE property_claim_request
  ALTER COLUMN upi SET NOT NULL;

DROP INDEX IF EXISTS property_claim_request_one_pending_per_user_property_idx;

CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_property_idx
  ON property_claim_request (user_id, property_internal_id)
  WHERE status = 'pending' AND property_internal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS property_claim_request_one_pending_per_user_parcel_scope_idx
  ON property_claim_request (user_id, parcel_id, claim_scope, COALESCE(unit_label, ''))
  WHERE status = 'pending';

COMMENT ON COLUMN property_claim_request.upi IS
  'Parcel-level UPI entered or confirmed during a claim submission.';

COMMENT ON COLUMN property_claim_request.claim_scope IS
  'Whether the user is claiming the full parcel/property or a partial unit/apartment on that parcel.';

COMMENT ON COLUMN property_claim_request.unit_label IS
  'Optional user-provided unit/apartment identifier used for partial claims when no official unit-level UPI exists.';

COMMENT ON COLUMN property_claim_request.tenure_type IS
  'Reported or inferred land tenure for the claim, kept separate from later authoritative enrichment.';

COMMENT ON COLUMN property_claim_request.tenure_source IS
  'Tracks whether tenure came from the user, a dataset, or remains unspecified.';

COMMIT;
