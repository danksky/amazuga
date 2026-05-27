CREATE TABLE IF NOT EXISTS parcel_anchor_point_preview (
  parcel_id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL,
  upi TEXT NOT NULL,
  display_id TEXT,
  anchor_source TEXT NOT NULL CHECK (anchor_source IN ('point_on_surface', 'centroid_fallback')),
  anchor_lon DOUBLE PRECISION NOT NULL,
  anchor_lat DOUBLE PRECISION NOT NULL,
  centroid_lon DOUBLE PRECISION,
  centroid_lat DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_anchor_point_preview_public_id_idx
  ON parcel_anchor_point_preview (public_id);

CREATE UNIQUE INDEX IF NOT EXISTS parcel_anchor_point_preview_upi_idx
  ON parcel_anchor_point_preview (upi);
