'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import Link from 'next/link';
import GlobalSearch from '@/components/GlobalSearch';
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
  BellDot,
  RefreshCw,
  Calendar,
  Sparkles,
} from 'lucide-react';

type NavSection = {
  label: string;
  items: { label: string; href: string; icon: typeof LayoutDashboard }[];
};

const navSections: NavSection[] = [
  {
    label: 'Insights',
    items: [
      { label: 'Dashboard', href: '/dashboard',         icon: LayoutDashboard },
      { label: 'Reports',   href: '/dashboard/reports', icon: Sparkles },
    ],
  },
  {
    label: 'Main',
    items: [
      { label: 'Quick Add',    href: '/dashboard/quick',       icon: Zap },
      { label: 'Expenses',     href: '/dashboard/expenses',    icon: IndianRupee },
      { label: 'Income',       href: '/dashboard/income',      icon: TrendingUp },
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

        setUser(
          (userData as User) || ({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.email || '',
          } as User)
        );
        setLoading(false);
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
  const userIdShort = user?.id ? `#${user.id.slice(0, 8)}` : '';

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
            <p className="text-gray-500 text-[10px] truncate">{userIdShort}</p>
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

            {/* Action pills */}
            <button
              onClick={() => window.location.reload()}
              className="h-10 w-10 rounded-full bg-18-surface border border-18-border flex items-center justify-center text-gray-400 hover:text-white hover:border-18-orange/50 transition-colors"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              className="h-10 w-10 rounded-full bg-18-surface border border-18-border flex items-center justify-center text-gray-400 hover:text-white hover:border-18-orange/50 transition-colors hidden sm:flex"
              title="Calendar"
              aria-label="Calendar"
            >
              <Calendar size={16} />
            </button>
            <button
              className="h-10 w-10 rounded-full bg-18-surface border border-18-border flex items-center justify-center text-gray-400 hover:text-white hover:border-18-orange/50 transition-colors hidden sm:flex relative"
              title="Notifications"
              aria-label="Notifications"
            >
              <BellDot size={16} />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-18-orange" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-6 pb-6 pt-2">{children}</main>
      </div>
    </div>
  );
}
