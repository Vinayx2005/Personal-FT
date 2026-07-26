# Personal FT

**Know where your money goes. Feel calm about it.**

A finance tracker for young professionals who want to see their spending leaks without linking a bank account. Multi-user SaaS built on Next.js 14 (App Router) + Supabase.

## Features

- **Quick Add** — 4-line format, log an expense in <10 seconds. Installable as a PWA on your phone.
- Dashboard with income, expenses, net, and per-bank balances
- Expenses & Income with CSV import and receipt attachments
- Investments tracker (FD / Smallcase / Stocks / Mutual Fund / Others)
- Reports: monthly PnL trend + category breakdown + Excel/PDF export
- Settings: manage banks, categories
- Activity log for every add/edit/delete/import/export
- Multi-user with strict per-user data isolation via Postgres RLS
- Auto-seeded default categories on signup

## Prerequisites

- Node.js 18+
- A Supabase project (free tier)

## Setup

### 1. Install

```
npm install
```

### 2. Supabase

1. Create a new Supabase project.
2. **SQL Editor** → run `supabase_schema.sql` (fresh install).
   *If you're upgrading from an older solo-user version, run the files in `migrations/` in numeric order first.*
3. **Storage → New bucket** → name `receipts`, uncheck "Public bucket".
   Add a Storage policy: allowed operations SELECT/INSERT/UPDATE/DELETE, target roles `authenticated`, definition `bucket_id = 'receipts'`.
4. **Authentication → Email templates** → confirm your sender email is set.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in the Supabase values from Settings → API.

### 4. Run

```
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) → click **Create an account**.

## For end users

Sign up on the landing page → verify your email → land on the dashboard → add a bank in Settings → start logging expenses via `/quick` or the Expenses tab.

## Notes

- `.env.local` is gitignored — safe to keep secrets there.
- The `18-*` Tailwind color prefix is legacy naming; harmless (just class names).
- Every table has per-user Row Level Security — users cannot see each other's data.
