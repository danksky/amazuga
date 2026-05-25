ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS request_kind TEXT NOT NULL DEFAULT 'claim'
    CHECK (request_kind IN ('claim', 'transfer'));

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS transfer_from_user_id TEXT REFERENCES app_user(id);

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS transfer_initiated_by_user_id TEXT REFERENCES app_user(id);

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMPTZ;

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS buyer_declined_at TIMESTAMPTZ;

ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS transfer_note TEXT;

CREATE INDEX IF NOT EXISTS property_claim_request_request_kind_idx
  ON property_claim_request (request_kind);
