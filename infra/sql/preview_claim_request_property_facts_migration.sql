ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS representative_size NUMERIC(14,2);

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS zoning TEXT;

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS bedrooms INTEGER;

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(4,1);

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS interior_area_sqm NUMERIC(14,2);

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS year_built INTEGER;

ALTER TABLE property_claim_request
ADD COLUMN IF NOT EXISTS description TEXT;
