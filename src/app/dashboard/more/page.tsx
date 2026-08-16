'use client';

// "More" tab — mobile-only catch-all for the low-frequency destinations
// that don't earn their own bottom-nav slot. Contains:
//   • Identity strip (name + email) that used to live at the top of the
//     floating profile-menu dropdown.
//   • Budgets       — moved here from its own tab.
//   • Settings      — banks, categories, password, sign out.
//   • Activity log  — every add / update / delete / import / export.
// Sign-out lives on the Settings page itself (per user feedback), not
// here — so this page is purely navigational and safe to open without
// worry of accidentally logging out.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Wallet, Settings, ScrollText, ArrowRight, Landmark, Tags } from 'lucide-react';

interface Tile {
  href: string;
  title: string;
  sub: string;
  icon: React.ElementType;
  accent: string; // Tailwind gradient classes for the icon square
}

const TILES: Tile[] = [
  {
    href: '/dashboard/budgets',
    title: 'Budgets',
    sub: 'Set monthly caps by category',
    icon: Wallet,
    accent: 'from-emerald-500 to-green-600',
  },
  {
    href: '/dashboard/banks',
    title: 'Banks & cards',
    sub: 'Accounts, balances, and history',
    icon: Landmark,
    accent: 'from-indigo-500 to-purple-600',
  },
  {
    href: '/dashboard/categories',
    title: 'Categories',
    sub: 'Expense + income buckets',
    icon: Tags,
    accent: 'from-rose-500 to-pink-600',
  },
  {
    href: '/dashboard/settings',
    title: 'Settings',
    sub: 'Password, account, sign out',
    icon: Settings,
    accent: 'from-slate-500 to-slate-700',
  },
  {
    href: '/dashboard/logs',
    title: 'Activity log',
    sub: 'Every add, update, delete, import, export',
    icon: ScrollText,
    accent: 'from-cyan-500 to-blue-600',
  },
];

export default function MorePage() {
  const [displayName, setDisplayName] = useState<string>('You');
  const [email, setEmail] = useState<string>('');

  // Simple auth read — no realtime needed, this page is quick in / quick out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const meta = (user.user_metadata || {}) as { full_name?: string; name?: string };
      const name =
        meta.full_name ||
        meta.name ||
        (user.email ? user.email.split('@')[0] : '') ||
        'You';
      setDisplayName(name);
      setEmail(user.email || '');
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header — matches Entries / Dashboard / etc. */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          More
        </h1>
        <p className="text-sm text-white/50 mt-0.5">
          Budgets, settings, and account.
        </p>
      </div>

      {/* Identity strip — the top block that used to live in the profile
          dropdown. Lets you eyeball which account you're on before diving
          into settings. */}
      <div className="bg-18-surface border border-18-border rounded-2xl p-4 flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-18-orange to-orange-600 flex items-center justify-center text-white font-bold shadow-[0_0_18px_-4px_rgba(243,115,53,0.6)] shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white truncate">{displayName}</p>
          {email && (
            <p className="text-xs text-white/50 truncate mt-0.5" title={email}>
              {email}
            </p>
          )}
        </div>
      </div>

      {/* Destination list — same row style as Entries feed rows so the
          More page reads as part of the same design system. */}
      <div className="space-y-2">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="block bg-18-surface border border-18-border rounded-xl p-3 hover:border-18-orange/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 w-9 rounded-lg bg-gradient-to-br ${t.accent} flex items-center justify-center shrink-0 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]`}
                >
                  <Icon size={16} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{t.title}</p>
                  <p className="text-[11px] text-white/50 truncate mt-0.5">
                    {t.sub}
                  </p>
                </div>
                <ArrowRight
                  size={16}
                  className="text-white/40 shrink-0"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
