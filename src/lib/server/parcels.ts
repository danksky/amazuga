import "server-only";

import { getPgPool } from "./postgres";

export async function findPropertyIdByUpi(upi: string): Promise<string | undefined> {
  const result = await getPgPool().query<{ route_id: string }>(
    `
      SELECT
        COALESCE(
          active_listing.property_asset_public_id,
          primary_asset.public_id,
          p.public_id
        ) AS route_id
      FROM parcel_app_ready_seed_preview p
      LEFT JOIN LATERAL (
        SELECT pa.public_id AS property_asset_public_id
        FROM listing l
        JOIN property_asset pa
          ON pa.id = l.property_asset_id
        WHERE l.parcel_id = p.parcel_id
          AND l.status = 'active'
        ORDER BY l.published_at DESC NULLS LAST, l.created_at DESC, l.id ASC
        LIMIT 1
      ) active_listing
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT pa.public_id
        FROM property_asset pa
        WHERE pa.parcel_id = p.parcel_id
          AND pa.is_primary_for_parcel
        ORDER BY pa.created_at ASC, pa.id ASC
        LIMIT 1
      ) primary_asset
        ON TRUE
      WHERE p.upi = $1
      LIMIT 1
    `,
    [upi.trim()],
  );

  return result.rows[0]?.route_id;
}
