import { supabase, Story } from '@/lib/supabase';
import { StoryCard } from '../StoryCard';
import { HeroInner } from '../HeroInner';

export const revalidate = 60;

export const metadata = {
  title: 'Short Stories · DILSe',
  description: 'A collection of short stories written from the heart by Teja Surishetti.',
};

async function getStories(): Promise<Story[]> {
  const { data } = await supabase
    .from('stories')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  return (data || []) as Story[];
}

export default async function ShortStoriesPage() {
  const rows = await getStories();
  const cards = rows.map((s) => ({
    slug: s.slug,
    title: s.title,
    excerpt: s.excerpt || '',
    date: s.date_display || (s.published_at ? new Date(s.published_at).toLocaleDateString('en-IN') : ''),
    readTime: s.read_time || '',
  }));

  return (
    <>
      <section className="relative h-[50vh] min-h-[400px] w-full flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/teja-hero.png" alt="Teja Surishetti" className="w-full h-full object-cover grayscale object-top" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <HeroInner heading="Short Stories" />
      </section>
      <section className="py-24 bg-white">
        <div className="container mx-auto px-[50px] max-w-7xl">
          {cards.length === 0 ? (
            <p className="text-center text-gray-500 font-serif">No stories yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
              {cards.map((s) => <StoryCard key={s.slug} {...s} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
