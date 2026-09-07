import Link from 'next/link';
import { supabase, Story, Book } from '@/lib/supabase';
import { StoryCard } from './StoryCard';
import { HeroInner } from './HeroInner';

export const revalidate = 60;

async function getData() {
  const [{ data: stories }, { data: books }] = await Promise.all([
    supabase
      .from('stories')
      .select('*')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(6),
    supabase
      .from('books')
      .select('*')
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(1),
  ]);
  return {
    stories: (stories || []) as Story[],
    book:    (books?.[0] as Book | undefined) ?? null,
  };
}

export default async function Home() {
  const { stories, book } = await getData();
  const cards = stories.map((s) => ({
    slug: s.slug,
    title: s.title,
    excerpt: s.excerpt || '',
    date: s.date_display || (s.published_at ? new Date(s.published_at).toLocaleDateString('en-IN') : ''),
    readTime: s.read_time || '',
  }));

  return (
    <>
      <section className="relative h-[75vh] min-h-[500px] w-full flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/teja-hero-home.png"
            alt="Teja Surishetti"
            className="w-full h-full object-cover grayscale"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <HeroInner
          heading="The Essence Of My Memories & Beliefs…"
          sub="Explore the kaleidoscope of emotions. Each story carries a piece of my heart, justifying the title Dilse."
        />
      </section>

      <section className="py-24 bg-white">
        <div className="container mx-auto px-[50px] max-w-7xl">
          <div className="flex justify-between items-end mb-16 border-b border-black pb-6">
            <h2 className="font-serif md:text-5xl font-bold tracking-tight text-[32px]">Short Stories</h2>
            <Link href="/short-stories" className="text-gray-500 hover:text-black hover:underline underline-offset-4 transition-colors">
              View All
            </Link>
          </div>
          {cards.length === 0 ? (
            <p className="text-gray-500 font-serif">No stories yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
              {cards.map((s) => <StoryCard key={s.slug} {...s} />)}
            </div>
          )}
        </div>
      </section>

      {book && (
        <section className="py-24 bg-gray-50">
          <div className="container mx-auto px-[50px] max-w-7xl">
            <div className="flex justify-between items-end mb-16 border-b border-black pb-6">
              <h2 className="font-serif md:text-5xl font-bold tracking-tight text-[32px]">Books</h2>
              <Link href="/books" className="text-gray-500 hover:text-black hover:underline underline-offset-4 transition-colors">
                Discover
              </Link>
            </div>
            <div className="flex flex-col md:flex-row gap-12 items-center max-w-5xl mx-auto">
              <div className="w-full md:w-1/3 aspect-[3/4] flex items-center justify-center">
                <img
                  src={book.cover_url || '/aksharaala-nuvve.jpg'}
                  alt={`${book.title} cover`}
                  className="h-full w-full object-cover rounded-[10px]"
                />
              </div>
              <div className="w-full md:w-2/3 flex flex-col gap-6">
                <h3 className="font-serif font-bold text-[24px]">{book.title}</h3>
                {book.description && <p className="text-gray-600 text-[16px]">{book.description}</p>}
                <div>
                  <Link
                    href="/books"
                    className="inline-flex h-8 rounded-full px-8 border border-black text-black hover:bg-black hover:text-white transition-colors items-center"
                  >
                    Read More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
