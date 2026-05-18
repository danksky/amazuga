BEGIN;

WITH latest_listing_per_asset AS (
  SELECT DISTINCT ON (l.property_asset_id)
    l.property_asset_id,
    l.parcel_id,
    l.agent_user_id,
    l.updated_at,
    l.created_at
  FROM listing l
  WHERE l.property_asset_id IS NOT NULL
  ORDER BY
    l.property_asset_id,
    CASE WHEN l.status = 'active' THEN 0 ELSE 1 END,
    l.updated_at DESC,
    l.created_at DESC,
    l.id DESC
)
INSERT INTO property_ownership (
  id,
  user_id,
  property_id,
  property_internal_id,
  parcel_id,
  ownership_scope,
  created_from_claim_request_id,
  seed_source,
  created_at,
  updated_at
)
SELECT
  'property-ownership-' || pa.id AS id,
  latest.agent_user_id AS user_id,
  COALESCE(pa.public_id, parcel.public_id, parcel.parcel_id) AS property_id,
  pa.id AS property_internal_id,
  latest.parcel_id,
  CASE
    WHEN pa.asset_type IN ('apartment_unit', 'commercial_unit') THEN 'unit'
    ELSE 'full'
  END AS ownership_scope,
  NULL::TEXT AS created_from_claim_request_id,
  'listing_seed_backfill_v1' AS seed_source,
  COALESCE(latest.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM latest_listing_per_asset latest
JOIN property_asset pa
  ON pa.id = latest.property_asset_id
JOIN parcel_app_ready_seed_preview parcel
  ON parcel.parcel_id = latest.parcel_id
ON CONFLICT (property_internal_id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  property_id = EXCLUDED.property_id,
  parcel_id = EXCLUDED.parcel_id,
  ownership_scope = EXCLUDED.ownership_scope,
  created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

COMMIT;
