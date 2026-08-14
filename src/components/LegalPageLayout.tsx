// Shared shell for the /privacy, /terms, /refund pages so their spacing +
// typography + header + footer stay in sync. Keeps the individual page
// files focused on content.
//
// Prose is styled inline (Tailwind arbitrary classes) rather than via a
// prose plugin so we don't add a dependency for three pages.

import Link from 'next/link';

interface Props {
  title: string;
  updatedOn: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, updatedOn, children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-18-bg text-white font-lato flex flex-col">
      {/* Header */}
      <header className="border-b border-18-border/50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(243,115,53,0.6)] group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-[10px]">PFT</span>
            </div>
            <span className="text-white font-bold">Personal FT</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
          <p className="text-xs uppercase tracking-widest font-bold text-18-orange mb-3">
            Personal FT
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
            {title}
          </h1>
          <p className="text-sm text-white/50 mt-3">Last updated: {updatedOn}</p>

          {/* Content — children are styled here so the pages just write JSX */}
          <div
            className="mt-8 space-y-6 text-[15px] leading-relaxed text-white/80
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3
              [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-white [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:my-3
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:my-3
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2 [&_ol]:my-3
              [&_li]:text-white/80
              [&_a]:text-18-orange [&_a]:underline [&_a:hover]:brightness-125
              [&_strong]:text-white [&_strong]:font-semibold"
          >
            {children}
          </div>
        </article>
      </main>

      {/* Footer — mirror of the landing footer, kept simple */}
      <footer className="border-t border-18-border/50">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <div className="bg-18-orange rounded-full h-5 w-5 flex items-center justify-center">
              <span className="text-white font-bold text-[9px]">PFT</span>
            </div>
            <span>Personal FT</span>
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/refund" className="hover:text-white transition-colors">Refund</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
