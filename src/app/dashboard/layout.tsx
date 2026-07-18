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
  BarChart3,
  IndianRupee,
  TrendingUp,
  Settings,
  LogOut,
  ScrollText,
  PiggyBank,
  Zap,
} from 'lucide-react';

const navItems: { label: string; href: string; icon: typeof BarChart3 }[] = [
  { label: 'Quick Add', href: '/quick', icon: Zap },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Expenses', href: '/dashboard/expenses', icon: IndianRupee },
  { label: 'Income', href: '/dashboard/income', icon: TrendingUp },
  { label: 'Investments', href: '/dashboard/investments', icon: PiggyBank },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Activity Log', href: '/dashboard/logs', icon: ScrollText },
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
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          router.push('/');
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        // Fall back to bare auth info if the users row isn't set up yet — a
        // single-user personal app shouldn't be gated by app-level user rows.
        setUser(
          (userData as User) || ({
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.email || '',
          } as User)
        );
        setLoading(false);
      } catch (err) {
        router.push('/');
      }
    };

    getUser();
  }, [router]);

  const visibleNavItems = navItems;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-18-bg">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-18-dark-text">Loading...</p>
        </div>
      </div>
    );
  }

  // On mobile the sidebar is width-64 always but slides off-screen; the collapse toggle
  // only affects desktop. So the effective desktop width class is w-64 or w-20.
  const desktopWidth = sidebarOpen ? 'md:w-64' : 'md:w-20';
  const mainMargin = sidebarOpen ? 'md:ml-64' : 'md:ml-20';

  return (
    <div className="flex h-screen bg-18-bg">
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`w-64 ${desktopWidth} bg-18-charcoal text-white transition-all duration-300 flex flex-col fixed left-0 top-0 h-screen z-40 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen || mobileNavOpen ? (
            <div className="bg-white rounded-md px-3 py-2 flex-1 mr-2">
              <span className="text-18-charcoal font-bold text-lg">Personal FT</span>
            </div>
          ) : (
            <div className="bg-18-orange rounded p-1.5 mx-auto">
              <span className="text-white font-bold text-sm">PFT</span>
            </div>
          )}
          {/* Close on desktop collapses; on mobile closes drawer */}
          <button
            onClick={() => {
              if (mobileNavOpen) setMobileNavOpen(false);
              else setSidebarOpen(false);
            }}
            className={`text-gray-400 hover:text-white shrink-0 ${!sidebarOpen && !mobileNavOpen && 'hidden'}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const expanded = sidebarOpen || mobileNavOpen;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-18-orange text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                } ${!expanded && 'md:justify-center'}`}
              >
                <Icon size={20} />
                <span className={!expanded ? 'md:hidden' : ''}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="border-t border-gray-700 p-4">
          {(sidebarOpen || mobileNavOpen) && (
            <div className="mb-4">
              <p className="text-xs text-gray-400">Logged in as</p>
              <p className="text-sm font-semibold truncate">{user?.full_name || user?.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors ${
              !sidebarOpen && !mobileNavOpen && 'md:justify-center'
            }`}
          >
            <LogOut size={18} />
            <span className={!sidebarOpen && !mobileNavOpen ? 'md:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`ml-0 ${mainMargin} flex-1 flex flex-col overflow-hidden`}>
        {/* Top Bar */}
        <div className="bg-white border-b border-18-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              // On mobile, toggle drawer; on desktop, toggle collapse
              if (window.matchMedia('(min-width: 768px)').matches) {
                setSidebarOpen(!sidebarOpen);
              } else {
                setMobileNavOpen(!mobileNavOpen);
              }
            }}
            className="text-18-dark-text hover:text-18-orange transition-colors shrink-0"
            aria-label="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <GlobalSearch />
            <span className="hidden sm:inline text-sm text-18-dark-text truncate">
              Welcome, <strong>{user?.full_name || 'User'}</strong>
            </span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-18-bg">
          <div className="p-4 md:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
