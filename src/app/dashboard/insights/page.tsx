'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Transaction, Category } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { fetchCurrentStreak } from '@/lib/streak';
import {
  Flame,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Calendar as CalendarIcon,
  Lightbulb,
  Zap,
} from 'lucide-react';

// ---------- helpers ----------

const localDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Start of the current week (Monday) in local time
const startOfWeek = (d = new Date()): Date => {
  const out = new Date(d);
  const day = (out.getDay() + 6) % 7; // Mon=0, Sun=6
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - day);
  return out;
};

// Sum by matcher, excluding transfers and refunds
const sumSpend = (txs: Transaction[], catNameById: Map<number, string>, from: Date, to: Date): number => {
  return txs.reduce((acc, t) => {
    if (t.transaction_type !== 'expense') return acc;
    const d = new Date(t.transaction_date);
    if (d < from || d > to) return acc;
    const catName = (catNameById.get(t.category_id) || '').toLowerCase();
    const isTransfer = !!t.transfer_group_id || catName.includes('self transfer') || catName.includes('self-transfer');
    if (isTransfer) return acc;
    return acc + t.amount;
  }, 0);
};

interface CategoryTrend {
  name: string;
  thisMonth: number;
  lastMonth: number;
  delta: number; // percent change, +ve = grew
}

// ---------- Insight-of-the-day generator ----------
// Picks the most interesting observation from what we can derive.
// Rotates by day-of-month so it feels fresh without needing storage.

interface Insight {
  kind: 'streak' | 'top-category' | 'week-change' | 'daily-average' | 'welcome';
  headline: string;
  body: string;
  value?: string;
  emoji: string;
}

const pickInsight = (opts: {
  streak: number;
  txsThisMonth: Transaction[];
  weekSpend: number;
  lastWeekSpend: number;
  topCategory: CategoryTrend | null;
}): Insight => {
  const { streak, txsThisMonth, weekSpend, lastWeekSpend, topCategory } = opts;

  if (txsThisMonth.length === 0) {
    return {
      kind: 'welcome',
      headline: 'No spend logged this month yet',
      body: 'Log your first expense to unlock personalized insights.',
      emoji: '🌱',
    };
  }

  // Big week-over-week swing gets priority
  if (lastWeekSpend > 0) {
    const change = ((weekSpend - lastWeekSpend) / lastWeekSpend) * 100;
    if (Math.abs(change) > 30 && weekSpend > 500) {
      return {
        kind: 'week-change',
        headline: change > 0 ? 'Your spending jumped this week' : 'Nice — you spent less this week',
        body: `${formatCurrency(weekSpend)} vs ${formatCurrency(lastWeekSpend)} last week (${change > 0 ? '+' : ''}${change.toFixed(0)}%).`,
        value: formatCurrency(weekSpend),
        emoji: change > 0 ? '📈' : '📉',
      };
    }
  }

  // Top category with big month-over-month growth
  if (topCategory && topCategory.lastMonth > 0 && Math.abs(topCategory.delta) > 20) {
    return {
      kind: 'top-category',
      headline: topCategory.delta > 0
        ? `${topCategory.name} is up ${topCategory.delta.toFixed(0)}% this month`
        : `${topCategory.name} is down ${Math.abs(topCategory.delta).toFixed(0)}% this month`,
      body: `${formatCurrency(topCategory.thisMonth)} vs ${formatCurrency(topCategory.lastMonth)} last month.`,
      value: formatCurrency(topCategory.thisMonth),
      emoji: topCategory.delta > 0 ? '⚠️' : '✨',
    };
  }

  // Streak milestone
  if (streak >= 7) {
    return {
      kind: 'streak',
      headline: `${streak}-day tracking streak 🔥`,
      body: 'Consistency compounds. Every logged day sharpens the picture.',
      emoji: '🔥',
    };
  }

  // Average daily spend
  const now = new Date();
  const daysThisMonth = now.getDate();
  const totalThisMonth = txsThisMonth
    .filter((t) => t.transaction_type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const dailyAvg = daysThisMonth > 0 ? totalThisMonth / daysThisMonth : 0;
  if (dailyAvg > 0) {
    return {
      kind: 'daily-average',
      headline: `Your daily average is ${formatCurrency(dailyAvg)}`,
      body: `Based on ${daysThisMonth} day${daysThisMonth === 1 ? '' : 's'} of this month.`,
      value: formatCurrency(dailyAvg),
      emoji: '📊',
    };
  }

  return {
    kind: 'welcome',
    headline: 'Getting started',
    body: 'Log a few more expenses and I&apos;ll surface real patterns for you.',
    emoji: '🌱',
  };
};

// ---------- Page ----------

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCurrentStreak().then(setStreak);
    (async () => {
      try {
        // Pull last 90 days — enough for this-month vs last-month + weekly views
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const [txRes, catRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .gte('transaction_date', localDayKey(since))
            .eq('status', 'posted')
            .order('transaction_date', { ascending: false }),
          supabase.from('categories').select('*'),
        ]);
        setTxs((txRes.data || []) as Transaction[]);
        setCategories((catRes.data || []) as Category[]);
      } catch (err) {
        console.error('insights load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const catNameById = useMemo(() => {
    const m = new Map<number, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  // ---------- Derived ----------

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const thisMonthTxs = useMemo(
    () =>
      txs.filter((t) => {
        const d = new Date(t.transaction_date);
        return d >= startOfThisMonth && d <= endOfThisMonth;
      }),
    [txs, startOfThisMonth.getTime(), endOfThisMonth.getTime()]
  );

  // Week comparisons
  const thisWeekStart = startOfWeek(now);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 7);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(thisWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);

  const weekSpend = useMemo(
    () => sumSpend(txs, catNameById, thisWeekStart, thisWeekEnd),
    [txs, catNameById, thisWeekStart.getTime()]
  );
  const lastWeekSpend = useMemo(
    () => sumSpend(txs, catNameById, lastWeekStart, lastWeekEnd),
    [txs, catNameById, lastWeekStart.getTime()]
  );

  // Category month-over-month trends
  const categoryTrends: CategoryTrend[] = useMemo(() => {
    const thisByCat = new Map<number, number>();
    const lastByCat = new Map<number, number>();
    txs.forEach((t) => {
      if (t.transaction_type !== 'expense') return;
      const catName = (catNameById.get(t.category_id) || '').toLowerCase();
      if (catName.includes('self transfer') || catName.includes('self-transfer')) return;
      const d = new Date(t.transaction_date);
      if (d >= startOfThisMonth && d <= endOfThisMonth) {
        thisByCat.set(t.category_id, (thisByCat.get(t.category_id) || 0) + t.amount);
      } else if (d >= startOfLastMonth && d <= endOfLastMonth) {
        lastByCat.set(t.category_id, (lastByCat.get(t.category_id) || 0) + t.amount);
      }
    });
    const rows: CategoryTrend[] = [];
    const allIds = new Set<number>([...thisByCat.keys(), ...lastByCat.keys()]);
    allIds.forEach((id) => {
      const t = thisByCat.get(id) || 0;
      const l = lastByCat.get(id) || 0;
      if (t === 0 && l === 0) return;
      const delta = l > 0 ? ((t - l) / l) * 100 : t > 0 ? 100 : 0;
      rows.push({
        name: catNameById.get(id) || `Category ${id}`,
        thisMonth: t,
        lastMonth: l,
        delta,
      });
    });
    return rows.sort((a, b) => b.thisMonth - a.thisMonth).slice(0, 6);
  }, [txs, catNameById, startOfThisMonth.getTime(), startOfLastMonth.getTime()]);

  // Weekly tracking heatmap (7 dots — Mon..Sun of current week)
  const weekDays = useMemo(() => {
    const daySet = new Set(txs.map((t) => localDayKey(new Date(t.created_at))));
    const dots: { label: string; date: Date; done: boolean; isToday: boolean; inFuture: boolean }[] = [];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(thisWeekStart);
      d.setDate(thisWeekStart.getDate() + i);
      dots.push({
        label: labels[i],
        date: d,
        done: daySet.has(localDayKey(d)),
        isToday: localDayKey(d) === localDayKey(now),
        inFuture: d > now,
      });
    }
    return dots;
  }, [txs, thisWeekStart.getTime()]);

  const daysTrackedThisWeek = weekDays.filter((d) => d.done).length;
  const daysAvailableThisWeek = weekDays.filter((d) => !d.inFuture).length;

  // Insight of the day — pick the most interesting observation
  const topCategoryTrend = categoryTrends[0] || null;
  const insight = pickInsight({
    streak,
    txsThisMonth: thisMonthTxs,
    weekSpend,
    lastWeekSpend,
    topCategory: topCategoryTrend,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  // Empty state — no data at all
  if (txs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Insights</h1>
          <p className="text-sm text-white/50 mt-1">Personal patterns and trends from your money.</p>
        </div>
        <div className="relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-18-orange/15 border border-18-orange/40 flex items-center justify-center mx-auto mb-4">
            <Lightbulb className="text-18-orange" size={26} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No insights yet</h2>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Log a few expenses and I&apos;ll surface patterns, spikes, and comparisons — automatically.
          </p>
          <Link
            href="/dashboard/quick"
            className="inline-flex items-center gap-2 bg-18-orange text-white font-semibold text-sm px-5 py-2.5 rounded-full hover:brightness-110 transition-all shadow-[0_10px_30px_-5px_rgba(243,115,53,0.5)]"
          >
            <Zap size={14} /> Log an expense
          </Link>
        </div>
      </div>
    );
  }

  const weekDelta =
    lastWeekSpend > 0 ? ((weekSpend - lastWeekSpend) / lastWeekSpend) * 100 : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-white tracking-tight">Insights</h1>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-18-orange/15 border border-18-orange/40 rounded-full px-3 py-1 text-xs font-bold text-18-orange shadow-[0_0_20px_-5px_rgba(243,115,53,0.5)]">
                <Flame size={12} /> {streak}-day streak
              </span>
            )}
          </div>
          <p className="text-sm text-white/50">
            Personal patterns and trends from your money — refreshed on every visit.
          </p>
        </div>
      </div>

      {/* Insight of the day — hero card */}
      <div className="relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-6 shadow-[inset_0_0_140px_-20px_rgba(243,115,53,0.35)]">
        <div
          className="absolute inset-0 pointer-events-none opacity-90"
          style={{
            background:
              'radial-gradient(circle at 80% 20%, rgba(243,115,53,0.35) 0%, rgba(243,115,53,0.10) 30%, transparent 60%)',
          }}
        />
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-18-orange/20 border border-18-orange/40 flex items-center justify-center text-2xl shrink-0">
            {insight.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-18-orange mb-2">
              Insight of the day
            </p>
            <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-2">
              {insight.headline}
            </h2>
            <p className="text-sm text-white/70 leading-relaxed">{insight.body}</p>
          </div>
        </div>
      </div>

      {/* This week grid + week-over-week compare */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Week heatmap */}
        <div className="lg:col-span-2 bg-18-surface border border-18-border rounded-2xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">This week</p>
              <p className="text-white font-semibold mt-1">
                {daysTrackedThisWeek}{' '}
                <span className="text-white/60 font-normal">of {daysAvailableThisWeek} days tracked so far</span>
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
              <CalendarIcon size={16} className="text-white/70" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 md:gap-3">
            {weekDays.map((d, i) => (
              <div key={i} className="text-center">
                <div
                  className={`aspect-square rounded-xl border flex items-center justify-center text-xs font-bold transition-all ${
                    d.done
                      ? 'bg-18-orange border-18-orange text-white shadow-[0_0_18px_rgba(243,115,53,0.55)]'
                      : d.inFuture
                      ? 'bg-white/[0.02] border-white/5 text-white/20'
                      : d.isToday
                      ? 'bg-white/5 border-white/20 text-white/60'
                      : 'bg-white/[0.02] border-white/5 text-white/30'
                  }`}
                >
                  {d.done ? <Flame size={16} /> : d.date.getDate()}
                </div>
                <p className={`text-[10px] mt-1.5 font-semibold ${d.isToday ? 'text-18-orange' : 'text-white/40'}`}>
                  {d.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Week vs last week */}
        <div className="bg-18-surface border border-18-border rounded-2xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">This week vs last</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
              {weekDelta === null ? (
                <Minus size={16} className="text-white/70" />
              ) : weekDelta > 0 ? (
                <ArrowUpRight size={16} className="text-red-400" />
              ) : (
                <ArrowDownRight size={16} className="text-green-400" />
              )}
            </div>
          </div>
          <h3 className="text-2xl font-black text-white tracking-tight">{formatCurrency(weekSpend)}</h3>
          <p className="text-xs text-white/60 mt-2">
            Last week: <span className="text-white/80">{formatCurrency(lastWeekSpend)}</span>
          </p>
          {weekDelta !== null && (
            <span
              className={`inline-flex items-center gap-1 mt-3 text-[11px] font-bold px-2 py-1 rounded-full ${
                weekDelta > 0 ? 'text-red-300 bg-red-900/40' : 'text-green-300 bg-green-900/40'
              }`}
            >
              {weekDelta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {weekDelta > 0 ? '+' : ''}
              {weekDelta.toFixed(0)}% vs last week
            </span>
          )}
        </div>
      </div>

      {/* Category trends */}
      <div className="bg-18-surface border border-18-border rounded-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-18-orange" />
              <h2 className="text-lg font-bold text-white">Category trends</h2>
            </div>
            <p className="text-xs text-white/50 mt-0.5">This month vs last month, top movers first.</p>
          </div>
        </div>
        <div className="p-6">
          {categoryTrends.length === 0 ? (
            <p className="text-white/60 text-sm">Not enough history yet. Log a few more months to see trends here.</p>
          ) : (
            <div className="space-y-2">
              {categoryTrends.map((c) => {
                const up = c.delta > 0;
                const flat = c.delta === 0;
                return (
                  <div
                    key={c.name}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                          flat
                            ? 'bg-white/5 text-white/50'
                            : up
                            ? 'bg-red-500/15 text-red-300'
                            : 'bg-green-500/15 text-green-300'
                        }`}
                      >
                        {flat ? <Minus size={16} /> : up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{c.name}</p>
                        <p className="text-xs text-white/50">
                          {formatCurrency(c.thisMonth)}{' '}
                          <span className="text-white/30">
                            · last month {formatCurrency(c.lastMonth)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
                        flat
                          ? 'text-white/60 bg-white/5'
                          : up
                          ? 'text-red-300 bg-red-900/40'
                          : 'text-green-300 bg-green-900/40'
                      }`}
                    >
                      {flat ? (
                        'no change'
                      ) : (
                        <>
                          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {up ? '+' : ''}
                          {c.delta.toFixed(0)}%
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
