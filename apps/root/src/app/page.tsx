import Link from 'next/link';
import { ArrowRight, PenLine, Wrench, BookOpen } from 'lucide-react';
import { supabase, BlogPost } from '@/lib/supabase';

export const revalidate = 60; // ISR — re-fetch published list every 60s

async function getRecentPosts(): Promise<BlogPost[]> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('site', 'root')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3);
  return (data || []) as BlogPost[];
}

export default async function HomePage() {
  const recent = await getRecentPosts();
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-24">
      {/* Hero */}
      <section className="mb-20">
        <p className="text-xs font-bold uppercase tracking-widest text-18-orange mb-4">
          Crafted by Teja
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.05] mb-6">
          Product builder,{' '}
          <span className="text-18-orange italic">writer</span>, and quiet
          tinkerer.
        </h1>
        <p className="text-lg text-white/70 leading-relaxed max-w-2xl">
          I build small tools I actually use, and I write stories in Hindi
          under <a href="https://dilse.craftedbyteja.com" className="text-18-orange hover:underline">Dilse</a>.
          This is the home for both.
        </p>
      </section>

      {/* Surfaces */}
      <section className="mb-20">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">
          Where the work lives
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Surface
            href="/blog"
            title="Blog"
            sub="Thinking out loud"
            icon={PenLine}
          />
          <Surface
            href="https://dilse.craftedbyteja.com"
            title="Dilse"
            sub="Stories from the heart"
            icon={BookOpen}
          />
          <Surface
            href="https://tools.craftedbyteja.com"
            title="Tools"
            sub="Small things I built"
            icon={Wrench}
          />
        </div>
      </section>

      {/* Recent posts */}
      {recent.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
              Recent writing
            </p>
            <Link
              href="/blog"
              className="text-xs font-semibold text-18-orange hover:underline"
            >
              All posts →
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="block bg-18-surface border border-18-border rounded-xl p-4 hover:border-18-orange/40 transition-colors"
              >
                <p className="text-sm font-semibold text-white">{p.title}</p>
                {p.excerpt && (
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">
                    {p.excerpt}
                  </p>
                )}
                <p className="text-[10px] text-white/40 mt-2 uppercase tracking-wider">
                  {p.published_at && new Date(p.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Surface({
  href,
  title,
  sub,
  icon: Icon,
}: {
  href: string;
  title: string;
  sub: string;
  icon: React.ElementType;
}) {
  const external = href.startsWith('http');
  const cls =
    'group bg-18-surface border border-18-border rounded-xl p-4 hover:border-18-orange/40 transition-colors block';
  const inner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-18-orange/10 border border-18-orange/30 flex items-center justify-center">
          <Icon size={16} className="text-18-orange" />
        </div>
        <ArrowRight
          size={14}
          className="text-white/30 group-hover:text-18-orange group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-white/50 mt-0.5">{sub}</p>
    </>
  );
  return external ? (
    <a href={href} className={cls}>{inner}</a>
  ) : (
    <Link href={href} className={cls}>{inner}</Link>
  );
}
