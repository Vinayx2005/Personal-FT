-- ============================================================================
-- Personal FT — Investments module migration
-- ============================================================================
-- Renames `fixed_deposits` → `investments` and adds a `type` column so the
-- table can hold FDs, Smallcases, Stocks, Mutual Funds, and Others.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

DO $$
BEGIN
  -- 1. Rename the table if it still has the old name
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'fixed_deposits') THEN
    ALTER TABLE fixed_deposits RENAME TO investments;
  END IF;

  -- 2. Create the table if neither name exists (fresh install path)
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'investments') THEN
    CREATE TABLE investments (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'fd',
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
  END IF;
END $$;

-- 3. Add the `type` column if it doesn't exist yet (rename path)
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) NOT NULL DEFAULT 'fd';

-- 4. Add the CHECK constraint on type (idempotent — drop then create)
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_type_check;
ALTER TABLE investments
  ADD CONSTRAINT investments_type_check
  CHECK (type IN ('fd', 'smallcase', 'stocks', 'mutual_fund', 'others'));
