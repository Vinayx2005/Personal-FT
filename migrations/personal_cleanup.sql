-- ============================================================================
-- Personal FT — cleanup migration
-- ============================================================================
-- Run this in the Supabase SQL Editor ONLY IF you already ran the original
-- 18startup schema (supabase_schema.sql from the company version) on this
-- project. It drops the tables, columns, views, and seed rows for features
-- that don't exist in the personal version.
--
-- Safe to run multiple times — every step uses IF EXISTS.

-- 1. Drop views that depend on removed tables/columns
DROP VIEW IF EXISTS cash_position CASCADE;
DROP VIEW IF EXISTS gst_summary CASCADE;
DROP VIEW IF EXISTS monthly_summary CASCADE;

-- 2. Drop feature tables
DROP TABLE IF EXISTS expense_journal_entries CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS income_statement_line_categories CASCADE;
DROP TABLE IF EXISTS income_statement_lines CASCADE;
DROP TABLE IF EXISTS monthly_gst_reference CASCADE;
DROP TABLE IF EXISTS gst_tracking CASCADE;
DROP TABLE IF EXISTS invoice_line_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS company_profile CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;

-- 3. Drop tax + external-integration columns from transactions
ALTER TABLE transactions
  DROP COLUMN IF EXISTS gst_amount,
  DROP COLUMN IF EXISTS gst_type,
  DROP COLUMN IF EXISTS gst_rate,
  DROP COLUMN IF EXISTS tds_amount,
  DROP COLUMN IF EXISTS tds_rate,
  DROP COLUMN IF EXISTS tds_applicable,
  DROP COLUMN IF EXISTS external_id;

-- 4. Drop WhatsApp integration column from users
ALTER TABLE users
  DROP COLUMN IF EXISTS whatsapp_phone;

-- 5. Rebuild modules seed to match personal app's ModuleName enum
DELETE FROM module_access WHERE module_id IN (
  SELECT id FROM modules WHERE name IN (
    'expense_management','income_management','gst_reconciliation',
    'pnl_reports','invoice_management','bank_reconciliation',
    'payables_receivables','others'
  )
);
DELETE FROM modules WHERE name IN (
  'expense_management','income_management','gst_reconciliation',
  'pnl_reports','invoice_management','bank_reconciliation',
  'payables_receivables','others'
);
INSERT INTO modules (name, description) VALUES
  ('dashboard',    'View dashboard KPIs'),
  ('expenses',     'Add, edit, and manage expenses'),
  ('income',       'Add, edit, and manage income'),
  ('reports',      'View reports and analytics'),
  ('settings',     'App settings'),
  ('activity_log', 'View the activity log')
ON CONFLICT (name) DO NOTHING;

-- 6. Rebuild monthly_summary view without GST
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

-- 7. Storage: manually delete the `company-assets` bucket in Supabase Studio
--    if you previously created it (it stored invoice logos/signatures).
--    The `receipts` bucket is still used and should be kept.
