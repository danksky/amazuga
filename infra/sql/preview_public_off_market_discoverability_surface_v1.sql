-- Read surface for off-market parcel discoverability dots on the browse map.
-- One row per parcel that has a valid anchor point.
-- No UPI. No listing visibility. No agent or owner data.
-- Used by:
--   - infra/scripts/build-off-market-pmtiles.sh (tile generation)
--   - Suppression keys are derived at query time in src/lib/server/browse-map.ts
--     by excluding parcel_public_ids that already appear in the active listing surface.
--
-- Suppression (on-market wins over off-market dot) is applied client-side
-- via the API response's suppressionKeys array, not here.

CREATE OR REPLACE VIEW preview_public_off_market_discoverability_surface_v1 AS
SELECT
  p.parcel_id,
  p.public_id     AS parcel_public_id,
  p.public_id     AS route_id,
  p.display_id,
  p.district,
  p.sector,
  parcel_anchor.anchor_lon,
  parcel_anchor.anchor_lat,
  parcel_anchor.anchor_source
FROM parcel_app_ready_seed_preview p
JOIN parcel_anchor_point_preview parcel_anchor
  ON parcel_anchor.parcel_id = p.parcel_id
WHERE p.parcel_id       IS NOT NULL
  AND p.public_id       IS NOT NULL
  AND parcel_anchor.anchor_lon IS NOT NULL
  AND parcel_anchor.anchor_lat IS NOT NULL;
