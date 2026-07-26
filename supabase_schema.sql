-- ============================================================================
-- Personal FT — Multi-user schema
-- ============================================================================
-- Run this once in Supabase SQL Editor for a fresh install.
--
-- If you had an earlier single-user version installed, run the migrations
-- in order first (they take an old install to the current state):
--   1. migrations/personal_cleanup.sql
--   2. migrations/personal_solo_user.sql
--   3. migrations/investments_rename.sql
--   4. migrations/rls_permissive_policies.sql
--   5. migrations/multi_user_migration.sql

-- ============================================================================
-- 1. USERS (mirrors auth.users, populated by trigger below)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 2. FINANCIAL CORE
-- ============================================================================

CREATE TABLE IF NOT EXISTS banks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  account_holder VARCHAR(255),
  ifsc_code VARCHAR(20),
  opening_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_balance_history (
  id BIGSERIAL PRIMARY KEY,
  bank_id BIGINT REFERENCES banks(id) ON DELETE CASCADE,
  previous_balance DECIMAL(15,2),
  new_balance DECIMAL(15,2) NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type, name)
);

CREATE TABLE IF NOT EXISTS monthly_balances (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id BIGINT REFERENCES banks(id) ON DELETE CASCADE,
  financial_month DATE NOT NULL,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bank_id, financial_month)
);

-- ============================================================================
-- 3. TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  bank_id BIGINT REFERENCES banks(id),
  category_id BIGINT REFERENCES categories(id),
  description VARCHAR(500),
  amount DECIMAL(15,2) NOT NULL,
  transaction_date DATE NOT NULL,
  payee_name VARCHAR(255),
  transfer_group_id UUID,
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('posted', 'draft', 'reconciled')),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_bank       ON transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category   ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);

-- ============================================================================
-- 4. INVESTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'fd'
    CHECK (type IN ('fd', 'smallcase', 'stocks', 'mutual_fund', 'others')),
  amount DECIMAL(15,2) NOT NULL,
  source_bank_id BIGINT REFERENCES banks(id),
  start_date DATE,
  maturity_date DATE,
  interest_rate DECIMAL(6,3),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_created_by ON investments(created_by);

-- ============================================================================
-- 5. BANK RECONCILIATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_reconciliation (
  id BIGSERIAL PRIMARY KEY,
  bank_id BIGINT REFERENCES banks(id),
  reconciliation_date DATE NOT NULL,
  opening_balance DECIMAL(15,2),
  closing_balance DECIMAL(15,2),
  bank_balance DECIMAL(15,2),
  reconciled_amount DECIMAL(15,2),
  difference DECIMAL(15,2),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled')),
  reconciled_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bank_id, reconciliation_date)
);

-- ============================================================================
-- 6. AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100),
  table_name VARCHAR(100),
  record_id BIGINT,
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id  ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at DESC);

-- ============================================================================
-- 7. ROW LEVEL SECURITY — per-user, strict isolation
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

DROP POLICY IF EXISTS "users_owner" ON users;
CREATE POLICY "users_owner" ON users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "banks_owner" ON banks;
CREATE POLICY "banks_owner" ON banks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "categories_owner" ON categories;
CREATE POLICY "categories_owner" ON categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_owner" ON transactions;
CREATE POLICY "transactions_owner" ON transactions
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "investments_owner" ON investments;
CREATE POLICY "investments_owner" ON investments
  FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "monthly_balances_owner" ON monthly_balances;
CREATE POLICY "monthly_balances_owner" ON monthly_balances
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_log_owner" ON audit_log;
CREATE POLICY "audit_log_owner" ON audit_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_balance_history_owner" ON bank_balance_history;
CREATE POLICY "bank_balance_history_owner" ON bank_balance_history
  FOR ALL USING (
    changed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  )
  WITH CHECK (
    changed_by = auth.uid()
    OR EXISTS (SELECT 1 FROM banks b WHERE b.id = bank_id AND b.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bank_reconciliation_owner" ON bank_reconciliation;
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
-- 8. handle_new_user trigger — seeds default categories on signup
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

-- ============================================================================
-- 9. HELPER VIEW
-- ============================================================================

CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  CAST(CAST(EXTRACT(YEAR FROM t.transaction_date) AS TEXT) || '-' ||
       LPAD(CAST(EXTRACT(MONTH FROM t.transaction_date) AS TEXT), 2, '0') || '-01' AS DATE) as month,
  t.transaction_type,
  b.id as bank_id,
  b.bank_name,
  SUM(CASE WHEN t.transaction_type = 'income'  THEN t.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN t.transaction_type = 'income'  THEN t.amount ELSE -t.amount END) as net_change
FROM transactions t
LEFT JOIN banks b ON t.bank_id = b.id
WHERE t.status = 'posted'
GROUP BY month, t.transaction_type, b.id, b.bank_name;

-- ============================================================================
-- 10. STORAGE (manual step in Supabase Studio)
-- ============================================================================
-- Storage → New bucket → name `receipts`, uncheck "Public bucket".
-- Add a Storage policy on `receipts`:
--   Allowed operations: SELECT, INSERT, UPDATE, DELETE
--   Target roles: authenticated
--   Policy definition: bucket_id = 'receipts'
