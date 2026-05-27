BEGIN;

CREATE TABLE IF NOT EXISTS property_asset_profile (
  property_asset_id TEXT PRIMARY KEY REFERENCES property_asset(id) ON DELETE CASCADE,
  created_by_user_id TEXT REFERENCES app_user(id),
  description TEXT,
  property_type TEXT NOT NULL CHECK (LOWER(BTRIM(property_type)) <> 'building'),
  bedrooms INTEGER,
  bathrooms NUMERIC(4, 1),
  interior_area_sqm NUMERIC(12, 2),
  year_built INTEGER,
  seed_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS property_asset_profile_property_type_idx
  ON property_asset_profile (property_type);

WITH current_asset_counts AS (
  SELECT parcel_id, COUNT(*) AS asset_count
  FROM property_asset
  GROUP BY parcel_id
),
resolved_profiles AS (
  SELECT
    pa.id AS property_asset_id,
    pp.created_by_user_id,
    CASE
      WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
      ELSE pp.description
    END AS description,
    COALESCE(
      CASE
        WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
        ELSE NULLIF(BTRIM(pp.property_type), '')
      END,
      CASE pa.asset_type
        WHEN 'house' THEN 'House'
        WHEN 'land' THEN 'Land'
        WHEN 'apartment_building' THEN 'Apartment building'
        WHEN 'commercial_building' THEN 'Commercial building'
        WHEN 'apartment_unit' THEN 'Apartment unit'
        WHEN 'commercial_unit' THEN 'Commercial unit'
        ELSE 'Property'
      END
    ) AS property_type,
    CASE
      WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
      ELSE pp.bedrooms
    END AS bedrooms,
    CASE
      WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
      ELSE pp.bathrooms
    END AS bathrooms,
    CASE
      WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
      ELSE pp.interior_area_sqm
    END AS interior_area_sqm,
    CASE
      WHEN COALESCE(cac.asset_count, 0) > 1 AND NOT pa.is_primary_for_parcel THEN NULL
      ELSE pp.year_built
    END AS year_built,
    COALESCE(NULLIF(BTRIM(pp.seed_source), ''), 'property_asset_profile_backfill_v1') AS seed_source,
    COALESCE(pp.created_at, NOW()) AS created_at,
    COALESCE(pp.updated_at, NOW()) AS updated_at
  FROM property_asset pa
  LEFT JOIN current_asset_counts cac
    ON cac.parcel_id = pa.parcel_id
  LEFT JOIN property_profile pp
    ON pp.parcel_id = pa.parcel_id
)
INSERT INTO property_asset_profile (
  property_asset_id,
  created_by_user_id,
  description,
  property_type,
  bedrooms,
  bathrooms,
  interior_area_sqm,
  year_built,
  seed_source,
  created_at,
  updated_at
)
SELECT
  property_asset_id,
  created_by_user_id,
  description,
  property_type,
  bedrooms,
  bathrooms,
  interior_area_sqm,
  year_built,
  seed_source,
  created_at,
  updated_at
FROM resolved_profiles
ON CONFLICT (property_asset_id) DO UPDATE
SET
  created_by_user_id = COALESCE(property_asset_profile.created_by_user_id, EXCLUDED.created_by_user_id),
  description = CASE
    WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.description), ''), NULL) IS NULL THEN EXCLUDED.description
    ELSE property_asset_profile.description
  END,
  property_type = CASE
    WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.property_type), ''), NULL) IS NULL THEN EXCLUDED.property_type
    ELSE property_asset_profile.property_type
  END,
  bedrooms = COALESCE(property_asset_profile.bedrooms, EXCLUDED.bedrooms),
  bathrooms = COALESCE(property_asset_profile.bathrooms, EXCLUDED.bathrooms),
  interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
  year_built = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
  updated_at = NOW();

WITH orphan_units AS (
  SELECT pa.id AS unit_asset_id
  FROM property_asset pa
  WHERE pa.asset_type IN ('apartment_unit', 'commercial_unit')
    AND pa.parent_asset_id IS NULL
)
UPDATE property_asset pa
SET
  is_primary_for_parcel = FALSE,
  updated_at = NOW()
FROM orphan_units ou
WHERE pa.id = ou.unit_asset_id
  AND pa.is_primary_for_parcel = TRUE;

WITH orphan_unit_parcels AS (
  SELECT
    pa.parcel_id,
    MIN(p.public_id) AS parcel_public_id,
    CASE
      WHEN MIN(pa.asset_type) = 'commercial_unit' THEN 'commercial_building'
      ELSE 'apartment_building'
    END AS parent_asset_type
  FROM property_asset pa
  JOIN parcel_app_ready_seed_preview p
    ON p.parcel_id = pa.parcel_id
  WHERE pa.asset_type IN ('apartment_unit', 'commercial_unit')
    AND pa.parent_asset_id IS NULL
  GROUP BY pa.parcel_id
)
INSERT INTO property_asset (
  id,
  parcel_id,
  asset_type,
  public_id,
  display_code,
  is_primary_for_parcel,
  seed_source
)
SELECT
  'ast_' || SUBSTR(MD5('property-root:' || oup.parcel_id), 1, 20),
  oup.parcel_id,
  oup.parent_asset_type,
  oup.parcel_public_id,
  'AST-' || UPPER(SUBSTR(MD5('property-root-display:' || oup.parcel_id), 1, 10)),
  TRUE,
  'property_topology_cleanup_v1'
FROM orphan_unit_parcels oup
ON CONFLICT (id) DO UPDATE
SET
  asset_type = EXCLUDED.asset_type,
  public_id = EXCLUDED.public_id,
  is_primary_for_parcel = EXCLUDED.is_primary_for_parcel,
  updated_at = NOW();

WITH orphan_units AS (
  SELECT pa.id AS unit_asset_id, pa.parcel_id
  FROM property_asset pa
  WHERE pa.asset_type IN ('apartment_unit', 'commercial_unit')
    AND pa.parent_asset_id IS NULL
)
UPDATE property_asset pa
SET
  parent_asset_id = parent.id,
  is_primary_for_parcel = FALSE,
  updated_at = NOW()
FROM orphan_units ou
JOIN property_asset parent
  ON parent.parcel_id = ou.parcel_id
 AND parent.seed_source = 'property_topology_cleanup_v1'
 AND parent.parent_asset_id IS NULL
WHERE pa.id = ou.unit_asset_id;

INSERT INTO property_asset_profile (
  property_asset_id,
  created_by_user_id,
  description,
  property_type,
  bedrooms,
  bathrooms,
  interior_area_sqm,
  year_built,
  seed_source
)
SELECT
  parent.id AS property_asset_id,
  child_profile.created_by_user_id,
  NULL,
  CASE parent.asset_type
    WHEN 'apartment_building' THEN 'Apartment building'
    WHEN 'commercial_building' THEN 'Commercial building'
    ELSE 'Property'
  END AS property_type,
  NULL::INTEGER,
  NULL::NUMERIC,
  child_profile.interior_area_sqm,
  child_profile.year_built,
  'property_topology_cleanup_v1'
FROM property_asset parent
LEFT JOIN LATERAL (
  SELECT pap.created_by_user_id, pap.interior_area_sqm, pap.year_built
  FROM property_asset child
  LEFT JOIN property_asset_profile pap
    ON pap.property_asset_id = child.id
  WHERE child.parent_asset_id = parent.id
  ORDER BY child.created_at ASC, child.id ASC
  LIMIT 1
) child_profile
  ON TRUE
WHERE parent.seed_source = 'property_topology_cleanup_v1'
ON CONFLICT (property_asset_id) DO UPDATE
SET
  property_type = EXCLUDED.property_type,
  interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
  year_built = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
  updated_at = NOW();

CREATE OR REPLACE FUNCTION sync_legacy_property_profile_to_asset_profile()
RETURNS TRIGGER AS $$
DECLARE
  target_asset_id TEXT;
  default_property_type TEXT;
BEGIN
  SELECT pa.id
  INTO target_asset_id
  FROM property_asset pa
  WHERE pa.parcel_id = NEW.parcel_id
  ORDER BY
    CASE WHEN pa.is_primary_for_parcel THEN 0 ELSE 1 END,
    pa.created_at ASC,
    pa.id ASC
  LIMIT 1;

  IF target_asset_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Land'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment unit'
      WHEN 'commercial_unit' THEN 'Commercial unit'
      ELSE 'Property'
    END
  INTO default_property_type
  FROM property_asset pa
  WHERE pa.id = target_asset_id;

  INSERT INTO property_asset_profile (
    property_asset_id,
    created_by_user_id,
    description,
    property_type,
    bedrooms,
    bathrooms,
    interior_area_sqm,
    year_built,
    seed_source
  )
  VALUES (
    target_asset_id,
    NEW.created_by_user_id,
    NEW.description,
    COALESCE(NULLIF(BTRIM(NEW.property_type), ''), default_property_type),
    NEW.bedrooms,
    NEW.bathrooms,
    NEW.interior_area_sqm,
    NEW.year_built,
    NEW.seed_source
  )
  ON CONFLICT (property_asset_id) DO UPDATE
  SET
    created_by_user_id = COALESCE(property_asset_profile.created_by_user_id, EXCLUDED.created_by_user_id),
    description = CASE
      WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.description), ''), NULL) IS NULL THEN EXCLUDED.description
      ELSE property_asset_profile.description
    END,
    property_type = CASE
      WHEN COALESCE(NULLIF(BTRIM(property_asset_profile.property_type), ''), NULL) IS NULL THEN EXCLUDED.property_type
      ELSE property_asset_profile.property_type
    END,
    bedrooms = COALESCE(property_asset_profile.bedrooms, EXCLUDED.bedrooms),
    bathrooms = COALESCE(property_asset_profile.bathrooms, EXCLUDED.bathrooms),
    interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
    year_built = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS property_profile_sync_asset_profile ON property_profile;

CREATE TRIGGER property_profile_sync_asset_profile
AFTER INSERT OR UPDATE ON property_profile
FOR EACH ROW
EXECUTE FUNCTION sync_legacy_property_profile_to_asset_profile();

CREATE OR REPLACE FUNCTION validate_property_asset_topology()
RETURNS TRIGGER AS $$
DECLARE
  parent_parcel_id TEXT;
  parent_asset_type TEXT;
BEGIN
  IF NEW.parent_asset_id IS NULL THEN
    IF NEW.asset_type IN ('apartment_unit', 'commercial_unit') THEN
      RAISE EXCEPTION 'Unit assets must reference a parent building';
    END IF;

    IF NEW.is_primary_for_parcel IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Top-level property assets must be the primary asset for the parcel';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM property_asset sibling
      WHERE sibling.parcel_id = NEW.parcel_id
        AND sibling.parent_asset_id IS NULL
        AND sibling.id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one top-level property asset is allowed per parcel';
    END IF;
  ELSE
    IF NEW.asset_type NOT IN ('apartment_unit', 'commercial_unit') THEN
      RAISE EXCEPTION 'Only unit assets may reference a parent asset';
    END IF;

    IF NEW.is_primary_for_parcel IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION 'Child unit assets cannot be marked as the parcel primary asset';
    END IF;

    SELECT pa.parcel_id, pa.asset_type
    INTO parent_parcel_id, parent_asset_type
    FROM property_asset pa
    WHERE pa.id = NEW.parent_asset_id;

    IF parent_parcel_id IS NULL THEN
      RAISE EXCEPTION 'Parent property asset % does not exist', NEW.parent_asset_id;
    END IF;

    IF parent_parcel_id <> NEW.parcel_id THEN
      RAISE EXCEPTION 'Child unit assets must belong to the same parcel as their parent';
    END IF;

    IF NEW.asset_type = 'apartment_unit' AND parent_asset_type <> 'apartment_building' THEN
      RAISE EXCEPTION 'Apartment units must have an apartment building parent';
    END IF;

    IF NEW.asset_type = 'commercial_unit' AND parent_asset_type <> 'commercial_building' THEN
      RAISE EXCEPTION 'Commercial units must have a commercial building parent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS property_asset_validate_topology ON property_asset;

CREATE TRIGGER property_asset_validate_topology
BEFORE INSERT OR UPDATE OF parcel_id, parent_asset_id, asset_type, is_primary_for_parcel
ON property_asset
FOR EACH ROW
EXECUTE FUNCTION validate_property_asset_topology();

CREATE OR REPLACE VIEW preview_property_asset_surface_v1 AS
SELECT
  pa.id AS property_asset_id,
  pa.parcel_id,
  pa.parent_asset_id,
  pa.public_id AS property_route_id,
  pa.display_code AS property_code,
  pa.asset_type AS property_kind,
  pa.unit_label AS property_unit_label,
  pa.description AS property_description_override,
  pa.is_primary_for_parcel,
  p.public_id AS parcel_public_id,
  p.display_id AS parcel_display_id,
  p.upi,
  p.district,
  p.sector,
  p.cell,
  p.village,
  p.centroid_lat,
  p.centroid_lon,
  p.bbox_min_lon,
  p.bbox_min_lat,
  p.bbox_max_lon,
  p.bbox_max_lat,
  p.representative_size,
  p.zoning,
  p.zone_code,
  p.gen_lu,
  pap.description AS profile_description,
  COALESCE(
    NULLIF(BTRIM(pap.property_type), ''),
    CASE pa.asset_type
      WHEN 'house' THEN 'House'
      WHEN 'land' THEN 'Land'
      WHEN 'apartment_building' THEN 'Apartment building'
      WHEN 'commercial_building' THEN 'Commercial building'
      WHEN 'apartment_unit' THEN 'Apartment unit'
      WHEN 'commercial_unit' THEN 'Commercial unit'
      ELSE 'Property'
    END
  ) AS property_type,
  pap.bedrooms,
  pap.bathrooms,
  pap.interior_area_sqm,
  pap.year_built,
  CASE
    WHEN COALESCE(NULLIF(BTRIM(pa.unit_label), ''), NULL) IS NOT NULL
      THEN CONCAT(COALESCE(p.display_id, p.public_id, p.parcel_id), ' · ', pa.unit_label)
    ELSE COALESCE(p.display_id, p.public_id, p.parcel_id)
  END AS property_title,
  COALESCE(pa.description, pap.description) AS resolved_description
FROM property_asset pa
JOIN parcel_app_ready_seed_preview p
  ON p.parcel_id = pa.parcel_id
LEFT JOIN property_asset_profile pap
  ON pap.property_asset_id = pa.id;

DROP VIEW IF EXISTS preview_active_listing_surface_v1;

CREATE VIEW preview_active_listing_surface_v1 AS
SELECT
  l.id AS listing_id,
  pas.parcel_id,
  l.property_asset_id,
  pas.property_route_id AS property_asset_public_id,
  pas.parcel_public_id AS public_id,
  pas.upi,
  pas.district,
  pas.sector,
  pas.cell,
  pas.village,
  pas.centroid_lat,
  pas.centroid_lon,
  pas.representative_size AS land_area_sqm,
  pas.property_title AS title,
  pas.resolved_description AS property_description,
  pas.property_type,
  pas.bedrooms,
  pas.bathrooms,
  pas.interior_area_sqm,
  pas.year_built,
  l.marketing_type,
  l.asking_price_rwf,
  l.currency,
  l.description AS listing_description,
  l.published_at,
  a.id AS agency_id,
  a.slug AS agency_slug,
  a.business_name AS agency_name,
  a.whatsapp_phone,
  a.website_url,
  u.id AS agent_user_id,
  u.full_name AS agent_full_name,
  li.image_url AS primary_image_url
FROM listing l
JOIN preview_property_asset_surface_v1 pas
  ON pas.property_asset_id = l.property_asset_id
JOIN agency a
  ON a.id = l.agency_id
JOIN app_user u
  ON u.id = l.agent_user_id
LEFT JOIN listing_image li
  ON li.listing_id = l.id
 AND li.sort_order = 0
WHERE l.status = 'active';

COMMIT;
