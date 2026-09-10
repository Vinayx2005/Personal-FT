import { supabase, Book } from '@/lib/supabase';
import { HeroInner } from '../HeroInner';

export const revalidate = 60;

export const metadata = {
  title: 'Books · DILSe',
  description: 'Books by Teja Surishetti — Aksharaala Nuvve and more.',
};

async function getBooks(): Promise<Book[]> {
  const { data } = await supabase
    .from('books')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false });
  return (data || []) as Book[];
}

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <>
      <section className="relative h-[50vh] min-h-[400px] w-full overflow-hidden flex items-end">
        <div className="absolute inset-0 z-0">
          <img src="/teja-hero.png" alt="Teja Surishetti" className="h-full w-full object-cover object-top grayscale" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <HeroInner
          heading="Books"
          sub="Long-form stories bound in paper — where a moment stretches into a life. Each one written from the heart, in Telugu and English."
        />
      </section>

      <section className="bg-white py-24">
        <div className="container mx-auto px-6 sm:px-[50px] max-w-7xl space-y-24">
          {books.length === 0 ? (
            <p className="text-center text-gray-500 font-serif">No books yet.</p>
          ) : books.map((book) => (
            <div key={book.id} className="mx-auto flex max-w-6xl flex-col gap-16 lg:flex-row lg:items-start">
              <div className="w-full flex-shrink-0 lg:w-1/3">
                <img
                  src={book.cover_url || '/aksharaala-nuvve.jpg'}
                  alt={`${book.title} cover`}
                  className="mx-auto w-full max-w-[360px] rounded-sm"
                />
              </div>
              <div className="w-full lg:w-3/5 flex flex-col gap-8">
                <div className="flex items-center gap-4 border-b border-gray-200 pb-4 font-serif text-sm uppercase tracking-widest text-gray-500">
                  {book.date_display && <><span>Published: {book.date_display}</span><span>•</span></>}
                  {book.genre && <span>{book.genre}</span>}
                </div>
                <div>
                  <h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">{book.title}</h2>
                  {book.description && (
                    <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-gray-700">{book.description}</p>
                  )}
                </div>
                {book.body_md && (
                  <div className="dilse-prose max-w-none">
                    {book.body_md.split(/\n\n+/).map((p) => <p key={p}>{p}</p>)}
                  </div>
                )}
                {book.buying_link && (
                  <div className="flex flex-wrap gap-4 pt-2">
                    <a href={book.buying_link} target="_blank" rel="noreferrer"
                       className="rounded-full bg-black px-8 h-11 font-serif text-white hover:bg-gray-800 inline-flex items-center">
                      Buy Now
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
