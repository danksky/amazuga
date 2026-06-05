-- 0009_direct_listing_topology_fix.sql
--
-- Updates validate_property_asset_topology() to allow property_asset rows
-- with parcel_id IS NULL (direct listings created without a UPI).
--
-- Previously the trigger unconditionally required top-level assets to have
-- is_primary_for_parcel = TRUE and unit assets to have a parent_asset_id,
-- neither of which applies when there is no parcel. The fix adds an early
-- return for the null-parcel case so all parcel topology rules are skipped.

CREATE OR REPLACE FUNCTION validate_property_asset_topology()
RETURNS TRIGGER AS $$
DECLARE
  parent_parcel_id TEXT;
  parent_asset_type TEXT;
BEGIN
  -- Direct listings have no parcel; parcel topology rules do not apply.
  IF NEW.parcel_id IS NULL THEN
    RETURN NEW;
  END IF;

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
