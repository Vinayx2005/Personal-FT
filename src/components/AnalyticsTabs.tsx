'use client';

// Three-way sub-navigation for the analytics section — Dashboard,
// Insights, Reports. Same static bar renders on all three pages so
// switching between them is one tap regardless of where you started.
// Design mirrors the Entries filter-chip style (pill + orange fill for
// active) to stay consistent with the rest of the app.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
  // Extra paths that should keep this tab lit (empty here — each of the
  // three pages has its own exact route with no sub-routes).
  matchExact?: boolean;
};

const TABS: Tab[] = [
  { href: '/dashboard',          label: 'Dashboard' },
  { href: '/dashboard/insights', label: 'Insights' },
  { href: '/dashboard/reports',  label: 'Reports' },
];

export default function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    // Mobile-only: desktop already has direct links to all three pages
    // in the left sidebar (Insights section), so a duplicate pill row
    // would just eat vertical space above the content.
    <div
      className="md:hidden flex items-center gap-1 bg-18-surface border border-18-border rounded-full p-1"
      role="tablist"
      aria-label="Analytics section"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active}
            className={`flex-1 text-center px-3 py-2 rounded-full text-xs sm:text-sm font-bold transition-colors ${
              active
                ? 'bg-18-orange text-white shadow-[0_4px_12px_-4px_rgba(243,115,53,0.6)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
