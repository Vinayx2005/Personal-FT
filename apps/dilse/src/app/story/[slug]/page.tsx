import Link from 'next/link';
import { supabase, Story } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/md';
import { BackLink, ScrollBar, ShareOnWhatsApp } from './StoryReader';

export const revalidate = 60;

type PageProps = { params: { slug: string } };

async function loadStory(slug: string): Promise<Story | null> {
  const { data } = await supabase
    .from('stories')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .maybeSingle();
  return (data as Story | null) ?? null;
}

export async function generateMetadata({ params }: PageProps) {
  const s = await loadStory(params.slug);
  if (!s) return { title: 'Story not found · DILSe' };
  return {
    title: `${s.og_title || s.title} · DILSe`,
    description: s.og_description || s.excerpt || undefined,
    openGraph: {
      title: s.og_title || s.title,
      description: s.og_description || s.excerpt || undefined,
      images: s.og_image_url ? [s.og_image_url] : undefined,
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const s = await loadStory(params.slug);
  if (!s) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-4xl font-bold mb-6">Story not found</h1>
        <Link href="/short-stories" className="rounded-full px-8 h-10 border border-black inline-flex items-center hover:bg-black hover:text-white">
          Back to Stories
        </Link>
      </div>
    );
  }

  const date = s.date_display || (s.published_at ? new Date(s.published_at).toLocaleDateString('en-IN') : '');
  const readTime = s.read_time || '';

  return (
    <>
      <ScrollBar />
      <article className="bg-white min-h-screen py-20">
        <div className="container mx-auto px-6 max-w-[680px]">
          <BackLink />
          <header className="mb-16 text-center flex flex-col items-center">
            <div className="flex items-center gap-4 text-sm text-gray-500 font-serif uppercase tracking-widest mb-8">
              {date && <span>{date}</span>}
              {date && readTime && <span>•</span>}
              {readTime && <span>{readTime}</span>}
            </div>
            <h1 className="font-serif text-5xl md:text-6xl font-bold leading-tight mb-8">{s.title}</h1>
            <div className="w-16 h-px bg-black mb-12" />
          </header>

          <div className="dilse-prose" dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body_md || '') }} />

          <ShareOnWhatsApp title={s.title} />
        </div>
      </article>
    </>
  );
}
