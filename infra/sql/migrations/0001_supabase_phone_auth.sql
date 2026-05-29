-- Migration: 0001_supabase_phone_auth
-- Adds phone + supabase_auth_id columns to app_user for Supabase phone OTP auth.
-- email is kept but made nullable so phone-only OTP users can be stored.

ALTER TABLE app_user
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone           TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS supabase_auth_id TEXT UNIQUE;
