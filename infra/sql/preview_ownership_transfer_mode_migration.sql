ALTER TABLE property_claim_request
  ADD COLUMN IF NOT EXISTS transfer_mode TEXT
    CHECK (transfer_mode IN ('sale', 'transfer'));

UPDATE property_claim_request
SET transfer_mode = 'transfer'
WHERE request_kind = 'transfer'
  AND transfer_mode IS NULL;
