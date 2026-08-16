'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  ArrowRightLeft,
  MoreHorizontal,
} from 'lucide-react';

// Mobile-only bottom tab bar. Hidden on md+ where the floating sidebar
// still lives. Each tab covers a whole "section" of the app; sub-pages
// (income / expenses / investments / insights / reports) are reached
// via hub tiles inside the section rather than being tabs of their own.

interface Tab {
  href: string;
  label: string;
  icon: React.ElementType;
  // A pathname prefix that also counts as "this tab is active". Lets
  // e.g. /dashboard/insights highlight the Dashboard tab.
  activeWhenStartsWith?: string[];
}

const TABS: Tab[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    activeWhenStartsWith: ['/dashboard/insights', '/dashboard/reports'],
  },
  {
    href: '/dashboard/quick',
    label: 'Quick Add',
    icon: Zap,
  },
  {
    href: '/dashboard/entries',
    label: 'Entries',
    icon: ArrowRightLeft,
    activeWhenStartsWith: [
      '/dashboard/entries',
      '/dashboard/income',
      '/dashboard/expenses',
      '/dashboard/investments',
    ],
  },
  {
    href: '/dashboard/more',
    label: 'More',
    icon: MoreHorizontal,
    // Everything reachable from the More hub — Budgets, Banks, Categories,
    // Settings and Activity log — should highlight this tab.
    activeWhenStartsWith: [
      '/dashboard/budgets',
      '/dashboard/banks',
      '/dashboard/categories',
      '/dashboard/settings',
      '/dashboard/logs',
    ],
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (t: Tab) => {
    if (pathname === t.href) return true;
    if (!t.activeWhenStartsWith) return false;
    return t.activeWhenStartsWith.some((p) => pathname === p || pathname.startsWith(p + '/'));
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-18-surface/95 backdrop-blur-md border-t border-18-border"
      // Respect the iOS home-indicator safe area.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((t) => {
          const active = isActive(t);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px] transition-colors ${
                  active
                    ? 'text-18-orange'
                    : 'text-white/55 hover:text-white active:text-white'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span
                  className={`text-[10px] tracking-wide ${
                    active ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
