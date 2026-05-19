BEGIN;

INSERT INTO app_user (
  id,
  email,
  full_name,
  roles,
  mock_persona_label,
  mock_persona_description,
  upi_lookup_count_today,
  status,
  seed_source
)
VALUES (
  'user-8',
  'private.lister@amazuga.test',
  'Ines Nyirahabimana',
  ARRAY['user']::TEXT[],
  'Private lister',
  'Owns an off-market property and wants to sell privately without an agency.',
  0,
  'active',
  'manual_private_lister_seed_v1'
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  roles = EXCLUDED.roles,
  mock_persona_label = EXCLUDED.mock_persona_label,
  mock_persona_description = EXCLUDED.mock_persona_description,
  upi_lookup_count_today = EXCLUDED.upi_lookup_count_today,
  status = EXCLUDED.status,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

INSERT INTO property_ownership (
  id,
  user_id,
  property_id,
  property_internal_id,
  parcel_id,
  ownership_scope,
  created_from_claim_request_id,
  seed_source
)
SELECT
  'property-ownership-private-lister-5974CFE46F',
  'user-8',
  '5974CFE46F',
  pa.id,
  pa.parcel_id,
  'full',
  NULL,
  'manual_private_lister_seed_v1'
FROM property_asset pa
WHERE pa.id = 'ast_2fdb9b766941533ef20f'
ON CONFLICT (id) DO UPDATE
SET
  user_id = EXCLUDED.user_id,
  property_id = EXCLUDED.property_id,
  property_internal_id = EXCLUDED.property_internal_id,
  parcel_id = EXCLUDED.parcel_id,
  ownership_scope = EXCLUDED.ownership_scope,
  created_from_claim_request_id = EXCLUDED.created_from_claim_request_id,
  seed_source = EXCLUDED.seed_source,
  updated_at = NOW();

-- Self-heal parcel_id in case the INSERT fired before the asset existed.
UPDATE property_ownership po
SET parcel_id = pa.parcel_id,
    updated_at = NOW()
FROM property_asset pa
WHERE po.id = 'property-ownership-private-lister-5974CFE46F'
  AND pa.id = po.property_internal_id
  AND po.parcel_id <> pa.parcel_id;

COMMIT;
