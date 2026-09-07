import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/md';

export const revalidate = 60;

interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  body_md: string;
  category: 'release' | 'tip' | 'insight' | null;
  cover_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
}

async function getPost(slug: string): Promise<BlogPost | null> {
  const { data } = await supabase
    .schema('blog')
    .from('posts')
    .select('id, slug, title, excerpt, body_md, category, cover_url, og_title, og_description, og_image_url, published_at')
    .eq('site', 'pft')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getPost(params.slug);
  if (!p) return { title: 'Not found · Personal FT' };
  return {
    title: `${p.og_title || p.title} · Personal FT`,
    description: p.og_description || p.excerpt || undefined,
    openGraph: {
      title: p.og_title || p.title,
      description: p.og_description || p.excerpt || undefined,
      images: p.og_image_url ? [{ url: p.og_image_url }] : undefined,
    },
  };
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();
  return (
    <article className="max-w-3xl mx-auto px-4 md:px-6 py-16">
      <Link href="/blogs" className="text-xs text-white/50 hover:text-white transition-colors">
        ← Back to blog
      </Link>
      {post.category && (
        <p className="mt-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-18-orange bg-18-orange/10 border border-18-orange/30 rounded-full px-2 py-0.5">
            {post.category === 'release' ? 'Release' : post.category === 'tip' ? 'Tip' : 'Insight'}
          </span>
        </p>
      )}
      <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-2 mb-3 leading-tight">
        {post.title}
      </h1>
      {post.published_at && (
        <p className="text-xs text-white/40 uppercase tracking-wider mb-8">
          {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {post.cover_url && <img src={post.cover_url} alt="" className="rounded-xl w-full mb-8" />}
      <div
        className="prose-crafted"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }}
      />
    </article>
  );
}
