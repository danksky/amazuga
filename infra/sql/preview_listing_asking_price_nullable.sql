BEGIN;

-- Make asking_price_rwf optional for draft listings.
-- The column was originally NOT NULL with a positive-value check, but the
-- draft-first listing flow needs to allow creation before a price is known.
-- Price is still required before a draft can be published (enforced in app code).

ALTER TABLE listing ALTER COLUMN asking_price_rwf DROP NOT NULL;

-- The inline CHECK constraint created by the original CREATE TABLE gets an
-- auto-generated name. Drop it by name if it exists, then replace with a
-- named constraint that allows NULL.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'listing'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%asking_price_rwf%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE listing DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE listing
  ADD CONSTRAINT listing_asking_price_positive
  CHECK (asking_price_rwf IS NULL OR asking_price_rwf > 0);

COMMIT;
