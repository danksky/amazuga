BEGIN;

WITH owned_assets AS (
  SELECT DISTINCT ON (pa.id)
    pa.id AS property_asset_id,
    pa.parcel_id,
    pa.asset_type,
    pa.unit_label,
    po.user_id,
    pcr.unit_label AS claim_unit_label,
    parcel.display_id,
    parcel.public_id AS parcel_public_id,
    parcel.district,
    parcel.sector,
    parcel.representative_size
  FROM property_ownership po
  JOIN property_asset pa
    ON pa.id = po.property_internal_id
  JOIN parcel_app_ready_seed_preview parcel
    ON parcel.parcel_id = pa.parcel_id
  LEFT JOIN property_claim_request pcr
    ON pcr.id = po.created_from_claim_request_id
  ORDER BY pa.id, po.created_at DESC, po.id DESC
),
backfill AS (
  SELECT
    owned.property_asset_id,
    owned.parcel_id,
    owned.user_id,
    COALESCE(NULLIF(BTRIM(owned.unit_label), ''), NULLIF(BTRIM(owned.claim_unit_label), '')) AS inferred_unit_label,
    CASE owned.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'apartment_unit' THEN 'Apartment'
      WHEN 'building' THEN 'Building'
      WHEN 'commercial_unit' THEN 'Commercial'
      WHEN 'land' THEN 'Parcel'
      WHEN 'mixed_use' THEN 'Mixed use'
      ELSE 'Property'
    END AS inferred_property_type,
    CASE owned.asset_type
      WHEN 'house' THEN 'Preview house record auto-backfilled from parcel context after claim approval.'
      WHEN 'apartment_unit' THEN 'Preview apartment-unit record auto-backfilled from parcel context after claim approval.'
      WHEN 'building' THEN 'Preview building record auto-backfilled from parcel context after claim approval.'
      WHEN 'commercial_unit' THEN 'Preview commercial-unit record auto-backfilled from parcel context after claim approval.'
      WHEN 'land' THEN 'Preview land record auto-backfilled from parcel context after claim approval.'
      WHEN 'mixed_use' THEN 'Preview mixed-use record auto-backfilled from parcel context after claim approval.'
      ELSE 'Preview property record auto-backfilled from parcel context after claim approval.'
    END AS inferred_description,
    CASE owned.asset_type
      WHEN 'house' THEN
        CASE
          WHEN COALESCE(owned.representative_size, 0) >= 650 THEN 5
          WHEN COALESCE(owned.representative_size, 0) >= 420 THEN 4
          WHEN COALESCE(owned.representative_size, 0) >= 250 THEN 3
          ELSE 2
        END
      WHEN 'apartment_unit' THEN
        CASE
          WHEN COALESCE(owned.representative_size, 0) >= 900 THEN 3
          WHEN COALESCE(owned.representative_size, 0) >= 450 THEN 2
          ELSE 1
        END
      ELSE NULL::INTEGER
    END AS inferred_bedrooms,
    CASE owned.asset_type
      WHEN 'house' THEN
        CASE
          WHEN COALESCE(owned.representative_size, 0) >= 650 THEN 4.0::NUMERIC
          WHEN COALESCE(owned.representative_size, 0) >= 420 THEN 3.0::NUMERIC
          ELSE 2.0::NUMERIC
        END
      WHEN 'apartment_unit' THEN
        CASE
          WHEN COALESCE(owned.representative_size, 0) < 300 THEN 1.0::NUMERIC
          ELSE 2.0::NUMERIC
        END
      ELSE NULL::NUMERIC
    END AS inferred_bathrooms,
    CASE owned.asset_type
      WHEN 'house' THEN ROUND(LEAST(GREATEST(COALESCE(owned.representative_size * 0.42, 180.0), 90.0), 420.0)::NUMERIC, 2)
      WHEN 'apartment_unit' THEN ROUND(LEAST(GREATEST(COALESCE(owned.representative_size * 0.18, 96.0), 55.0), 160.0)::NUMERIC, 2)
      WHEN 'building' THEN ROUND(LEAST(GREATEST(COALESCE(owned.representative_size * 1.35, 1680.0), 480.0), 3200.0)::NUMERIC, 2)
      WHEN 'commercial_unit' THEN ROUND(LEAST(GREATEST(COALESCE(owned.representative_size * 0.35, 148.0), 80.0), 420.0)::NUMERIC, 2)
      WHEN 'mixed_use' THEN ROUND(LEAST(GREATEST(COALESCE(owned.representative_size * 0.58, 260.0), 140.0), 980.0)::NUMERIC, 2)
      ELSE NULL::NUMERIC
    END AS inferred_interior_area_sqm
  FROM owned_assets owned
),
updated_assets AS (
  UPDATE property_asset pa
  SET
    unit_label = COALESCE(NULLIF(BTRIM(pa.unit_label), ''), backfill.inferred_unit_label),
    updated_at = NOW()
  FROM backfill
  WHERE pa.id = backfill.property_asset_id
    AND COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NULL
    AND backfill.inferred_unit_label IS NOT NULL
  RETURNING pa.id
)
INSERT INTO property_profile (
  parcel_id,
  created_by_user_id,
  description,
  property_type,
  bedrooms,
  bathrooms,
  interior_area_sqm,
  seed_source
)
SELECT
  backfill.parcel_id,
  backfill.user_id,
  backfill.inferred_description,
  backfill.inferred_property_type,
  backfill.inferred_bedrooms,
  backfill.inferred_bathrooms,
  backfill.inferred_interior_area_sqm,
  'claim_record_backfill_v1'
FROM backfill
ON CONFLICT (parcel_id) DO UPDATE
SET
  created_by_user_id = COALESCE(property_profile.created_by_user_id, EXCLUDED.created_by_user_id),
  description = CASE
    WHEN COALESCE(NULLIF(BTRIM(property_profile.description), ''), NULL) IS NULL THEN EXCLUDED.description
    ELSE property_profile.description
  END,
  bedrooms = COALESCE(property_profile.bedrooms, EXCLUDED.bedrooms),
  bathrooms = COALESCE(property_profile.bathrooms, EXCLUDED.bathrooms),
  interior_area_sqm = COALESCE(property_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
  updated_at = NOW();

COMMIT;
