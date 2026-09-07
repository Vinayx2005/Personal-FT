import { createClient } from '@supabase/supabase-js';

// Public anon client — RLS only exposes published rows to anon users.
// Server-side reads on RSC use the same anon client; no service-role
// key ever ships to the client bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Pinned to the `blog` schema. .from('posts') → blog.posts.
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  db:   { schema: 'blog' },
});

export interface BlogPost {
  id: number;
  site: 'root' | 'pft';
  category: 'release' | 'tip' | 'insight' | null;
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
  created_at: string;
  updated_at: string;
}
