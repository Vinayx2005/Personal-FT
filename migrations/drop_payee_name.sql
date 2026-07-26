-- ============================================================================
-- Drop transactions.payee_name
-- ============================================================================
-- Personal finance has no third-party payee — the description column already
-- carries the merchant/counterparty when it matters.
-- Safe to run multiple times.

ALTER TABLE transactions DROP COLUMN IF EXISTS payee_name;
