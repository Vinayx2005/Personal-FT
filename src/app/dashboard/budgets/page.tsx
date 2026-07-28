'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Category, Budget } from '@/types';
import { ChevronLeft, ChevronRight, Copy, AlertCircle, Check, Loader2 } from 'lucide-react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Row {
  category: Category;
  budgetId: number | null;
  budgetAmount: number; // last-saved amount, 0 if none
  draftAmount: string;  // string in the input; kept separate for editing
  actual: number;       // sum of expenses this month for this category
  status: SaveStatus;
  errorText?: string;
}

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

// Debounce delay after last keystroke before auto-saving.
const AUTO_SAVE_MS = 800;
// How long a "Saved" indicator stays before fading back to idle.
const SAVED_LINGER_MS = 1600;

// Return YYYY-MM-01 for the given month offset from now.
const monthStartISO = (offset: number): string => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
};

const monthLabel = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const monthEndISO = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m, 0); // day 0 of next month = last day of this month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shiftMonth = (iso: string, delta: number): string => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const prevMonthISO = (iso: string): string => shiftMonth(iso, -1);

const parseAmount = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = parseFloat(trimmed.replace(/[,₹\s]/g, ''));
  if (isNaN(num) || num < 0) return null;
  return num;
};

export default function BudgetsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>(monthStartISO(0));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [copying, setCopying] = useState(false);

  // We need to read the latest row snapshot inside the debounced save closure,
  // so mirror rows into a ref that's always current.
  const rowsRef = useRef<Row[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Per-category timers so each row debounces independently.
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const savedTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/');
      } else {
        setUserId(user.id);
        setAuthChecked(true);
      }
    });
  }, [router]);

  // Cleanup any pending timers on unmount so we don't fire onto a dead component.
  useEffect(() => {
    return () => {
      saveTimers.current.forEach((t) => clearTimeout(t));
      savedTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const loadRows = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const from = month;
      const to = monthEndISO(month);

      const [catsRes, budgetsRes, txRes] = await Promise.all([
        supabase.from('categories').select('*').eq('type', 'expense'),
        supabase.from('budgets').select('*').eq('month', month),
        supabase
          .from('transactions')
          .select('category_id, amount, transfer_group_id')
          .eq('transaction_type', 'expense')
          .eq('status', 'posted')
          .gte('transaction_date', from)
          .lte('transaction_date', to),
      ]);

      const categories: Category[] = (catsRes.data || []) as Category[];
      const budgets: Budget[] = (budgetsRes.data || []) as Budget[];
      const budgetByCat = new Map(budgets.map((b) => [b.category_id, b]));

      const actualByCat = new Map<number, number>();
      for (const t of txRes.data || []) {
        if ((t as any).transfer_group_id) continue;
        const cid = (t as any).category_id as number;
        actualByCat.set(cid, (actualByCat.get(cid) || 0) + Number((t as any).amount));
      }

      const built: Row[] = categories
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => {
          const b = budgetByCat.get(c.id);
          return {
            category: c,
            budgetId: b?.id ?? null,
            budgetAmount: b?.amount ?? 0,
            draftAmount: b ? String(b.amount) : '',
            actual: actualByCat.get(c.id) || 0,
            status: 'idle' as SaveStatus,
          };
        });

      setRows(built);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to load budgets.' });
    } finally {
      setLoading(false);
    }
  };

  // Reload rows when the month changes. Flush any pending saves for the
  // OLD month first so the user's last-typed value isn't dropped, then clear
  // the timers so they can't accidentally write against the new month.
  useEffect(() => {
    if (!authChecked) return;
    const pendingIds = Array.from(saveTimers.current.keys());
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
    Promise.all(pendingIds.map((cid) => persistRow(cid)))
      .catch(() => {})
      .finally(() => loadRows());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, month]);

  const totalBudget = useMemo(() => rows.reduce((s, r) => s + r.budgetAmount, 0), [rows]);
  const totalActual = useMemo(() => rows.reduce((s, r) => s + r.actual, 0), [rows]);
  const totalRemaining = totalBudget - totalActual;

  // Patch one row in state without a full reload.
  const patchRow = (categoryId: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.category.id === categoryId ? { ...r, ...patch } : r)));
  };

  // Persist a single row's budget. Handles insert / update / delete based on
  // (old budgetId presence, new draft value). No-ops when nothing changed.
  const persistRow = async (categoryId: number) => {
    if (!userId) return;
    const row = rowsRef.current.find((r) => r.category.id === categoryId);
    if (!row) return;

    const parsed = parseAmount(row.draftAmount);
    // Nothing typed AND nothing saved before → nothing to do.
    if (parsed === null && row.budgetId == null) {
      patchRow(categoryId, { status: 'idle', errorText: undefined });
      return;
    }
    // Value unchanged from last save → skip network.
    if (parsed !== null && parsed === row.budgetAmount) {
      patchRow(categoryId, { status: 'idle', errorText: undefined });
      return;
    }
    // Invalid non-empty input → surface error, don't hit the DB.
    if (row.draftAmount.trim() && parsed === null) {
      patchRow(categoryId, { status: 'error', errorText: 'Invalid amount' });
      return;
    }

    patchRow(categoryId, { status: 'saving', errorText: undefined });
    try {
      if (parsed === null && row.budgetId != null) {
        // Cleared out an existing budget → delete
        const { error } = await supabase.from('budgets').delete().eq('id', row.budgetId);
        if (error) throw error;
        patchRow(categoryId, { budgetId: null, budgetAmount: 0, status: 'saved' });
      } else if (row.budgetId != null && parsed !== null) {
        const { error } = await supabase.from('budgets').update({ amount: parsed }).eq('id', row.budgetId);
        if (error) throw error;
        patchRow(categoryId, { budgetAmount: parsed, status: 'saved' });
      } else if (parsed !== null) {
        const { data, error } = await supabase
          .from('budgets')
          .insert({ user_id: userId, category_id: categoryId, month, amount: parsed })
          .select('id')
          .single();
        if (error) throw error;
        patchRow(categoryId, { budgetId: (data as any)?.id ?? null, budgetAmount: parsed, status: 'saved' });
      }

      // Fade "Saved" back to idle after a short linger.
      const existingLinger = savedTimers.current.get(categoryId);
      if (existingLinger) clearTimeout(existingLinger);
      const linger = setTimeout(() => {
        patchRow(categoryId, { status: 'idle' });
        savedTimers.current.delete(categoryId);
      }, SAVED_LINGER_MS);
      savedTimers.current.set(categoryId, linger);
    } catch (err: any) {
      patchRow(categoryId, {
        status: 'error',
        errorText: err?.message || 'Save failed',
      });
    }
  };

  const scheduleSave = (categoryId: number) => {
    const existing = saveTimers.current.get(categoryId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      persistRow(categoryId);
      saveTimers.current.delete(categoryId);
    }, AUTO_SAVE_MS);
    saveTimers.current.set(categoryId, t);
  };

  const flushSave = (categoryId: number) => {
    const existing = saveTimers.current.get(categoryId);
    if (existing) {
      clearTimeout(existing);
      saveTimers.current.delete(categoryId);
    }
    persistRow(categoryId);
  };

  const updateDraft = (categoryId: number, value: string) => {
    patchRow(categoryId, { draftAmount: value, status: 'idle', errorText: undefined });
    scheduleSave(categoryId);
  };

  const copyLastMonth = async () => {
    if (!userId) return;
    setCopying(true);
    setFeedback(null);
    // Flush any in-flight debounced saves first — otherwise this month's
    // budget-set might miss rows the user JUST typed, and the copy would
    // hit a UNIQUE(user_id, category_id, month) violation for them.
    const pendingIds = Array.from(saveTimers.current.keys());
    saveTimers.current.forEach((t) => clearTimeout(t));
    saveTimers.current.clear();
    await Promise.all(pendingIds.map((cid) => persistRow(cid))).catch(() => {});
    try {
      const last = prevMonthISO(month);
      const { data: lastBudgets, error } = await supabase
        .from('budgets').select('category_id, amount').eq('month', last);
      if (error) throw error;
      if (!lastBudgets || lastBudgets.length === 0) {
        setFeedback({ type: 'error', text: `No budgets found for ${monthLabel(last)}.` });
        return;
      }
      const existingCatIds = new Set(rows.filter((r) => r.budgetId != null).map((r) => r.category.id));
      const toInsert = lastBudgets
        .filter((b: any) => !existingCatIds.has(b.category_id))
        .map((b: any) => ({
          user_id: userId,
          category_id: b.category_id,
          month,
          amount: b.amount,
        }));
      if (toInsert.length === 0) {
        setFeedback({ type: 'success', text: 'This month already has budgets — nothing to copy.' });
        return;
      }
      const { error: insErr } = await supabase.from('budgets').insert(toInsert);
      if (insErr) throw insErr;
      await loadRows();
      setFeedback({ type: 'success', text: `Copied ${toInsert.length} budget${toInsert.length === 1 ? '' : 's'} from ${monthLabel(last)}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Copy failed.' });
    } finally {
      setCopying(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">Budgets</h1>
          <p className="text-sm text-white/50">
            Set a monthly cap for each category — changes save automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={copyLastMonth}
          disabled={copying}
          className="inline-flex items-center gap-2 text-sm text-white/80 bg-18-surface border border-18-border hover:border-18-orange/50 rounded-full px-4 py-2 transition-colors disabled:opacity-40"
        >
          <Copy size={14} />
          {copying ? 'Copying…' : 'Copy last month'}
        </button>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="h-9 w-9 rounded-full bg-18-surface border border-18-border hover:border-18-orange/40 text-white/80 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-[200px] text-center px-6 py-2 rounded-full bg-18-surface border border-18-border font-semibold text-white">
          {monthLabel(month)}
        </div>
        <button
          type="button"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="h-9 w-9 rounded-full bg-18-surface border border-18-border hover:border-18-orange/40 text-white/80 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total budget', value: formatCurrency(totalBudget), tone: 'text-white' },
          { label: 'Spent so far', value: formatCurrency(totalActual), tone: 'text-rose-400' },
          {
            label: totalRemaining >= 0 ? 'Remaining' : 'Over budget',
            value: formatCurrency(Math.abs(totalRemaining)),
            tone: totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400',
          },
        ].map((k) => (
          <div key={k.label} className="bg-18-surface border border-18-border rounded-2xl p-5 shadow-[inset_0_0_60px_-30px_rgba(243,115,53,0.15)]">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-start gap-3 ${
            feedback.type === 'success'
              ? 'bg-green-900/30 border border-green-800/40 text-green-300'
              : 'bg-red-900/30 border border-red-800/40 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check size={16} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Category rows */}
      <div className="bg-18-surface border border-18-border rounded-2xl overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-18-border/60 text-[10px] uppercase tracking-widest font-bold text-white/40">
          <div className="col-span-4">Category</div>
          <div className="col-span-2 text-right">Budget</div>
          <div className="col-span-2 text-right">Spent</div>
          <div className="col-span-4">Progress</div>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="spinner w-8 h-8" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            <p className="text-sm">No expense categories yet.</p>
            <p className="text-xs mt-2">Add categories under Settings, then come back.</p>
          </div>
        ) : (
          rows.map((row) => {
            const pct = row.budgetAmount > 0 ? Math.min(999, (row.actual / row.budgetAmount) * 100) : 0;
            const over = row.budgetAmount > 0 && row.actual > row.budgetAmount;
            const barColor = over
              ? 'bg-rose-500'
              : pct >= 85
              ? 'bg-amber-500'
              : 'bg-emerald-500';

            const statusEl = (() => {
              if (row.status === 'saving') return (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/50 font-semibold">
                  <Loader2 size={11} className="animate-spin" /> Saving
                </span>
              );
              if (row.status === 'saved') return (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                  <Check size={11} /> Saved
                </span>
              );
              if (row.status === 'error') return (
                <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-semibold" title={row.errorText}>
                  <AlertCircle size={11} /> {row.errorText || 'Failed'}
                </span>
              );
              return null;
            })();

            const inputBorder =
              row.status === 'error'
                ? 'border-rose-500/60'
                : row.status === 'saved'
                ? 'border-emerald-500/50'
                : row.status === 'saving'
                ? 'border-18-orange/40'
                : 'border-18-border';

            return (
              <div
                key={row.category.id}
                className="px-4 md:px-5 py-4 border-b border-18-border/40 last:border-b-0 md:grid md:grid-cols-12 md:gap-3 md:items-center"
              >
                {/* Mobile: category + actual on one row */}
                <div className="flex items-start justify-between gap-3 mb-3 md:mb-0 md:col-span-4 md:min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{row.category.name}</p>
                    <div className="mt-0.5 min-h-[14px]">{statusEl}</div>
                  </div>
                  {/* Actual, mobile-only inline */}
                  <p className={`md:hidden text-sm font-semibold tabular-nums whitespace-nowrap ${over ? 'text-rose-400' : 'text-white/80'}`}>
                    {formatCurrency(row.actual)}
                  </p>
                </div>

                {/* Budget input — full width on mobile */}
                <div className="md:col-span-2 md:text-right">
                  <div className={`flex items-center gap-1 bg-18-bg border rounded-lg pl-3 pr-2 py-2 md:py-1 w-full md:inline-flex md:w-auto md:min-w-[110px] transition-colors ${inputBorder}`}>
                    <span className="text-white/50 text-sm md:text-xs">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.draftAmount}
                      onChange={(e) => updateDraft(row.category.id, e.target.value)}
                      onBlur={() => flushSave(row.category.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          flushSave(row.category.id);
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Enter budget"
                      className="bg-transparent text-white text-base md:text-sm font-semibold w-full text-right focus:outline-none tabular-nums placeholder:text-white/30 placeholder:text-sm"
                    />
                  </div>
                </div>

                {/* Actual, desktop column */}
                <div className="hidden md:block md:col-span-2 md:text-right">
                  <p className={`text-sm font-semibold tabular-nums ${over ? 'text-rose-400' : 'text-white/80'}`}>
                    {formatCurrency(row.actual)}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mt-2 md:mt-0 md:col-span-4">
                  {row.budgetAmount > 0 ? (
                    <div className="w-full">
                      <div className="h-2 bg-18-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className={`text-[10px] mt-1 font-semibold ${over ? 'text-rose-400' : 'text-white/50'}`}>
                        {over
                          ? `Over by ${formatCurrency(row.actual - row.budgetAmount)}`
                          : `${pct.toFixed(0)}% used`}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/30 italic">No budget set</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
