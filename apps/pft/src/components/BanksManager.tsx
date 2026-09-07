'use client';

// Banks / Cards manager. Rendered:
//   • as the whole /dashboard/banks page on mobile (reached from the More tab)
//   • inline in the Settings page on desktop (where sidebar-nav users
//     expect banks + categories to live alongside the other account knobs)
// Manages the list of funding accounts, their opening + current balance,
// the balance-change history, and add / edit / delete. Numbers auto-derive
// from opening + net-transaction-movement so users can correct a wrong
// balance with a single field ("what my statement says right now") and
// we back-compute the opening so it lines up without touching any
// transaction rows.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bank, BankBalanceHistory } from '@/types';
import { formatCurrency, formatDate, formatDateISO } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, History } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

export default function BanksManager() {
  const [refreshTick, setRefreshTick] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  // net (income − expense) across all time, keyed by bank_id.
  const [bankNet, setBankNet] = useState<Record<number, number>>({});
  // Net movement per bank BEFORE today (client local) so each row can show
  // "today's opening" — the anchor balance at 00:00 that rolls forward
  // naturally as yesterday's transactions cross the midnight boundary.
  const [bankNetBeforeToday, setBankNetBeforeToday] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ bank_name: '', opening_balance: 0 });
  // Separate raw text so the input can truly be empty — a stored `0` used
  // to render as "0" that couldn't be cleared.
  const [openingInput, setOpeningInput] = useState('');
  const [reason, setReason] = useState('');
  const [historyOpenFor, setHistoryOpenFor] = useState<number | null>(null);
  const [historyByBank, setHistoryByBank] = useState<Record<number, BankBalanceHistory[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserId(user?.id ?? null);

        const { data: banksData } = await supabase.from('banks').select('*');
        const { data: allTxData } = await supabase
          .from('transactions')
          .select('bank_id, transaction_type, amount, transaction_date')
          .eq('status', 'posted');

        const todayIso = formatDateISO(new Date());
        const net: Record<number, number> = {};
        const netBeforeToday: Record<number, number> = {};
        (allTxData || []).forEach((t: any) => {
          if (!t.bank_id) return;
          const delta = t.transaction_type === 'income' ? t.amount : -t.amount;
          net[t.bank_id] = (net[t.bank_id] || 0) + delta;
          if (t.transaction_date && t.transaction_date < todayIso) {
            netBeforeToday[t.bank_id] = (netBeforeToday[t.bank_id] || 0) + delta;
          }
        });
        setBanks(banksData || []);
        setBankNet(net);
        setBankNetBeforeToday(netBeforeToday);
        setLoading(false);
      } catch (err) {
        console.error('Banks load failed:', err);
        setLoading(false);
      }
    })();
  }, [refreshTick]);

  // Refetch when the tab regains focus so a bank balance edited elsewhere
  // (e.g. on the Expenses page via an add) shows up here without a reload.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRefreshTick((t) => t + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const resetForm = () => {
    setForm({ bank_name: '', opening_balance: 0 });
    setOpeningInput('');
    setEditingId(null);
    setReason('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) { alert('Session expired — please reload.'); return; }
    if (!form.bank_name.trim()) { alert('Bank name is required'); return; }

    try {
      if (editingId) {
        const existing = banks.find((b) => b.id === editingId);
        const prevOpening = existing?.opening_balance ?? 0;
        const net = bankNet[editingId] || 0;
        const prevCurrent = prevOpening + net;
        // In edit mode `form.opening_balance` holds the DESIRED CURRENT
        // balance; back-compute opening so opening + net = desiredCurrent.
        // Transactions (the `net` term) are untouched.
        const desiredCurrent = form.opening_balance;
        const newOpening = desiredCurrent - net;
        const balanceChanged = prevCurrent !== desiredCurrent;

        const { data, error } = await supabase
          .from('banks')
          .update({
            bank_name: form.bank_name,
            opening_balance: newOpening,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;

        if (balanceChanged) {
          await supabase.from('bank_balance_history').insert({
            bank_id: editingId,
            previous_balance: prevOpening,
            new_balance: newOpening,
            reason: reason.trim() || null,
            changed_by: userId,
          });
          setHistoryByBank((h) => {
            const next = { ...h };
            delete next[editingId];
            return next;
          });
          logAction({
            action: 'update',
            table_name: 'banks',
            record_id: editingId,
            description: `Corrected ${form.bank_name} balance: ${formatCurrency(prevCurrent)} → ${formatCurrency(desiredCurrent)}${reason ? ` (${reason})` : ''}`,
            old_values: { opening_balance: prevOpening, current_balance: prevCurrent },
            new_values: { opening_balance: newOpening, current_balance: desiredCurrent, reason },
          });
        } else {
          logAction({
            action: 'update',
            table_name: 'banks',
            record_id: editingId,
            description: `Updated bank details: ${form.bank_name}`,
            new_values: { bank_name: form.bank_name },
          });
        }
        setBanks(banks.map((b) => (b.id === editingId ? { ...b, ...data } : b)));
      } else {
        const { data, error } = await supabase
          .from('banks')
          .insert({ ...form, is_active: true, user_id: userId })
          .select()
          .single();
        if (error) throw error;

        if (form.opening_balance) {
          await supabase.from('bank_balance_history').insert({
            bank_id: data.id,
            previous_balance: null,
            new_balance: form.opening_balance,
            reason: 'Initial balance',
            changed_by: userId,
          });
        }
        logAction({
          action: 'create',
          table_name: 'banks',
          record_id: data.id,
          description: `Added bank: ${form.bank_name} — opening ${formatCurrency(form.opening_balance)}`,
          new_values: form,
        });
        setBanks([...banks, data]);
      }
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const startEdit = (bank: Bank) => {
    const opening = bank.opening_balance || 0;
    const net = bankNet[bank.id] || 0;
    const current = opening + net;
    setForm({ bank_name: bank.bank_name, opening_balance: current });
    setOpeningInput(current !== 0 ? String(current) : '');
    setEditingId(bank.id);
    setReason('');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this bank?')) return;
    try {
      const prev = banks.find((b) => b.id === id);
      const { error } = await supabase.from('banks').delete().eq('id', id);
      if (error) throw error;
      setBanks(banks.filter((b) => b.id !== id));
      logAction({
        action: 'delete',
        table_name: 'banks',
        record_id: id,
        description: `Deleted bank: ${prev?.bank_name}`,
        old_values: prev as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const toggleHistory = async (bankId: number) => {
    if (historyOpenFor === bankId) { setHistoryOpenFor(null); return; }
    setHistoryOpenFor(bankId);
    if (!historyByBank[bankId]) {
      const { data, error } = await supabase
        .from('bank_balance_history')
        .select('*')
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false });
      if (error) { alert(`Error loading history: ${error.message}`); return; }
      setHistoryByBank((h) => ({ ...h, [bankId]: data || [] }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page identity comes from the More tab that brought you here — no
          H1 needed. Just the action pill at the top-right. */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (showForm) { setShowForm(false); resetForm(); }
            else { resetForm(); setShowForm(true); }
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-18-orange border border-18-orange rounded-full px-4 py-2 hover:brightness-110 transition-all"
        >
          <Plus size={14} />
          Add bank / card
        </button>
      </div>

      {showForm && (
        <div className="bg-18-surface border border-18-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {editingId ? 'Edit bank / card' : 'Add bank / card'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); resetForm(); }}
              className="text-white/60 hover:text-white p-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Bank name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group md:col-span-2">
                <label className="form-label">
                  {editingId ? 'Current balance (₹)' : 'Opening balance (₹)'}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-input"
                  placeholder="0.00"
                  value={openingInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Accept empty OR a valid partial decimal (leading `-` for
                    // credit cards / accounts starting in the red).
                    if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
                      setOpeningInput(raw);
                      setForm({
                        ...form,
                        opening_balance: raw === '' ? 0 : parseFloat(raw) || 0,
                      });
                    }
                  }}
                />
                <p className="text-xs text-white/50 mt-1">
                  {editingId
                    ? "What your statement shows right now. We'll adjust the opening balance so the math lines up — transactions aren't touched."
                    : 'Starting cash in this account. Enter a negative value for credit cards or any account that starts in the red.'}
                </p>
              </div>
              {editingId && (() => {
                const existing = banks.find((b) => b.id === editingId);
                const existingOpening = existing?.opening_balance || 0;
                const net = bankNet[editingId] || 0;
                const existingCurrent = existingOpening + net;
                if (form.opening_balance === existingCurrent) return null;
                return (
                  <div className="form-group md:col-span-2">
                    <label className="form-label">Reason for balance correction</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Reconciled to bank statement"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <p className="text-xs text-white/50 mt-1">
                      Logged in the balance history for this bank.
                    </p>
                  </div>
                );
              })()}
            </div>

            <button type="submit" className="btn btn-primary">
              {editingId ? 'Save changes' : 'Add bank / card'}
            </button>
          </form>
        </div>
      )}

      <div className="bg-18-surface border border-18-border rounded-2xl p-3">
        {banks.length > 0 ? (
          <div className="divide-y divide-18-border">
            {banks.map((bank) => {
              const opening = bank.opening_balance || 0;
              const net = bankNet[bank.id] || 0;
              const current = opening + net;
              const netBeforeToday = bankNetBeforeToday[bank.id] || 0;
              const todayOpening = opening + netBeforeToday;
              const todayChange = current - todayOpening;
              return (
                <div key={bank.id} className="py-3 first:pt-2 last:pb-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-bold text-white truncate">{bank.bank_name}</p>
                    <p className={`text-lg md:text-xl font-bold whitespace-nowrap tabular-nums ${current < 0 ? 'text-red-300' : 'text-white'}`}>
                      {formatCurrency(current)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <p className="text-[11px] text-white/50 min-w-0 flex-1 truncate">
                      Today&apos;s opening {formatCurrency(todayOpening)}
                      {todayChange !== 0 && (
                        <>
                          {' · '}
                          <span className={todayChange > 0 ? 'text-green-400' : 'text-red-400'}>
                            {todayChange > 0 ? '+' : ''}
                            {formatCurrency(todayChange)}
                          </span>
                        </>
                      )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleHistory(bank.id)}
                        className={`hover:text-18-orange p-2 -m-1 transition-colors ${
                          historyOpenFor === bank.id ? 'text-18-orange' : 'text-white/50'
                        }`}
                        title="Balance history"
                        aria-label="Balance history"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => startEdit(bank)}
                        className="text-white/50 hover:text-18-orange p-2 -m-1 transition-colors"
                        title="Edit bank"
                        aria-label="Edit bank"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(bank.id)}
                        className="text-red-400 hover:text-red-300 p-2 -m-1 transition-colors"
                        title="Delete bank"
                        aria-label="Delete bank"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {historyOpenFor === bank.id && (
                    <div className="mt-4 pl-4 border-l-2 border-18-border">
                      <p className="text-xs uppercase font-bold text-white/50 mb-2">
                        Opening balance history
                      </p>
                      {historyByBank[bank.id] === undefined ? (
                        <p className="text-xs text-white/50">Loading…</p>
                      ) : historyByBank[bank.id].length === 0 ? (
                        <p className="text-xs text-white/50">No changes recorded.</p>
                      ) : (
                        <ul className="space-y-2">
                          {historyByBank[bank.id].map((h) => (
                            <li key={h.id} className="text-xs">
                              <span className="text-white/50">{formatDate(h.created_at)} — </span>
                              {h.previous_balance !== null ? (
                                <>
                                  <span className="text-red-400 line-through">
                                    {formatCurrency(h.previous_balance)}
                                  </span>
                                  <span className="mx-2 text-white/50">→</span>
                                </>
                              ) : (
                                <span className="mr-1 text-white/50 italic">initial</span>
                              )}
                              <span className="font-semibold text-white">
                                {formatCurrency(h.new_balance)}
                              </span>
                              {h.reason && (
                                <span className="text-white/50"> — {h.reason}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-white/50 text-center py-8">No banks yet — add one to get started.</p>
        )}
      </div>
    </div>
  );
}
