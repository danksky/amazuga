#!/usr/bin/env node
/**
 * migrate-approve-pending-claims.mjs
 *
 * One-time script: auto-approves all property_claim_request rows with
 * status='pending' by running the same asset/ownership creation logic
 * that the old admin approval workflow used.
 *
 * Run after deploying migration 0012 on the preview database:
 *   node scripts/migrate-approve-pending-claims.mjs
 *
 * Requires DATABASE_URL in the environment (or .env.local).
 * Safe to run multiple times — rows already approved are skipped.
 */

import { createHash } from "crypto";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function createClaimRootAssetId(parcelId) {
  return "ast_" + createHash("md5").update("claim-primary:" + parcelId).digest("hex").slice(0, 20);
}
function createClaimRootDisplayCode(parcelId) {
  return "AST-" + createHash("md5").update("claim-display:" + parcelId).digest("hex").slice(0, 10).toUpperCase();
}

async function approveClaim(client, claim) {
  const parcelRow = await client.query(
    `SELECT public_id FROM parcel_app_ready_seed_preview WHERE parcel_id = $1 LIMIT 1`,
    [claim.parcel_id],
  );
  const parcelPublicId = parcelRow.rows[0]?.public_id || claim.parcel_id;

  // Ensure property_asset exists for this parcel.
  const assetId = createClaimRootAssetId(claim.parcel_id);
  const assetDisplayCode = createClaimRootDisplayCode(claim.parcel_id);

  await client.query(
    `
      INSERT INTO property_asset (id, parcel_id, asset_type, public_id, display_code, is_primary_for_parcel, seed_source)
      VALUES ($1, $2, $3, $4, $5, TRUE, 'claim_approval_migration_v1')
      ON CONFLICT (id) DO UPDATE
      SET asset_type = EXCLUDED.asset_type, updated_at = NOW()
    `,
    [assetId, claim.parcel_id, claim.declared_asset_type, parcelPublicId, assetDisplayCode],
  );

  // Link claim request to the asset.
  await client.query(
    `UPDATE property_claim_request SET property_internal_id = $2, property_id = $3, updated_at = NOW() WHERE id = $1`,
    [claim.id, assetId, parcelPublicId],
  );

  // Backfill location onto property_asset from parcel data.
  const parcelContext = await client.query(
    `
      SELECT
        parcel_label(p.upi, p.cell, p.sector) AS display_id,
        p.district, p.sector, p.cell, p.village,
        p.representative_size,
        anchor.anchor_lat, anchor.anchor_lon,
        p.centroid_lat, p.centroid_lon
      FROM parcel_app_ready_seed_preview p
      LEFT JOIN parcel_anchor_point_preview anchor ON anchor.parcel_id = p.parcel_id
      WHERE p.parcel_id = $1
      LIMIT 1
    `,
    [claim.parcel_id],
  );
  const ctx = parcelContext.rows[0];
  if (ctx) {
    await client.query(
      `
        UPDATE property_asset
        SET
          location_source = COALESCE(location_source, 'parcel'),
          display_name    = COALESCE(display_name, $2),
          admin_district  = COALESCE(admin_district, $3),
          admin_sector    = COALESCE(admin_sector, $4),
          admin_cell      = COALESCE(admin_cell, $5),
          admin_village   = COALESCE(admin_village, $6),
          anchor_lat      = COALESCE(anchor_lat, $7),
          anchor_lon      = COALESCE(anchor_lon, $8),
          updated_at      = NOW()
        WHERE id = $1
      `,
      [
        assetId,
        ctx.display_id || parcelPublicId,
        ctx.district,
        ctx.sector,
        ctx.cell,
        ctx.village,
        ctx.anchor_lat ?? ctx.centroid_lat,
        ctx.anchor_lon ?? ctx.centroid_lon,
      ],
    );

    // Backfill property_asset_profile.
    await client.query(
      `
        INSERT INTO property_asset_profile (
          property_asset_id, created_by_user_id, property_type,
          bedrooms, bathrooms, interior_area_sqm, year_built, seed_source
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'claim_approval_migration_v1')
        ON CONFLICT (property_asset_id) DO UPDATE
        SET
          bedrooms          = COALESCE(property_asset_profile.bedrooms, EXCLUDED.bedrooms),
          bathrooms         = COALESCE(property_asset_profile.bathrooms, EXCLUDED.bathrooms),
          interior_area_sqm = COALESCE(property_asset_profile.interior_area_sqm, EXCLUDED.interior_area_sqm),
          year_built        = COALESCE(property_asset_profile.year_built, EXCLUDED.year_built),
          updated_at        = NOW()
      `,
      [
        assetId,
        claim.user_id,
        claim.declared_asset_type ?? "Property",
        claim.bedrooms ?? null,
        claim.bathrooms ?? null,
        claim.interior_area_sqm ?? null,
        claim.year_built ?? null,
      ],
    );
  }

  // Check for ownership conflict before inserting.
  const conflict = await client.query(
    `SELECT id FROM property_ownership WHERE property_internal_id = $1 AND user_id <> $2 LIMIT 1`,
    [assetId, claim.user_id],
  );
  if (conflict.rows[0]) {
    console.warn(`  ⚠  Skipping ${claim.id}: ownership conflict on asset ${assetId}`);
    return false;
  }

  // Create property_ownership.
  const ownershipId = `property-ownership-${assetId}`;
  await client.query(
    `
      INSERT INTO property_ownership (
        id, user_id, property_id, property_internal_id,
        parcel_id, ownership_scope, created_from_claim_request_id, seed_source
      )
      VALUES ($1, $2, $3, $4, $5, 'full', $6, 'claim_approval_migration_v1')
      ON CONFLICT (property_internal_id) DO NOTHING
    `,
    [ownershipId, claim.user_id, parcelPublicId, assetId, claim.parcel_id, claim.id],
  );

  // Mark claim as approved.
  await client.query(
    `UPDATE property_claim_request SET status = 'approved', updated_at = NOW() WHERE id = $1`,
    [claim.id],
  );

  // Grant private_lister role.
  await client.query(
    `
      UPDATE app_user
      SET roles = CASE WHEN roles @> ARRAY['private_lister'] THEN roles ELSE roles || 'private_lister' END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [claim.user_id],
  );

  return true;
}

async function main() {
  const pending = await pool.query(
    `
      SELECT id, user_id, parcel_id, upi, claim_scope, unit_label,
             declared_asset_type, bedrooms, bathrooms, interior_area_sqm, year_built
      FROM property_claim_request
      WHERE status = 'pending' AND request_kind = 'claim'
      ORDER BY created_at ASC
    `,
  );

  console.log(`Found ${pending.rows.length} pending claim(s) to auto-approve.`);
  if (pending.rows.length === 0) {
    await pool.end();
    return;
  }

  let approved = 0;
  let skipped = 0;

  for (const claim of pending.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const ok = await approveClaim(client, claim);
      await client.query("COMMIT");
      if (ok) {
        console.log(`  ✓  Approved ${claim.id} (parcel ${claim.parcel_id})`);
        approved++;
      } else {
        skipped++;
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error(`  ✗  Failed ${claim.id}:`, err.message);
      skipped++;
    } finally {
      client.release();
    }
  }

  console.log(`\nDone: ${approved} approved, ${skipped} skipped/failed.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
