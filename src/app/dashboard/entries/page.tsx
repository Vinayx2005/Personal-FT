'use client';

// Unified "Entries" feed. One list, three data sources merged:
//   • expenses   (transactions.transaction_type = 'expense')
//   • income     (transactions.transaction_type = 'income')
//   • investments (investments row — FDs, mutual funds, stocks, SIP corpora)
//
// UX notes:
//   • Tapping a row opens a compact in-page detail modal with a Delete
//     button; we deliberately do NOT navigate away to the individual
//     Expenses/Income/Investments pages so Entries stays the single hub.
//   • Long-pressing a row enters multi-select mode; further taps toggle
//     selection; a floating bottom toolbar exposes "Delete N".
//   • Prev/next chevrons around the date picker walk the same-shape
//     period backward/forward (day → yesterday, month → last month,
//     custom N-day → the N days before it, etc.). See shiftRange in
//     src/lib/dateRanges.ts.
//   • The totals strip reflects the full date range regardless of chip
//     filter — it's a period scoreboard, not a mirror of the list.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Transaction,
  Investment,
  INVESTMENT_TYPE_LABELS,
} from '@/types';
import { formatCurrency, formatDate, groupByMonth } from '@/lib/utils';
import {
  IndianRupee,
  TrendingUp,
  PiggyBank,
  Search,
  X,
  Trash2,
  Check,
} from 'lucide-react';
import PeriodPicker from '@/components/PeriodPicker';
import { DateRange, defaultRange } from '@/lib/dateRanges';
import { logAction } from '@/lib/auditLog';

type Kind = 'expense' | 'income' | 'investment';

interface EntryRow {
  key: string;           // "exp-123" / "inc-456" / "inv-7"  — unique across kinds
  kind: Kind;
  id: number;            // numeric primary key inside its own table
  date: string;          // YYYY-MM-DD (for grouping + sorting)
  title: string;         // description or investment name
  categoryLabel: string; // "Groceries" / "Salary" / "Fixed Deposit"
  bankLabel: string;     // bank name — may be blank for investments with no source
  amount: number;        // always positive; direction is baked into the amount label
}

const KIND_META: Record<
  Kind,
  {
    color: string;
    bg: string;
    icon: typeof IndianRupee;
    sign: '+' | '-' | '';
  }
> = {
  expense: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    icon: IndianRupee,
    sign: '-',
  },
  income: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: TrendingUp,
    sign: '+',
  },
  investment: {
    color: 'text-18-orange',
    bg: 'bg-orange-500/10 border-orange-500/30',
    icon: PiggyBank,
    sign: '',
  },
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

export default function EntriesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [query, setQuery] = useState('');
  // Which kind the totals-strip filter is on. null = showing all kinds.
  // The chips row is gone; the totals cards themselves are the filter UI —
  // tap Income to see only income, tap the same card again to clear.
  const [activeKind, setActiveKind] = useState<Kind | null>(null);
  const [viewing, setViewing] = useState<EntryRow | null>(null);

  // Selection mode: a Set of row keys ("exp-123" etc.). Enters when a
  // long-press fires on any row; subsequent taps toggle rows in/out.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const selectionMode = selectedKeys.size > 0;
  const [deleting, setDeleting] = useState(false);

  // Long-press bookkeeping — mirrors the pattern used on the individual
  // Expenses / Income pages.
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const cancelLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  useEffect(() => () => cancelLongPress(), []);

  const load = async (isCancelled?: () => boolean) => {
    setLoading(true);

    const [banksRes, catsRes] = await Promise.all([
      supabase.from('banks').select('id, bank_name'),
      supabase.from('categories').select('id, name'),
    ]);
    const bankNameById = new Map<number, string>(
      (banksRes.data || []).map((b: any) => [b.id, b.bank_name])
    );
    const catNameById = new Map<number, string>(
      (catsRes.data || []).map((c: any) => [c.id, c.name])
    );

    // Investments are filtered server-side to the same window as the
    // transactions. The client display date is `start_date || created_at`,
    // so we match either column to the range. The end-of-day bump on
    // created_at ensures we catch same-day inserts whose timestamp lies
    // after 00:00 of range.to. Anything that slips through (edge cases
    // around timezone) is caught by the belt-and-braces client filter
    // below, but the server filter caps the download at rows that could
    // plausibly land in the window instead of the entire investments
    // table on every range change.
    const invStart = range.from;
    const invEnd   = range.to + 'T23:59:59.999';
    const [txRes, invRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('transaction_date', range.from)
        .lte('transaction_date', range.to)
        .order('transaction_date', { ascending: false }),
      supabase
        .from('investments')
        .select('*')
        .or(
          `and(start_date.gte.${invStart},start_date.lte.${range.to}),` +
          `and(start_date.is.null,created_at.gte.${invStart},created_at.lte.${invEnd})`
        )
        .order('created_at', { ascending: false }),
    ]);

    // Bail out if the effect has been re-run for a newer range — otherwise
    // an out-of-order slow response would overwrite the fresh rows with
    // stale data.
    if (isCancelled?.()) return;

    const txRows: EntryRow[] = ((txRes.data || []) as Transaction[]).map((t) => {
      const isIncome = t.transaction_type === 'income';
      return {
        key: `${isIncome ? 'inc' : 'exp'}-${t.id}`,
        kind: isIncome ? 'income' : 'expense',
        id: t.id,
        date: t.transaction_date,
        title: t.description || (isIncome ? 'Income' : 'Expense'),
        categoryLabel: catNameById.get(t.category_id) || '',
        bankLabel: bankNameById.get(t.bank_id) || '',
        amount: Number(t.amount) || 0,
      };
    });

    const invRowsAll: EntryRow[] = ((invRes.data || []) as Investment[]).map(
      (inv) => {
        const d =
          (inv.start_date && inv.start_date.slice(0, 10)) ||
          (inv.created_at && inv.created_at.slice(0, 10)) ||
          '';
        return {
          key: `inv-${inv.id}`,
          kind: 'investment' as const,
          id: inv.id,
          date: d,
          title: inv.name || 'Investment',
          categoryLabel: INVESTMENT_TYPE_LABELS[inv.type] || 'Investment',
          bankLabel: inv.source_bank_id
            ? bankNameById.get(inv.source_bank_id) || ''
            : '',
          amount: Number(inv.amount) || 0,
        };
      }
    );
    const invRows = invRowsAll.filter(
      (r) => r.date && r.date >= range.from && r.date <= range.to
    );

    const merged = [...txRows, ...invRows].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    setRows(merged);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  // Text filter + optional kind filter applied client-side. Kind comes
  // from tapping one of the totals cards below.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeKind && r.kind !== activeKind) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.categoryLabel.toLowerCase().includes(q) ||
        r.bankLabel.toLowerCase().includes(q)
      );
    });
  }, [rows, activeKind, query]);

  const grouped = useMemo(
    () => groupByMonth(filtered, (r) => r.date),
    [filtered]
  );

  const totals = useMemo(() => {
    let income = 0,
      expense = 0,
      invested = 0;
    for (const r of rows) {
      if (r.kind === 'income') income += r.amount;
      else if (r.kind === 'expense') expense += r.amount;
      else invested += r.amount;
    }
    return { income, expense, invested };
  }, [rows]);

  // ---------- Long-press / tap dispatch ----------
  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());

  const handlePressStart = (
    key: string,
    e: React.PointerEvent<HTMLElement>
  ) => {
    longPressFiredRef.current = false;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    pressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }, LONG_PRESS_MS);
  };
  const handlePressMove = (e: React.PointerEvent<HTMLElement>) => {
    const dx = Math.abs(e.clientX - pressStartRef.current.x);
    const dy = Math.abs(e.clientY - pressStartRef.current.y);
    if (
      dx > LONG_PRESS_MOVE_TOLERANCE_PX ||
      dy > LONG_PRESS_MOVE_TOLERANCE_PX
    ) {
      cancelLongPress();
    }
  };
  const handlePressEnd = () => cancelLongPress();
  const handleRowClick = (row: EntryRow) => {
    // Swallow the click that follows a long-press so it doesn't ALSO
    // open the detail modal.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (selectionMode) {
      toggleSelection(row.key);
      return;
    }
    setViewing(row);
  };

  // ---------- Delete ----------
  const runDelete = async (keys: string[]) => {
    if (keys.length === 0) return;
    setDeleting(true);
    try {
      const txIds: number[] = [];
      const invIds: number[] = [];
      const touched: EntryRow[] = [];
      for (const k of keys) {
        const r = rows.find((x) => x.key === k);
        if (!r) continue;
        touched.push(r);
        if (r.kind === 'investment') invIds.push(r.id);
        else txIds.push(r.id);
      }
      if (txIds.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', txIds);
        if (error) throw error;
      }
      if (invIds.length > 0) {
        const { error } = await supabase
          .from('investments')
          .delete()
          .in('id', invIds);
        if (error) throw error;
      }
      // Fire audit-log writes in parallel — sequential awaits made bulk
      // deletes O(N) round trips when they can happen concurrently.
      await Promise.all(
        touched.map((r) =>
          logAction({
            action: 'delete',
            table_name: r.kind === 'investment' ? 'investments' : 'transactions',
            record_id: r.id,
            description: `Deleted ${r.kind}: ${r.title} — ${formatCurrency(r.amount)}`,
          }).catch(() => {})
        )
      );
      clearSelection();
      setViewing(null);
      await load();
    } catch (err: any) {
      console.error('Delete failed', err);
      alert(`Delete failed: ${err?.message || 'unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search — local text filter, this is the ONLY search bar in the app now.
          The H1 + subtitle that used to sit above were dropped per the same
          reasoning as the analytics pages: the bottom-nav Entries tab is the
          page label, and the search input plus totals strip below make the
          page's purpose obvious without a duplicate title. */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, category, or bank…"
          className="w-full bg-18-surface border border-18-border rounded-full pl-9 pr-9 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-18-orange/60"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Date range with prev / next chevrons + count */}
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker value={range} onChange={setRange} />
        <span className="text-xs text-white/50 ml-auto">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Totals strip — each card is also a kind filter. Tap Income to
          narrow the list to income only, tap the same active card again
          to clear. The card values themselves always show the full-range
          totals (stable across filter) so the numbers don't wobble as
          the user toggles filters. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(
          [
            { key: 'income',     label: 'Income',    value: totals.income,   color: 'text-emerald-400', ring: 'border-emerald-500 ring-1 ring-emerald-500/40' },
            { key: 'expense',    label: 'Expenses',  value: totals.expense,  color: 'text-rose-400',    ring: 'border-rose-500 ring-1 ring-rose-500/40' },
            { key: 'investment', label: 'Invested',  value: totals.invested, color: 'text-18-orange',   ring: 'border-18-orange ring-1 ring-18-orange/40' },
          ] as { key: Kind; label: string; value: number; color: string; ring: string }[]
        ).map((t) => {
          const active = activeKind === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKind(active ? null : t.key)}
              aria-pressed={active}
              className={`text-left bg-18-surface rounded-xl p-3 border transition-colors ${
                active ? t.ring : 'border-18-border hover:border-white/20'
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">
                {t.label}
              </p>
              <p className={`font-bold text-sm sm:text-base tabular-nums mt-0.5 ${t.color}`}>
                {formatCurrency(t.value)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active-filter status line — subtle, only shows when a card is
          "pressed" so users always have a visible affordance to clear it. */}
      {activeKind && (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>
            Showing {activeKind === 'expense' ? 'expenses' : activeKind === 'income' ? 'income' : 'investments'} only.
          </span>
          <button
            type="button"
            onClick={() => setActiveKind(null)}
            className="text-18-orange font-semibold hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner w-8 h-8" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-18-surface border border-18-border rounded-2xl p-8 text-center">
          <p className="text-white/60 text-sm">No entries match.</p>
          <p className="text-white/40 text-xs mt-1">
            Try a wider date range, clear the search, or add something in Quick Add.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.key} className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold px-1">
                {g.label}
              </p>
              <div className="space-y-2">
                {g.items.map((r) => {
                  const meta = KIND_META[r.kind];
                  const Icon = meta.icon;
                  const selected = selectedKeys.has(r.key);
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onPointerDown={(e) => handlePressStart(r.key, e)}
                      onPointerMove={handlePressMove}
                      onPointerUp={handlePressEnd}
                      onPointerCancel={handlePressEnd}
                      onPointerLeave={handlePressEnd}
                      onClick={() => handleRowClick(r)}
                      className={`block w-full text-left bg-18-surface border rounded-xl p-3 transition-colors ${
                        selected
                          ? 'border-18-orange bg-18-orange/10'
                          : 'border-18-border hover:border-18-orange/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selected ? (
                          <div className="h-9 w-9 rounded-lg bg-18-orange border border-18-orange flex items-center justify-center shrink-0">
                            <Check size={16} className="text-white" />
                          </div>
                        ) : (
                          <div
                            className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}
                          >
                            <Icon size={16} className={meta.color} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">
                            {r.title}
                          </p>
                          <p className="text-[11px] text-white/50 truncate mt-0.5">
                            {formatDate(r.date)}
                            {r.categoryLabel && <> · {r.categoryLabel}</>}
                            {r.bankLabel && <> · {r.bankLabel}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-sm font-bold tabular-nums ${meta.color}`}
                          >
                            {meta.sign}
                            {formatCurrency(r.amount)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selection toolbar — floats above the bottom nav; delete or clear.
          z-50 (not z-40) so it always sits above the SubscriptionGate
          trial banner, which lives at bottom-24 z-40 and would otherwise
          overlap this toolbar for users still inside their trial window. */}
      {selectionMode && (
        <div
          className="fixed bottom-24 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:max-w-md z-50"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="bg-18-surface border border-18-orange/50 rounded-2xl p-3 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] flex items-center gap-2">
            <span className="text-sm font-semibold text-white pl-2">
              {selectedKeys.size} selected
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-white/60 hover:text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => runDelete(Array.from(selectedKeys))}
              className="inline-flex items-center gap-2 bg-rose-500 text-white font-bold text-sm px-4 py-2 rounded-full hover:bg-rose-600 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : `Delete ${selectedKeys.size}`}
            </button>
          </div>
        </div>
      )}

      {/* Detail modal — tap on a single row */}
      {viewing && !selectionMode && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setViewing(null)}
        >
          <div
            className="bg-18-surface border border-18-border rounded-2xl w-full sm:max-w-md p-5 shadow-[0_20px_80px_-10px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              {(() => {
                const meta = KIND_META[viewing.kind];
                const Icon = meta.icon;
                return (
                  <div
                    className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}
                  >
                    <Icon size={20} className={meta.color} />
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-lg break-words">
                  {viewing.title}
                </p>
                <p
                  className={`font-bold tabular-nums mt-1 ${KIND_META[viewing.kind].color}`}
                >
                  {KIND_META[viewing.kind].sign}
                  {formatCurrency(viewing.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="text-white/50 hover:text-white p-1 -mt-1 -mr-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <dl className="text-sm space-y-2 mb-5">
              <div className="flex items-baseline gap-3">
                <dt className="text-white/50 w-20 shrink-0">Date</dt>
                <dd className="text-white font-medium">
                  {formatDate(viewing.date)}
                </dd>
              </div>
              {viewing.categoryLabel && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-white/50 w-20 shrink-0">
                    {viewing.kind === 'investment' ? 'Type' : 'Category'}
                  </dt>
                  <dd className="text-white font-medium">
                    {viewing.categoryLabel}
                  </dd>
                </div>
              )}
              {viewing.bankLabel && (
                <div className="flex items-baseline gap-3">
                  <dt className="text-white/50 w-20 shrink-0">Bank</dt>
                  <dd className="text-white font-medium">
                    {viewing.bankLabel}
                  </dd>
                </div>
              )}
            </dl>

            <button
              type="button"
              disabled={deleting}
              onClick={() => runDelete([viewing.key])}
              className="w-full inline-flex items-center justify-center gap-2 bg-rose-500 text-white font-bold text-sm px-4 py-2.5 rounded-full hover:bg-rose-600 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting…' : 'Delete this entry'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
