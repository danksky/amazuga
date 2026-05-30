import "server-only";

import type { User } from "@/types/domain";

import { getPgPool } from "./postgres";

interface AppUserRow {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  roles: string[];
  avatar_url: string | null;
  mock_persona_label: string | null;
  mock_persona_description: string | null;
  upi_lookup_count_today: number | string | null;
  saved_property_ids: string[] | null;
}

function toUser(row: AppUserRow): User {
  return {
    id: row.id,
    email: row.email || undefined,
    phone: row.phone || undefined,
    fullName: row.full_name,
    roles: row.roles as User["roles"],
    avatarUrl: row.avatar_url || undefined,
    mockPersonaLabel: row.mock_persona_label || undefined,
    mockPersonaDescription: row.mock_persona_description || undefined,
    savedPropertyIds: row.saved_property_ids ?? [],
    upiLookupCountToday: Number(row.upi_lookup_count_today ?? 0),
  };
}

async function getUserRows(whereSql?: string, params: string[] = []) {
  const result = await getPgPool().query<AppUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.phone,
        u.full_name,
        u.roles,
        u.avatar_url,
        u.mock_persona_label,
        u.mock_persona_description,
        u.upi_lookup_count_today,
        COALESCE(
          ARRAY_AGG(COALESCE(sp.property_route_id, sp.legacy_property_ref) ORDER BY sp.created_at ASC)
            FILTER (WHERE sp.id IS NOT NULL),
          ARRAY[]::TEXT[]
        ) AS saved_property_ids
      FROM app_user u
      LEFT JOIN saved_property sp
        ON sp.user_id = u.id
      ${whereSql ?? ""}
      GROUP BY
        u.id,
        u.email,
        u.phone,
        u.full_name,
        u.roles,
        u.avatar_url,
        u.mock_persona_label,
        u.mock_persona_description,
        u.upi_lookup_count_today
      ORDER BY
        u.created_at ASC,
        u.id ASC
    `,
    params,
  );

  return result.rows;
}

export async function listUsersFromDb() {
  const rows = await getUserRows("WHERE u.status = 'active'");
  return rows.map(toUser);
}

export async function getUserByIdFromDb(userId: string) {
  const rows = await getUserRows("WHERE u.status = 'active' AND u.id = $1", [userId]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserByEmailFromDb(email: string) {
  const rows = await getUserRows("WHERE u.status = 'active' AND LOWER(u.email) = LOWER($1)", [email]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function createUserInDb(input: { email: string; fullName: string }) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const idResult = await getPgPool().query<{ id: string }>(
    `
      INSERT INTO app_user (
        id,
        email,
        full_name,
        roles,
        status,
        seed_source
      )
      VALUES (
        'user-' || SUBSTR(MD5($1 || ':' || NOW()::TEXT), 1, 20),
        $1,
        $2,
        ARRAY['user']::TEXT[],
        'active',
        'manual_signup_v1'
      )
      RETURNING id
    `,
    [email, fullName],
  );

  return getUserByIdFromDb(idResult.rows[0].id);
}

export async function getUserByPhoneFromDb(phone: string) {
  const rows = await getUserRows("WHERE u.status = 'active' AND u.phone = $1", [phone]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserBySupabaseAuthIdFromDb(supabaseAuthId: string) {
  const rows = await getUserRows("WHERE u.status = 'active' AND u.supabase_auth_id = $1", [supabaseAuthId]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function upsertOtpUserInDb(input: { supabaseAuthId: string; phone: string }) {
  const idResult = await getPgPool().query<{ id: string }>(
    `
      INSERT INTO app_user (
        id,
        phone,
        full_name,
        supabase_auth_id,
        roles,
        status,
        seed_source
      )
      VALUES (
        'user-' || SUBSTR(MD5($1 || ':' || NOW()::TEXT), 1, 20),
        $2,
        $2,
        $1,
        ARRAY['user']::TEXT[],
        'active',
        'otp_signup_v1'
      )
      ON CONFLICT (supabase_auth_id) DO UPDATE
        SET phone = EXCLUDED.phone
      RETURNING id
    `,
    [input.supabaseAuthId, input.phone],
  );

  return getUserByIdFromDb(idResult.rows[0].id);
}

export async function toggleSavedPropertyForUserInDb(input: {
  userId: string;
  propertyRouteId: string;
}) {
  const existing = await getPgPool().query<{ id: string }>(
    `
      SELECT id
      FROM saved_property
      WHERE user_id = $1
        AND property_route_id = $2
      LIMIT 1
    `,
    [input.userId, input.propertyRouteId],
  );

  if (existing.rows[0]) {
    await getPgPool().query(
      `
        DELETE FROM saved_property
        WHERE id = $1
      `,
      [existing.rows[0].id],
    );

    return { didSave: false };
  }

  await getPgPool().query(
    `
      INSERT INTO saved_property (
        id,
        user_id,
        property_route_id,
        seed_source
      )
      VALUES (
        'svp_' || SUBSTR(MD5($1 || ':' || $2 || ':' || NOW()::TEXT), 1, 20),
        $1,
        $2,
        'manual_save_v1'
      )
    `,
    [input.userId, input.propertyRouteId],
  );

  return { didSave: true };
}
