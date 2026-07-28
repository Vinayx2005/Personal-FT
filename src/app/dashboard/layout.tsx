'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import Link from 'next/link';
import GlobalSearch from '@/components/GlobalSearch';
import TourGuide from '@/components/TourGuide';
import SubscriptionGate from '@/components/SubscriptionGate';
import {
  Menu,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);        // desktop expanded
  const [mobileNavOpen, setMobileNavOpen] = useState(false);   // mobile drawer
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/');
          return;
        }
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

        // Fire the welcome email once. The API route is idempotent — if
        // welcome_sent_at is already stamped, it just no-ops. Best-effort;
        // failure never blocks the dashboard.
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
    getUser();
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
        {/* Close on mobile */}
        <button
          onClick={() => setMobileNavOpen(false)}
          className="text-gray-500 hover:text-white transition-colors md:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
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
                    onClick={() => setMobileNavOpen(false)}
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
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile drawer sidebar */}
      <aside
        className={`fixed left-3 top-3 bottom-3 w-64 bg-18-surface border border-18-border rounded-2xl flex flex-col shadow-2xl z-40 transition-transform md:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-[110%]'
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Desktop floating sidebar */}
      <aside className="hidden md:flex fixed left-4 top-4 bottom-4 w-64 bg-18-surface border border-18-border rounded-2xl flex-col shadow-2xl z-30">
        {SidebarContent}
      </aside>

      {/* Main column */}
      <div className="md:pl-[288px] min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 px-4 md:px-6 pt-4 pb-3 bg-18-bg/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden h-10 w-10 rounded-full bg-18-surface border border-18-border flex items-center justify-center text-gray-400 hover:text-white"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            {/* Search pill — takes most of the width */}
            <div className="flex-1">
              <GlobalSearch />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-6 pb-6 pt-2">{children}</main>
      </div>
      <TourGuide />
      <SubscriptionGate />
    </div>
  );
}
