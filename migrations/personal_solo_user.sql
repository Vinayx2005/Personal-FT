-- ============================================================================
-- Personal FT — solo-user cleanup
-- ============================================================================
-- Run this in the Supabase SQL Editor to drop the multi-user role/module
-- system entirely. After this, any authenticated user (there should be one:
-- you) has full access. RLS is simplified to per-user own-row checks only.
--
-- Safe to run multiple times.

-- 1. Drop RLS policies that depend on is_admin() or roles/modules
DROP POLICY IF EXISTS "users_admin_view_all" ON users;
DROP POLICY IF EXISTS "users_admin_insert" ON users;
DROP POLICY IF EXISTS "users_admin_update" ON users;
DROP POLICY IF EXISTS "module_access_self_or_admin" ON module_access;

-- 2. Drop the helper function
DROP FUNCTION IF EXISTS is_admin();

-- 3. Drop the module_access / modules tables
DROP TABLE IF EXISTS module_access CASCADE;
DROP TABLE IF EXISTS modules CASCADE;

-- 4. Drop the role_id column from users (it FK'd to roles)
ALTER TABLE users DROP COLUMN IF EXISTS role_id;

-- 5. Drop the roles table
DROP TABLE IF EXISTS roles CASCADE;

-- 6. Simplify the users RLS: authenticated user reads/writes their own row
DROP POLICY IF EXISTS "users_view_own" ON users;
DROP POLICY IF EXISTS "users_authenticated_own" ON users;
CREATE POLICY "users_authenticated_own" ON users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
