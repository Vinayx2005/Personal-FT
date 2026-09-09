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
    <article className="max-w-2xl mx-auto px-5 md:px-8 py-16">
      <Link href="/blog" className="text-[13px] text-muted hover:text-ink transition-colors">
        ← Back to writing
      </Link>
      <h1 className="text-3xl md:text-5xl font-black tracking-[-0.03em] mt-5 mb-3 leading-[1.1]">
        {post.title}
      </h1>
      {post.published_at && (
        <p className="text-[12px] text-muted mb-9">
          {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      )}
      {post.cover_url && <img src={post.cover_url} alt="" className="rounded-xl w-full mb-9" />}
      <div className="prose-crafted" dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body_md) }} />
    </article>
  );
}
