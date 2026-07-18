# Teja's Finance Tracker (Personal FT)

A personal finance tracker for daily expenses and income. Built on Next.js 14 (App Router) + Supabase.

## Features

- Dashboard with income, expenses, net, and per-bank balances
- Expenses & Income modules with CSV import and receipt attachments
- Reports: monthly PnL trend, category breakdown, Excel/PDF export
- Settings: manage banks, categories, fixed deposits, users
- Activity log for every add/edit/delete/import/export

## Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

## Setup

### 1. Install dependencies

```
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and:
   - **Fresh project?** Run `supabase_schema.sql`.
   - **Previously ran the old company schema?** Run `migrations/personal_cleanup.sql` first, then `supabase_schema.sql` (the personal schema is idempotent — it will only add what's missing).
3. Create a Storage bucket called `receipts` (private). Add a policy that allows all operations to `authenticated` users on `bucket_id = 'receipts'`.
4. **Authentication → Users → Add user** — create your own account. Copy the new user's UUID.
5. In SQL Editor, insert yourself into the app's `users` table and grant admin:

   ```sql
   INSERT INTO users (id, email, full_name, role_id)
   VALUES (
     '<paste-auth-user-uuid-here>',
     'you@example.com',
     'Your Name',
     (SELECT id FROM roles WHERE name = 'admin')
   );
   ```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Settings → API → anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → service_role key (keep secret, never commit)

### 4. Run

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with the account you created.

## Adding a bank

Once signed in: **Settings → Banks → Add Bank**. Add at least one bank before you start recording transactions.

## Notes

- `.env.local` is gitignored — safe to keep secrets there.
- The `18-*` Tailwind color prefix (e.g. `bg-18-orange`) is legacy naming from the original codebase; it's just class names, not visible branding.
- Only one user is expected (you). The `users` / `roles` / `module_access` tables exist because the RLS policies use them — leaving them alone is fine.
