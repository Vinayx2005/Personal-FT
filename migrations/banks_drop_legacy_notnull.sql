-- The banks table was originally defined with account_number, account_holder,
-- and ifsc_code as NOT NULL. The app UI has since been simplified to only
-- collect bank_name + opening_balance, so INSERTs now hit a NOT NULL error
-- on the legacy columns. Drop the constraints so those columns can just stay
-- NULL for new rows. Existing rows are untouched.
--
-- To run: paste into Supabase SQL editor and execute.

alter table public.banks
  alter column account_number drop not null,
  alter column account_holder drop not null,
  alter column ifsc_code      drop not null;
