#!/usr/bin/env node
/**
 * backfill-user-emails.mjs
 *
 * Sets app_user.email for existing phone-only users so they can sign in
 * via email OTP. Safe to re-run — skips users who already have an email.
 *
 * Edit the USERS array below, then run:
 *
 *   Run against preview:
 *     node --env-file=.env.local --env-file=.env.infra.local scripts/backfill-user-emails.mjs
 *
 *   Run against production (pass DATABASE_URL directly):
 *     DATABASE_URL=<prod_url> node --env-file=.env.local scripts/backfill-user-emails.mjs
 */

import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("No DATABASE_URL_PREVIEW or DATABASE_URL set"); process.exit(1); }

// Map phone (as stored in DB, no leading +) → email to set
const USERS = [
  // { phone: "250793022670", email: "iddy@example.com" },
  // { phone: "250788522814", email: "jeandedieu@example.com" },
  // { phone: "250781380913", email: "pacifique@example.com" },
  // { phone: "250785514692", email: "jeanchristophe@example.com" },
];

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  for (const { phone, email } of USERS) {
    const existing = await pool.query(
      `SELECT id, email FROM app_user WHERE phone = $1 LIMIT 1`,
      [phone],
    );
    const user = existing.rows[0];

    if (!user) {
      console.log(`  ⚠  No user found for phone ${phone} — skipping`);
      continue;
    }

    if (user.email) {
      console.log(`  ✓  ${phone} already has email (${user.email}) — skipping`);
      continue;
    }

    await pool.query(
      `UPDATE app_user SET email = $1, updated_at = NOW() WHERE id = $2`,
      [email.trim().toLowerCase(), user.id],
    );
    console.log(`  ✓  ${phone} → ${email}`);
  }

  await pool.end();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  pool.end().catch(() => {});
  process.exit(1);
});
