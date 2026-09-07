import { authorBio } from '@/lib/data';
import { HeroInner } from '../HeroInner';
import { AuthorParagraph } from './AuthorBio';

export const metadata = {
  title: 'Teja Surishetti · DILSe',
  description: 'Author | Storyteller — writing love, memory, and human emotion in Telugu and English.',
};

export default function AuthorPage() {
  return (
    <>
      <section className="relative h-[50vh] min-h-[400px] w-full flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/teja-hero.png" alt="Teja Surishetti" className="w-full h-full object-cover grayscale object-top" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <HeroInner heading="Teja Surishetti" sub="Author | Storyteller" />
      </section>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex justify-center gap-16 mb-16 border-y border-gray-200 py-8">
              <div className="text-center">
                <p className="font-serif text-4xl font-bold mb-2">10+</p>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Stories</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-4xl font-bold mb-2">9.5/10</p>
                <p className="text-sm text-gray-500 uppercase tracking-widest">Rating</p>
              </div>
            </div>

            <div className="leading-relaxed mx-auto text-justify space-y-8">
              {authorBio.map((p, i) => (
                <AuthorParagraph key={i} delay={i * 0.05}>{p}</AuthorParagraph>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
