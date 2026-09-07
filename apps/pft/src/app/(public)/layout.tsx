import Link from 'next/link';

// Public-route shell for /blogs. Distinct from the dashboard shell —
// no auth check, minimal header, marketing tone. Sits under the route
// group `(public)` so the pft app's default auth-required layout in
// /dashboard/* is bypassed for these routes.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-18-bg text-white">
      <header className="border-b border-18-border/60 bg-18-bg/80 backdrop-blur-sm sticky top-0 z-20">
        <nav className="max-w-3xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <Link href="/blogs" className="flex items-center gap-2">
            <div className="bg-18-orange h-7 w-7 rounded-full flex items-center justify-center shadow-[0_0_18px_-4px_rgba(243,115,53,0.6)]">
              <span className="text-white font-bold text-[10px]">PFT</span>
            </div>
            <span className="font-bold text-sm">Personal FT · Blog</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <Link href="/" className="hover:text-white transition-colors">Open the app →</Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-18-border/60 mt-16">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 text-xs text-white/40 flex flex-wrap gap-3 justify-between">
          <span>© {new Date().getFullYear()} Personal FT</span>
          <div className="flex items-center gap-4">
            <a href="https://craftedbyteja.com" className="hover:text-white">craftedbyteja.com</a>
            <Link href="/" className="hover:text-white">The app</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
