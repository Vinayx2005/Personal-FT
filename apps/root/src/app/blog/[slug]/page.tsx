import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase, BlogPost } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/md';

export const revalidate = 60;

async function getPost(slug: string): Promise<BlogPost | null> {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('site', 'root')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  return (data as BlogPost | null) ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getPost(params.slug);
  if (!p) return { title: 'Not found · Crafted by Teja' };
  return {
    title: `${p.og_title || p.title} · Crafted by Teja`,
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
      <Link href="/blog" className="text-xs text-white/50 hover:text-white transition-colors">
        ← Back to blog
      </Link>
      <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight mt-4 mb-3 leading-tight">
        {post.title}
      </h1>
      {post.published_at && (
        <p className="text-xs text-white/40 uppercase tracking-wider mb-8">
          {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
      {post.cover_url && (
        <img src={post.cover_url} alt="" className="rounded-xl w-full mb-8" />
      )}
      <div
        className="prose-crafted"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }}
      />
    </article>
  );
}
