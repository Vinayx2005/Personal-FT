-- Content tables — power craftedbyteja.com (root blog),
-- pft.craftedbyteja.com/blogs, and dilse.craftedbyteja.com.
-- Written to CMS at cms.craftedbyteja.com, read publicly by the other apps.
--
-- Schema layout (matches the "schema per app-domain" convention):
--   blog.posts     — root + pft blog posts, distinguished by `site` column
--   dilse.stories  — dilse short stories
--   public.*       — PFT's existing tables (unchanged; not moved)
--
-- Safe to re-run. Paste into Supabase SQL editor.

-- ─── Schemas ───────────────────────────────────────────────────────────
create schema if not exists blog;
create schema if not exists dilse;

-- Anon + authenticated need USAGE on the schema to read/write via PostgREST.
grant usage on schema blog  to anon, authenticated;
grant usage on schema dilse to anon, authenticated;

-- Supabase PostgREST needs the schema in its exposed list. Do this once
-- in the Supabase dashboard: API settings → "Exposed schemas" → add
-- `blog` and `dilse` alongside `public`. Without that step the anon
-- REST endpoint will 404 on these tables even though the SQL exists.

-- ─── blog.posts ────────────────────────────────────────────────────────
create table if not exists blog.posts (
  id             bigserial primary key,
  site           text not null check (site in ('root', 'pft')),
  category       text check (category in ('release', 'tip', 'insight')),
  slug           text not null,
  title          text not null,
  excerpt        text,
  body_md        text not null default '',
  cover_url      text,
  og_title       text,
  og_description text,
  og_image_url   text,
  published_at   timestamptz,
  author_email   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (site, slug)
);
create index if not exists posts_site_pub_idx
  on blog.posts(site, published_at desc)
  where published_at is not null;

grant select, insert, update, delete on blog.posts to authenticated;
grant select                        on blog.posts to anon;
grant usage, select on sequence blog.posts_id_seq to authenticated;

-- ─── dilse.stories ─────────────────────────────────────────────────────
create table if not exists dilse.stories (
  id             bigserial primary key,
  slug           text not null unique,
  title          text not null,
  excerpt        text,
  body_md        text not null default '',
  cover_url      text,
  og_title       text,
  og_description text,
  og_image_url   text,
  published_at   timestamptz,
  author_email   text,
  -- Dilse-specific display fields (ported from the original repo)
  read_time      text,           -- "5 min read"
  genre          text,           -- "Love", "Suspense"
  date_display   text,           -- "6/11/2026" free-text display date
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists stories_pub_idx
  on dilse.stories(published_at desc)
  where published_at is not null;

grant select, insert, update, delete on dilse.stories to authenticated;
grant select                         on dilse.stories to anon;
grant usage, select on sequence dilse.stories_id_seq to authenticated;

-- ─── dilse.books ───────────────────────────────────────────────────────
create table if not exists dilse.books (
  id             bigserial primary key,
  slug           text not null unique,
  title          text not null,
  description    text,             -- short one-liner shown on the card
  body_md        text not null default '',  -- longer synopsis / excerpt
  cover_url      text,
  buying_link    text,
  date_display   text,             -- "19 December 2025"
  genre          text,             -- "Novel", "Short story collection"
  og_title       text,
  og_description text,
  og_image_url   text,
  published_at   timestamptz,
  author_email   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists books_pub_idx
  on dilse.books(published_at desc)
  where published_at is not null;

grant select, insert, update, delete on dilse.books to authenticated;
grant select                         on dilse.books to anon;
grant usage, select on sequence dilse.books_id_seq to authenticated;

-- ─── Shared updated_at trigger (lives in public, referenced by both) ──
create or replace function public.content_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists posts_set_updated_at on blog.posts;
create trigger posts_set_updated_at before update on blog.posts
  for each row execute function public.content_set_updated_at();

drop trigger if exists stories_set_updated_at on dilse.stories;
create trigger stories_set_updated_at before update on dilse.stories
  for each row execute function public.content_set_updated_at();

drop trigger if exists books_set_updated_at on dilse.books;
create trigger books_set_updated_at before update on dilse.books
  for each row execute function public.content_set_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────
alter table blog.posts     enable row level security;
alter table dilse.stories  enable row level security;
alter table dilse.books    enable row level security;

-- Public read for PUBLISHED rows only. Drafts are invisible to anon.
drop policy if exists "posts_public_read" on blog.posts;
create policy "posts_public_read" on blog.posts
  for select using (published_at is not null and published_at <= now());

drop policy if exists "stories_public_read" on dilse.stories;
create policy "stories_public_read" on dilse.stories
  for select using (published_at is not null and published_at <= now());

drop policy if exists "books_public_read" on dilse.books;
create policy "books_public_read" on dilse.books
  for select using (published_at is not null and published_at <= now());

-- Author allowlist — full CRUD (drafts included) for these emails.
drop policy if exists "posts_author_all" on blog.posts;
create policy "posts_author_all" on blog.posts
  for all using (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  ) with check (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  );

drop policy if exists "stories_author_all" on dilse.stories;
create policy "stories_author_all" on dilse.stories
  for all using (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  ) with check (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  );

drop policy if exists "books_author_all" on dilse.books;
create policy "books_author_all" on dilse.books
  for all using (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  ) with check (
    (auth.jwt() ->> 'email') = 'vinayteja23@gmail.com'
  );
