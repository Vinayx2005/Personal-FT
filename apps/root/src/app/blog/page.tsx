import Link from 'next/link';
import { supabase, BlogPost } from '@/lib/supabase';

export const revalidate = 60;
export const metadata = {
  title: 'Writing · Crafted by Teja',
  description: 'Essays, notes, and thinking-out-loud from Teja.',
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
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted mb-4">Writing</p>
      <h1 className="text-4xl md:text-5xl font-black tracking-[-0.03em] mb-3">
        Thoughts, ideas and everything in between.
      </h1>
      <p className="text-[15px] text-ink2 mb-12">Essays, notes, and half-formed ideas.</p>

      {posts.length === 0 ? (
        <p className="text-muted text-sm">Nothing published yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group rounded-xl border border-line bg-card overflow-hidden hover:border-ink/30 transition-colors"
            >
              {p.cover_url ? (
                <img src={p.cover_url} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="aspect-[16/9] bg-gradient-to-br from-sky-200 via-slate-300 to-slate-500" />
              )}
              <div className="p-4">
                <p className="font-semibold leading-snug mb-2 group-hover:underline underline-offset-4">
                  {p.title}
                </p>
                {p.excerpt && <p className="text-[13px] text-ink2 leading-relaxed mb-3 line-clamp-2">{p.excerpt}</p>}
                <p className="text-[12px] text-muted">
                  {p.published_at &&
                    new Date(p.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
