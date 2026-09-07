import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/md';

export const revalidate = 60;
export const metadata = {
  title: 'Blog · Personal FT',
  description: 'Release notes, tips, and insights from Personal FT.',
};

// Post shape mirrors the CMS/root definition. Kept inline (small) to
// avoid pulling a shared package into the PFT app just for this.
interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  category: 'release' | 'tip' | 'insight' | null;
  cover_url: string | null;
  published_at: string | null;
}

async function getPosts(): Promise<BlogPost[]> {
  // Blog posts live in the `blog` schema, shared with root.
  const { data } = await supabase
    .schema('blog')
    .from('posts')
    .select('id, slug, title, excerpt, body_md, category, cover_url, published_at')
    .eq('site', 'pft')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  return (data || []) as BlogPost[];
}

const CATS: { key: 'all' | 'release' | 'tip' | 'insight'; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'release', label: 'Release notes' },
  { key: 'tip',     label: 'Tips' },
  { key: 'insight', label: 'Insights' },
];

export default async function BlogIndex({ searchParams }: { searchParams: { cat?: string } }) {
  const all = await getPosts();
  const cat = (searchParams?.cat || 'all') as 'all' | 'release' | 'tip' | 'insight';
  const filtered = cat === 'all' ? all : all.filter((p) => p.category === cat);
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
      <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">Blog</h1>
      <p className="text-sm text-white/60 mb-6">Release notes, tips, and general finance insights from Personal FT.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {CATS.map((c) => {
          const active = c.key === cat;
          return (
            <Link
              key={c.key}
              href={c.key === 'all' ? '/blogs' : `/blogs?cat=${c.key}`}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                active
                  ? 'bg-18-orange text-white border-18-orange'
                  : 'bg-18-surface text-white/60 border-18-border hover:text-white'
              }`}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-white/50 text-sm">Nothing here yet.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link
                href={`/blogs/${p.slug}`}
                className="block bg-18-surface border border-18-border rounded-xl p-4 hover:border-18-orange/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  {p.category && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-18-orange bg-18-orange/10 border border-18-orange/30 rounded-full px-2 py-0.5">
                      {p.category === 'release' ? 'Release' : p.category === 'tip' ? 'Tip' : 'Insight'}
                    </span>
                  )}
                </div>
                <p className="text-base font-bold text-white">{p.title}</p>
                {p.excerpt && <p className="text-sm text-white/60 mt-1 line-clamp-2">{p.excerpt}</p>}
                <p className="text-[10px] text-white/40 mt-2 uppercase tracking-wider">
                  {p.published_at && new Date(p.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
