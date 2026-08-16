'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bank, Transaction } from '@/types';
import { formatCurrency, formatDateISO } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Wallet,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PeriodPicker from '@/components/PeriodPicker';
import AnalyticsTabs from '@/components/AnalyticsTabs';
import { DateRange, defaultRange } from '@/lib/dateRanges';

interface DashboardData {
  banks: Bank[];
  totalCash: number;
  totalIncome: number;
  totalExpenses: number;
}

// KPI card — matches the InsightX reference style
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: { direction: 'up' | 'down'; text: string };
  glow?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, trend, glow = false }: KpiCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-3 sm:p-5 hover:border-white/20 transition-all ${
        glow ? 'shadow-[inset_0_0_120px_-20px_rgba(243,115,53,0.35)]' : ''
      }`}
    >
      {/* Inner radial glow for the "primary" card */}
      {glow && (
        <div
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{
            background:
              'radial-gradient(circle at 60% 30%, rgba(243,115,53,0.55) 0%, rgba(243,115,53,0.15) 30%, transparent 60%)',
          }}
        />
      )}

      <div className="relative z-10">
        {/* Header row — compact on mobile (dropped the ⋯ button, which was
            never wired up anyway). Icon shrinks so KPI cards fit two-across
            without overflowing on narrow phones. */}
        <div className="flex items-center gap-2 mb-2 sm:mb-4">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/80 shrink-0">
            <Icon size={14} className="sm:hidden" />
            <Icon size={18} className="hidden sm:block" />
          </div>
          <p className="text-[11px] sm:text-sm text-white/70 truncate">{label}</p>
        </div>

        {/* Value — smaller on mobile so the ₹ figure fits in a half-width
            card without wrapping. */}
        <h3 className="text-lg sm:text-2xl md:text-[2rem] xl:text-3xl 2xl:text-4xl font-black text-white tracking-tight leading-tight break-words">
          {value}
        </h3>

        {/* Trend chip + sub caption. On mobile they stack tight; on desktop
            the trend sits beside the value. */}
        {(trend || sub) && (
          <div className="mt-1 sm:mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {trend && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  trend.direction === 'up'
                    ? 'text-green-300 bg-green-900/40'
                    : 'text-red-300 bg-red-900/40'
                }`}
              >
                {trend.direction === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {trend.text}
              </span>
            )}
            {sub && <p className="text-[10px] sm:text-xs text-white/50 truncate">{sub}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    banks: [],
    totalCash: 0,
    totalIncome: 0,
    totalExpenses: 0,
  });
  // net (income − expense) across ALL time, keyed by bank_id.
  // Used to show current live balance per bank, independent of the KPI date range.
  const [bankNet, setBankNet] = useState<Record<number, number>>({});
  // Net movement per bank BEFORE today (client local). Used to render each
  // bank card's "today's opening" caption — i.e. the balance at 00:00 today,
  // which naturally rolls forward as the date changes (yesterday's closing
  // becomes today's opening the instant the client's clock ticks past 00:00).
  const [bankNetBeforeToday, setBankNetBeforeToday] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(defaultRange());
  // Bumped whenever we want to force a refetch (route entry, tab focus,
  // pull-to-refresh in the future). Cheaper than plumbing a global store.
  const [refreshTick, setRefreshTick] = useState(0);
  const pathname = usePathname();

  // Refetch when the browser tab regains focus — covers backgrounded PWAs
  // and users switching between tabs after adding a spend elsewhere.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRefreshTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: banksData } = await supabase.from('banks').select('*').eq('is_active', true);
        const { data: categoriesData } = await supabase.from('categories').select('id, name');
        const catNameById = new Map<number, string>();
        (categoriesData || []).forEach((c: { id: number; name: string }) =>
          catNameById.set(c.id, (c.name || '').toLowerCase())
        );

        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .gte('transaction_date', range.from)
          .lte('transaction_date', range.to)
          .eq('status', 'posted');

        // Per-bank net across ALL time (for live bank balances).
        // Transfers ARE included here — moving money between accounts is real
        // movement; only P&L totals exclude them.
        // Also split out net BEFORE today's date so the bank card can show
        // "today's opening" — the balance at 00:00 local. When the clock rolls
        // past midnight, yesterday's transactions fall into the "before today"
        // bucket and today's opening naturally advances to yesterday's close.
        const { data: allTxData } = await supabase
          .from('transactions')
          .select('bank_id, transaction_type, amount, transaction_date')
          .eq('status', 'posted');
        const todayIso = formatDateISO(new Date());
        const netByBank: Record<number, number> = {};
        const netBeforeTodayByBank: Record<number, number> = {};
        (allTxData || []).forEach((t: any) => {
          if (!t.bank_id) return;
          const delta = t.transaction_type === 'income' ? t.amount : -t.amount;
          netByBank[t.bank_id] = (netByBank[t.bank_id] || 0) + delta;
          if (t.transaction_date && t.transaction_date < todayIso) {
            netBeforeTodayByBank[t.bank_id] = (netBeforeTodayByBank[t.bank_id] || 0) + delta;
          }
        });
        setBankNet(netByBank);
        setBankNetBeforeToday(netBeforeTodayByBank);

        let totalIncome = 0;
        let totalExpenses = 0;

        transactionsData?.forEach((t: Transaction) => {
          const catName = catNameById.get(t.category_id) || '';
          const isTransfer =
            !!t.transfer_group_id ||
            catName.includes('self transfer') ||
            catName.includes('self-transfer');
          const isRefund = catName === 'refund' || catName === 'refunds';
          if (t.transaction_type === 'income') {
            if (!isTransfer && !isRefund) totalIncome += t.amount;
          } else {
            if (!isTransfer) totalExpenses += t.amount;
          }
        });

        const totalCash = (banksData || []).reduce(
          (sum, b: Bank & { opening_balance?: number }) => sum + (b.opening_balance || 0),
          0
        );

        setData({
          banks: banksData || [],
          totalCash,
          totalIncome,
          totalExpenses,
        });
        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [range, refreshTick, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  const profit = data.totalIncome - data.totalExpenses;
  // Live current balance across ALL banks = sum(opening) + sum(all-time net).
  // Independent of the date range picker.
  const allTimeNet = Object.values(bankNet).reduce((s, v) => s + v, 0);
  const currentBalance = data.totalCash + allTimeNet;
  const isBrandNew = data.banks.length === 0 && data.totalIncome === 0 && data.totalExpenses === 0;
  const savingsRate = data.totalIncome > 0 ? Math.round((profit / data.totalIncome) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Sub-nav across Dashboard / Insights / Reports. Static (not sticky)
          so it moves with the page but sits at the top of every analytics
          screen so switching sections is one tap regardless of scroll. */}
      <AnalyticsTabs />

      <PeriodPicker value={range} onChange={setRange} />

      {/* Welcome onboarding — only for brand new users */}
      {isBrandNew && (
        <div className="relative overflow-hidden bg-18-surface border border-18-orange/40 rounded-2xl p-6 shadow-[inset_0_0_140px_-20px_rgba(243,115,53,0.35)]">
          <div className="relative z-10 flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-18-orange/20 border border-18-orange/40 flex items-center justify-center shrink-0">
              <Sparkles className="text-18-orange" size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-1">Welcome! Let&apos;s get you set up.</h2>
              <p className="text-sm text-white/60 mb-4">
                Two steps to start seeing where your money goes.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard/banks"
                  className="inline-flex items-center gap-2 bg-18-orange text-white font-semibold text-sm px-4 py-2 rounded-full hover:brightness-110 transition-all shadow-[0_8px_25px_-5px_rgba(243,115,53,0.5)]"
                >
                  <Building2 size={14} /> Add your first bank
                </Link>
                <Link
                  href="/dashboard/quick"
                  className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-white font-semibold text-sm px-4 py-2 rounded-full hover:bg-white/10 transition-all"
                >
                  <Zap size={14} /> Log a spend
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI grid — two-across on mobile so all four numbers fit in one
          swipe instead of stacking into a 1000-px scroll. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label="Current Balance"
          value={formatCurrency(currentBalance)}
          sub={`Opening: ${formatCurrency(data.totalCash)}`}
          icon={Wallet}
          glow
        />
        <KpiCard
          label="Income"
          value={formatCurrency(data.totalIncome)}
          sub="This period"
          icon={TrendingUp}
          trend={data.totalIncome > 0 ? { direction: 'up', text: 'incoming' } : undefined}
        />
        <KpiCard
          label="Expenses"
          value={formatCurrency(data.totalExpenses)}
          sub="This period"
          icon={TrendingDown}
          trend={data.totalExpenses > 0 ? { direction: 'down', text: 'outgoing' } : undefined}
        />
        <KpiCard
          label="Net"
          value={formatCurrency(profit)}
          sub={data.totalIncome > 0 ? `Savings rate ${savingsRate}%` : 'Income − Expenses'}
          icon={Scale}
          trend={
            profit === 0
              ? undefined
              : { direction: profit > 0 ? 'up' : 'down', text: profit > 0 ? 'saving' : 'over' }
          }
        />
      </div>

      {/* Banks section — compact card list. Name truncates so it never
          wraps; amount right-aligns; the "today's opening" caption sits
          in its own row below so both bank name and amount get full
          width on their line. */}
      <div className="bg-18-surface border border-18-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white">Your banks &amp; cards</h2>
            <p className="text-xs text-white/50 mt-0.5">Balances and account overview</p>
          </div>
          <Link
            href="/dashboard/banks"
            className="text-xs font-semibold text-18-orange hover:underline shrink-0"
          >
            Manage →
          </Link>
        </div>
        <div className="p-3 sm:p-4">
          {data.banks.length > 0 ? (
            <div className="space-y-2">
              {data.banks.map((bank, i) => {
                const opening = (bank as Bank & { opening_balance?: number }).opening_balance || 0;
                const net = bankNet[bank.id] || 0;
                const current = opening + net;
                // Today's opening = anchor + everything logged before today.
                // Automatically advances when the clock ticks past midnight.
                const netBeforeToday = bankNetBeforeToday[bank.id] || 0;
                const todayOpening = opening + netBeforeToday;
                return (
                  <div
                    key={bank.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-18-orange/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                        ['bg-orange-500/20 text-orange-300',
                         'bg-blue-500/20 text-blue-300',
                         'bg-purple-500/20 text-purple-300',
                         'bg-green-500/20 text-green-300'][i % 4]
                      }`}>
                        {bank.bank_name.charAt(0).toUpperCase()}
                      </div>
                      <p className="font-semibold text-white text-sm truncate flex-1 min-w-0">
                        {bank.bank_name}
                      </p>
                      <p className={`font-bold tabular-nums text-sm shrink-0 whitespace-nowrap ${current < 0 ? 'text-red-300' : 'text-white'} group-hover:text-18-orange transition-colors`}>
                        {formatCurrency(current)}
                      </p>
                    </div>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1.5 pl-12">
                      Today&apos;s opening {formatCurrency(todayOpening)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                <Building2 size={22} className="text-white/40" />
              </div>
              <p className="text-white/60 mb-4">No banks yet.</p>
              <Link
                href="/dashboard/banks"
                className="inline-flex items-center gap-2 bg-18-orange text-white font-semibold text-sm px-4 py-2 rounded-full hover:brightness-110 transition-all"
              >
                <Building2 size={14} /> Add your first bank
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
