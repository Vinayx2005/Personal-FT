-- ============================================================================
-- Multi-user migration — solo → multi-tenant SaaS
-- ============================================================================
-- Transforms the app so:
--   1. Each user only sees their own data (enforced via per-user RLS)
--   2. New users get default categories seeded automatically on signup
--   3. Your existing (single-user) data is preserved and attributed to you
--
-- Run in Supabase SQL Editor. Wrapped in a transaction — if anything fails,
-- everything rolls back and your DB stays in its current state.

BEGIN;

-- ============================================================================
-- STEP 1: Add owner columns to tables that don't have them
-- ============================================================================
ALTER TABLE banks              ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE categories         ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE monthly_balances   ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- ============================================================================
-- STEP 2: Backfill owner columns with the current (first / only) user's id
-- ============================================================================
DO $$
DECLARE
  first_uid UUID;
BEGIN
  SELECT id INTO first_uid FROM users ORDER BY created_at LIMIT 1;
  IF first_uid IS NULL THEN
    RAISE EXCEPTION 'No users found in public.users — create your user row first';
  END IF;

  UPDATE banks                 SET user_id     = first_uid WHERE user_id     IS NULL;
  UPDATE categories            SET user_id     = first_uid WHERE user_id     IS NULL;
  UPDATE monthly_balances      SET user_id     = first_uid WHERE user_id     IS NULL;
  UPDATE transactions          SET created_by  = first_uid WHERE created_by  IS NULL;
  UPDATE investments           SET created_by  = first_uid WHERE created_by  IS NULL;
  UPDATE bank_balance_history  SET changed_by  = first_uid WHERE changed_by  IS NULL;
  UPDATE bank_reconciliation   SET reconciled_by = first_uid WHERE reconciled_by IS NULL;
  UPDATE audit_log             SET user_id     = first_uid WHERE user_id     IS NULL;
END $$;

-- ============================================================================
-- STEP 3: Enforce NOT NULL on the owner columns going forward
-- ============================================================================
ALTER TABLE banks              ALTER COLUMN user_id    SET NOT NULL;
ALTER TABLE categories         ALTER COLUMN user_id    SET NOT NULL;
ALTER TABLE monthly_balances   ALTER COLUMN user_id    SET NOT NULL;
ALTER TABLE transactions       ALTER COLUMN created_by SET NOT NULL;
ALTER TABLE investments        ALTER COLUMN created_by SET NOT NULL;
-- Leave bank_balance_history.changed_by, bank_reconciliation.reconciled_by,
-- and audit_log.user_id nullable — system events can legitimately lack a user.

-- ============================================================================
-- STEP 4: Change categories uniqueness to include user_id
-- ============================================================================
-- Two users can each have their own "Food" — old UNIQUE(type,name) forbade that.
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_type_name_key;
ALTER TABLE categories ADD CONSTRAINT categories_user_type_name_key
  UNIQUE (user_id, type, name);

-- ============================================================================
-- STEP 5: Add indexes on owner columns for RLS-filter performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_banks_user_id           ON banks(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id      ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_balances_user   ON monthly_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_investments_created_by  ON investments(created_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id       ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_bbh_changed_by          ON bank_balance_history(changed_by);

-- ============================================================================
-- STEP 6: Drop the old permissive "any authenticated user" RLS policies
-- ============================================================================
DROP POLICY IF EXISTS "users_authenticated_own"           ON users;
DROP POLICY IF EXISTS "users_view_own"                    ON users;
DROP POLICY IF EXISTS "transactions_authenticated"        ON transactions;
DROP POLICY IF EXISTS "bank_reconciliation_authenticated" ON bank_reconciliation;
DROP POLICY IF EXISTS "categories_authenticated"          ON categories;
DROP POLICY IF EXISTS "banks_authenticated"               ON banks;
DROP POLICY IF EXISTS "bank_balance_history_authenticated" ON bank_balance_history;
DROP POLICY IF EXISTS "investments_authenticated"         ON investments;
DROP POLICY IF EXISTS "monthly_balances_authenticated"    ON monthly_balances;
DROP POLICY IF EXISTS "audit_log_authenticated"           ON audit_log;

-- ============================================================================
-- STEP 7: Ensure RLS is on for every user-scoped table
-- ============================================================================
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_balances     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log            ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 8: Create per-user RLS policies
-- ============================================================================
CREATE POLICY "users_owner" ON users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "banks_owner" ON banks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_owner" ON categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_owner" ON transactions
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "investments_owner" ON investments
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "monthly_balances_owner" ON monthly_balances
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "audit_log_owner" ON audit_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- bank_balance_history and bank_reconciliation have no direct user_id column —
-- filter through the parent bank OR the changed_by/reconciled_by field.
CREATE POLICY "bank_balance_history_owner" ON bank_balance_history
  FOR ALL USING (
    changed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    changed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  );

CREATE POLICY "bank_reconciliation_owner" ON bank_reconciliation
  FOR ALL USING (
    reconciled_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    reconciled_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  );

-- ============================================================================
-- STEP 9: handle_new_user trigger — runs on every new Supabase Auth signup.
-- Creates the app-side users row AND seeds 11 default categories per user.
-- SECURITY DEFINER lets it bypass RLS to do the initial inserts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.categories (type, name, user_id, is_default) VALUES
    ('expense', 'Food & Groceries', NEW.id, true),
    ('expense', 'Rent',             NEW.id, true),
    ('expense', 'Transport',        NEW.id, true),
    ('expense', 'Utilities',        NEW.id, true),
    ('expense', 'Entertainment',    NEW.id, true),
    ('expense', 'Shopping',         NEW.id, true),
    ('expense', 'Healthcare',       NEW.id, true),
    ('expense', 'Others',           NEW.id, true),
    ('income',  'Salary',           NEW.id, true),
    ('income',  'Freelance',        NEW.id, true),
    ('income',  'Others',           NEW.id, true)
  ON CONFLICT (user_id, type, name) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
