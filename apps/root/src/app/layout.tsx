import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crafted by Teja',
  description: 'Writing, tools, and stories by Teja Surishetti.',
  metadataBase: new URL('https://craftedbyteja.com'),
  openGraph: {
    title: 'Crafted by Teja',
    description: 'Writing, tools, and stories by Teja Surishetti.',
    url: 'https://craftedbyteja.com',
    siteName: 'Crafted by Teja',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-18-border/60 bg-18-bg/80 backdrop-blur-sm sticky top-0 z-20">
            <nav className="max-w-4xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="bg-18-orange h-7 w-7 rounded-full flex items-center justify-center shadow-[0_0_18px_-4px_rgba(243,115,53,0.6)]">
                  <span className="text-white font-bold text-[10px]">CBT</span>
                </div>
                <span className="font-bold text-sm">Crafted by Teja</span>
              </Link>
              <div className="flex items-center gap-5 text-sm text-white/70">
                <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
                <a href="https://dilse.craftedbyteja.com" className="hover:text-white transition-colors">Dilse</a>
                <a href="https://tools.craftedbyteja.com" className="hover:text-white transition-colors">Tools</a>
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-18-border/60 mt-16">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-white/40">
              <span>© {new Date().getFullYear()} Teja Surishetti</span>
              <div className="flex items-center gap-4">
                <a href="https://dilse.craftedbyteja.com" className="hover:text-white transition-colors">Dilse</a>
                <a href="https://tools.craftedbyteja.com" className="hover:text-white transition-colors">Tools</a>
                <a href="https://pft.craftedbyteja.com" className="hover:text-white transition-colors">Personal FT</a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
