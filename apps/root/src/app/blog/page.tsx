import Link from 'next/link';
import { supabase, BlogPost } from '@/lib/supabase';

export const revalidate = 60;
export const metadata = {
  title: 'Blog · Crafted by Teja',
  description: 'Essays, notes, and thinking-out-loud from Teja Surishetti.',
};

async function getPosts(): Promise<BlogPost[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('site', 'root')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  return (data || []) as BlogPost[];
}

export default async function BlogIndex() {
  const posts = await getPosts();
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-16">
      <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">Blog</h1>
      <p className="text-sm text-white/60 mb-10">Essays, notes, and half-formed ideas.</p>
      {posts.length === 0 ? (
        <p className="text-white/50 text-sm">Nothing published yet.</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/blog/${p.slug}`}
                className="block bg-18-surface border border-18-border rounded-xl p-4 hover:border-18-orange/40 transition-colors"
              >
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
