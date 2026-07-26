'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bank, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  Flame,
  Wallet,
  Scale,
  MoreHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import DateRangePicker from '@/components/DateRangePicker';
import { DateRange, defaultRange } from '@/lib/dateRanges';
import { fetchCurrentStreak } from '@/lib/streak';

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
      className={`relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-5 hover:border-white/20 transition-all ${
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
        {/* Header row */}
        <div className="flex items-start justify-between mb-6">
          <div className="h-10 w-10 rounded-xl bg-black/40 border border-white/10 flex items-center justify-center text-white/80">
            <Icon size={18} />
          </div>
          <button
            className="text-white/40 hover:text-white/80 transition-colors p-1"
            aria-label="More options"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>

        {/* Label */}
        <p className="text-sm text-white/70 mb-2">{label}</p>

        {/* Value + trend — flex-wrap so the trend chip drops to a new line
            when the amount is too wide to fit beside it (large ₹ values on
            narrow cards). */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 min-w-0">
          <h3 className="text-3xl md:text-[2rem] xl:text-3xl 2xl:text-4xl font-black text-white tracking-tight leading-none break-words">
            {value}
          </h3>
          {trend && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                trend.direction === 'up'
                  ? 'text-green-300 bg-green-900/40'
                  : 'text-red-300 bg-red-900/40'
              }`}
            >
              {trend.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.text}
            </span>
          )}
        </div>

        {/* Sub */}
        {sub && <p className="text-xs text-white/50 mt-3">{sub}</p>}
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
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(defaultRange());

  useEffect(() => {
    fetchCurrentStreak().then(setStreak);
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
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  const profit = data.totalIncome - data.totalExpenses;
  const currentBalance = data.totalCash + profit;
  const isBrandNew = data.banks.length === 0 && data.totalIncome === 0 && data.totalExpenses === 0;
  const savingsRate = data.totalIncome > 0 ? Math.round((profit / data.totalIncome) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-white tracking-tight">Dashboard</h1>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-18-orange/15 border border-18-orange/40 rounded-full px-3 py-1 text-xs font-bold text-18-orange shadow-[0_0_20px_-5px_rgba(243,115,53,0.5)]">
                <Flame size={12} /> {streak}-day streak
              </span>
            )}
          </div>
          <p className="text-sm text-white/50">
            Here&apos;s where your money is going, in one look.
          </p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

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
                  href="/dashboard/settings"
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

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
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

      {/* Banks section */}
      <div className="bg-18-surface border border-18-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-lg font-bold text-white">Your Banks</h2>
            <p className="text-xs text-white/50 mt-0.5">Balances and account overview</p>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-xs font-semibold text-18-orange hover:underline"
          >
            Manage →
          </Link>
        </div>
        <div className="p-6">
          {data.banks.length > 0 ? (
            <div className="space-y-2">
              {data.banks.map((bank, i) => {
                const balance = (bank as Bank & { opening_balance?: number }).opening_balance || 0;
                return (
                  <div
                    key={bank.id}
                    className="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-18-orange/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        ['bg-orange-500/20 text-orange-300',
                         'bg-blue-500/20 text-blue-300',
                         'bg-purple-500/20 text-purple-300',
                         'bg-green-500/20 text-green-300'][i % 4]
                      }`}>
                        {bank.bank_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{bank.bank_name}</p>
                        <p className="text-xs text-white/50">{bank.account_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white group-hover:text-18-orange transition-colors">
                        {formatCurrency(balance)}
                      </p>
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Opening</p>
                    </div>
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
                href="/dashboard/settings"
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
