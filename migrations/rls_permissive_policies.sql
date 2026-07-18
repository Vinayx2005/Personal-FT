-- ============================================================================
-- Permissive RLS policies for solo-user tables
-- ============================================================================
-- Adds a "any signed-in user has full access" policy to tables that are not
-- per-user-scoped. Solves the situation where Supabase Studio's "Enable RLS"
-- prompt was clicked on a table but no policy was added alongside, so all
-- writes fail with "row-level security policy" errors.
--
-- Safe to run multiple times.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'categories',
    'banks',
    'bank_balance_history',
    'investments',
    'monthly_balances',
    'audit_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip if the table doesn't exist yet (e.g. investments before rename)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated" ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY "%s_authenticated" ON %I FOR ALL '
        'USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        t, t
      );
    END IF;
  END LOOP;
END $$;
