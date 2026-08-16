'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import Link from 'next/link';
import TourGuide from '@/components/TourGuide';
import SubscriptionGate from '@/components/SubscriptionGate';
import BottomNav from '@/components/BottomNav';
import {
  LayoutDashboard,
  IndianRupee,
  TrendingUp,
  Settings,
  LogOut,
  ScrollText,
  PiggyBank,
  Zap,
  Sparkles,
  Flame,
  Wallet,
} from 'lucide-react';

type NavSection = {
  label: string;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
};

const navSections: NavSection[] = [
  {
    label: 'Insights',
    items: [
      { label: 'Dashboard', href: '/dashboard',          icon: LayoutDashboard },
      { label: 'Insights',  href: '/dashboard/insights', icon: Flame },
      { label: 'Reports',   href: '/dashboard/reports',  icon: Sparkles },
    ],
  },
  {
    label: 'Main',
    items: [
      { label: 'Quick Add',    href: '/dashboard/quick',       icon: Zap },
      { label: 'Expenses',     href: '/dashboard/expenses',    icon: IndianRupee },
      { label: 'Income',       href: '/dashboard/income',      icon: TrendingUp },
      { label: 'Budgets',      href: '/dashboard/budgets',     icon: Wallet },
      { label: 'Investments',  href: '/dashboard/investments', icon: PiggyBank },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Activity Log', href: '/dashboard/logs',     icon: ScrollText },
      { label: 'Settings',     href: '/dashboard/settings', icon: Settings },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let handled = false;

    const loadProfile = async (authUser: { id: string; email?: string | null; user_metadata?: any }) => {
      if (!mounted || handled) return;
      handled = true;
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        // Merge the profile row (for full_name if set) with the auth session
        // as the source of truth for the email. Older accounts have a stale
        // placeholder email in the users table from an early seed.
        const profile = (userData as User) || null;
        const authMeta = (authUser.user_metadata || {}) as { full_name?: string; name?: string };
        setUser({
          id: authUser.id,
          email: authUser.email || profile?.email || '',
          full_name:
            profile?.full_name?.trim() ||
            authMeta.full_name ||
            authMeta.name ||
            (authUser.email ? authUser.email.split('@')[0] : ''),
          created_at: profile?.created_at || '',
          updated_at: profile?.updated_at || '',
        });
        setLoading(false);

        // Fire the welcome email once. Idempotent server-side.
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch('/api/email/welcome', {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).catch(() => {});
          }
        } catch { /* ignore */ }
      } catch {
        router.push('/');
      }
    };

    // Subscribe FIRST so we don't miss the SIGNED_IN event that fires as the
    // Supabase SDK parses `#access_token=...` from the OAuth callback URL.
    // We deliberately do NOT redirect on SIGNED_OUT here — that fires
    // spuriously on iOS PWA cold starts before storage has been read, and
    // we'd rather rely on the retry loop below to be authoritative.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user);
    });

    // Then check whatever's already in storage/cookie. Retry generously —
    // on a cold PWA start over slow mobile data, Supabase's session-restore
    // + token refresh round trip can take up to 10 s. Bumped from 6 s to
    // 12 s (60 × 200 ms) after users reported still being kicked to
    // landing on installed PWAs.
    (async () => {
      for (let i = 0; i < 60; i++) {
        if (!mounted || handled) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          loadProfile(session.user);
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!mounted || handled) return;
      router.push('/');
    })();

    // On foreground: force a real token refresh (not just a storage read),
    // so a session that was about to expire gets a fresh access token
    // before the user's next action touches the network. refreshSession
    // returns quickly if the current token is still fresh.
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      supabase.auth.refreshSession().then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user && !handled) loadProfile(session.user);
        // If refresh failed and there's no session, DON'T bounce here —
        // the user may be reading the current page; let the next
        // network-touching action surface the auth error naturally.
      }).catch(() => { /* offline / network hiccup — ignore, try again next visibility change */ });
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Foreground keep-alive: refresh every 4 minutes while the tab is
    // visible. Access tokens expire in 1 h by default; refreshing 15×
    // per hour keeps the session healthy indefinitely as long as the
    // user has the app open, which fixes the "I was using it and then
    // suddenly got logged out" case that happens when the auto-refresh
    // timer misses a beat.
    const KEEP_ALIVE_MS = 4 * 60 * 1000;
    const keepAliveTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      supabase.auth.refreshSession().catch(() => { /* silent — next tick tries again */ });
    }, KEEP_ALIVE_MS);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(keepAliveTimer);
    };
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-18-bg">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'You';
  const userSubtitle = user?.email || '';

  // Sidebar content — reused for desktop rail + mobile drawer.
  const SidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 pt-4 pb-6 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_20px_rgba(243,115,53,0.6)] group-hover:scale-110 transition-transform">
            <span className="text-white font-bold text-[10px]">PFT</span>
          </div>
          <span className="text-white font-bold text-base">Personal FT</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-3 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-18-orange/15 text-white shadow-[inset_0_0_0_1px_rgba(243,115,53,0.4)]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-18-orange text-white shadow-[0_0_18px_rgba(243,115,53,0.55)]'
                          : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User account block */}
      <div className="mx-3 mb-3 mt-2 pt-4 border-t border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-3 mb-2">
          Account
        </p>
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-18-orange to-orange-600 flex items-center justify-center text-white font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate">{displayName}</p>
            <p className="text-gray-500 text-[11px] truncate" title={userSubtitle}>{userSubtitle}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-18-bg text-white font-poppins">
      {/* Desktop floating sidebar — unchanged; mobile no longer uses it */}
      <aside className="hidden md:flex fixed left-4 top-4 bottom-4 w-64 bg-18-surface border border-18-border rounded-2xl flex-col shadow-2xl z-30">
        {SidebarContent}
      </aside>

      {/* Main column. No mobile top bar — the profile avatar was moved
          into the "More" tab of the bottom nav, so pages get the full
          viewport width and can start their H1 flush with the top. */}
      <div className="md:pl-[288px] min-h-screen flex flex-col">
        <main className="flex-1 px-4 md:px-6 pb-24 md:pb-6 pt-4 md:pt-6">{children}</main>
      </div>

      {/* Mobile-only bottom tab bar — Dashboard / Quick Add / Entries / Budget */}
      <BottomNav />

      <TourGuide />
      <SubscriptionGate />
    </div>
  );
}
