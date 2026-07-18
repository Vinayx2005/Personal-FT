-- ============================================================================
-- Teja's Finance Tracker — Personal schema (solo-user)
-- ============================================================================
-- Run this once in Supabase SQL Editor to set up the database from scratch.
--
-- If you previously ran an older company (18startup) schema on this project,
-- run migrations/personal_cleanup.sql AND migrations/personal_solo_user.sql
-- BEFORE this file. Together they drop features/tables that no longer exist.

-- ============================================================================
-- 1. USERS
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
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(type, name)
);

-- Personal-life category defaults
INSERT INTO categories (type, name, is_default) VALUES
  ('expense', 'Food & Groceries', TRUE),
  ('expense', 'Rent', TRUE),
  ('expense', 'Utilities', TRUE),
  ('expense', 'Transport', TRUE),
  ('expense', 'Entertainment', TRUE),
  ('expense', 'Healthcare', TRUE),
  ('expense', 'Shopping', TRUE),
  ('expense', 'Education', TRUE),
  ('expense', 'Personal Care', TRUE),
  ('expense', 'Travel', TRUE),
  ('expense', 'Subscriptions', TRUE),
  ('expense', 'Self Transfer', TRUE),
  ('expense', 'Others', TRUE),
  ('income',  'Salary', TRUE),
  ('income',  'Freelance', TRUE),
  ('income',  'Interest', TRUE),
  ('income',  'Refund', TRUE),
  ('income',  'Others', TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS monthly_balances (
  id BIGSERIAL PRIMARY KEY,
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
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_group ON transactions(transfer_group_id);

-- ============================================================================
-- 4. INVESTMENTS (FDs, Smallcases, Stocks, Mutual Funds, Others)
-- ============================================================================

CREATE TABLE IF NOT EXISTS investments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'fd'
    CHECK (type IN ('fd', 'smallcase', 'stocks', 'mutual_fund', 'others')),
  amount DECIMAL(15,2) NOT NULL,
  source_bank_id BIGINT REFERENCES banks(id),
  start_date DATE,
  maturity_date DATE,
  interest_rate DECIMAL(6,3),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
  user_id UUID REFERENCES users(id),
  action VARCHAR(100),
  table_name VARCHAR(100),
  record_id BIGINT,
  description TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- 7. ROW LEVEL SECURITY (solo user)
-- ============================================================================
-- Users table: own-row only. All other tables: any authenticated user has
-- full access (single-user personal setup). Supabase Studio may prompt to
-- enable RLS on any table — with permissive policies in place, that toggle
-- becomes safe.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_reconciliation ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_authenticated_own" ON users;
CREATE POLICY "users_authenticated_own" ON users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "transactions_authenticated" ON transactions;
CREATE POLICY "transactions_authenticated" ON transactions
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bank_reconciliation_authenticated" ON bank_reconciliation;
CREATE POLICY "bank_reconciliation_authenticated" ON bank_reconciliation
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "categories_authenticated" ON categories;
CREATE POLICY "categories_authenticated" ON categories
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "banks_authenticated" ON banks;
CREATE POLICY "banks_authenticated" ON banks
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "bank_balance_history_authenticated" ON bank_balance_history;
CREATE POLICY "bank_balance_history_authenticated" ON bank_balance_history
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "investments_authenticated" ON investments;
CREATE POLICY "investments_authenticated" ON investments
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "monthly_balances_authenticated" ON monthly_balances;
CREATE POLICY "monthly_balances_authenticated" ON monthly_balances
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "audit_log_authenticated" ON audit_log;
CREATE POLICY "audit_log_authenticated" ON audit_log
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 8. HELPER VIEW
-- ============================================================================

CREATE OR REPLACE VIEW monthly_summary AS
SELECT
  CAST(CAST(EXTRACT(YEAR FROM t.transaction_date) AS TEXT) || '-' ||
       LPAD(CAST(EXTRACT(MONTH FROM t.transaction_date) AS TEXT), 2, '0') || '-01' AS DATE) as month,
  t.transaction_type,
  b.id as bank_id,
  b.bank_name,
  SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN t.transaction_type = 'expense' THEN t.amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN t.transaction_type = 'income' THEN t.amount ELSE -t.amount END) as net_change
FROM transactions t
LEFT JOIN banks b ON t.bank_id = b.id
WHERE t.status = 'posted'
GROUP BY month, t.transaction_type, b.id, b.bank_name;

-- ============================================================================
-- 9. STORAGE BUCKET (manual step in Supabase Studio)
-- ============================================================================
-- Storage → New bucket → name `receipts`, uncheck "Public bucket".
-- Add a Storage policy on `receipts`:
--   Allowed operations: SELECT, INSERT, UPDATE, DELETE
--   Target roles: authenticated
--   Policy definition:  bucket_id = 'receipts'

-- ============================================================================
-- DONE
-- ============================================================================
