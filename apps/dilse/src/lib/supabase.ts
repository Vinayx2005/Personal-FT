import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client pinned to the `dilse` schema. All .from('stories') / .from('books')
// calls hit dilse.stories / dilse.books.
// If the DB migration hasn't run yet, expect empty state on the page (queries
// silently return no rows). Run migrations/create_content_tables.sql +
// migrations/seed_dilse_content.sql and add `dilse` to Supabase → Exposed
// schemas to bring content back.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  db:   { schema: 'dilse' },
});

export interface Story {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  cover_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  author_email: string | null;
  read_time: string | null;      // "5 min read"
  genre: string | null;          // "Love", "Suspense"
  date_display: string | null;   // "6/11/2026" free-text display date
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: number;
  slug: string;
  title: string;
  description: string | null;    // short blurb on cards
  body_md: string;               // longer synopsis
  cover_url: string | null;
  buying_link: string | null;
  date_display: string | null;   // "19 December 2025"
  genre: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
}
