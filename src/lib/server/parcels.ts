import "server-only";

import { pgPool } from "./postgres";

export async function findPropertyIdByUpi(upi: string): Promise<string | undefined> {
  const result = await pgPool.query<{ public_id: string }>(
    `
      SELECT public_id
      FROM parcel_app_ready_seed_preview
      WHERE upi = $1
      LIMIT 1
    `,
    [upi.trim()],
  );

  return result.rows[0]?.public_id;
}
