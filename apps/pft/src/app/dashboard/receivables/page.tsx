'use client';

// Receivables — money you're owed by other people. Two lifecycle states:
// pending (received_date IS NULL) and received. Pending totals feed the
// dashboard's Current Balance so the "money out in the world" is visible
// alongside bank balances.
//
// Mark-received both stamps received_date AND inserts an income
// transaction into the picked bank so the dashboard's Current Balance
// reflects the money returning. Adding a receivable never touches the
// balance — you tell PFT the money came back by clicking Paid.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Receivable } from '@/types';
import { formatCurrency, formatDate, formatDateISO } from '@/lib/utils';
import { Plus, Trash2, X, Check, Coins, Edit2 } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

interface Form {
  from_name: string;
  amount: number;
  given_date: string;
  notes: string;
}

const emptyForm = (): Form => ({
  from_name: '',
  amount: 0,
  given_date: formatDateISO(new Date()),
  notes: '',
});

export default function ReceivablesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [amountInput, setAmountInput] = useState('');
  const [busy, setBusy] = useState(false);
  // When set, the New-receivable form is in edit mode: submit UPDATEs
  // instead of INSERTs. Populated by startEdit; cleared by cancel + on
  // successful save.
  const [editingId, setEditingId] = useState<number | null>(null);
  // "Mark received" now opens a small modal so users can record a partial
  // payment. `payingRow` is the row being paid; `payAmount` is the input
  // (pre-filled with the outstanding amount). Fully paid stamps
  // received_date; Partially paid reduces the outstanding amount and
  // leaves the row pending.
  const [payingRow, setPayingRow] = useState<Receivable | null>(null);
  const [payAmountInput, setPayAmountInput] = useState('');
  // Banks + income categories loaded so Paid can create a real income
  // transaction into a chosen bank. Selected bank persists across pay
  // modal opens (defaults to first bank the first time).
  const [banks, setBanks] = useState<{ id: number; bank_name: string }[]>([]);
  const [incomeCategoryId, setIncomeCategoryId] = useState<number | null>(null);
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [payBankId, setPayBankId] = useState<number | null>(null);
  // Bank the money came FROM when lending (add form). Same default as
  // payBankId — first bank in the list.
  const [giveBankId, setGiveBankId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const [rowsRes, banksRes, incomeCatRes, expenseCatRes] = await Promise.all([
        supabase.from('receivables').select('*').order('given_date', { ascending: false }),
        supabase.from('banks').select('id, bank_name').order('bank_name'),
        // Dedicated "Receivables" income + expense categories so both
        // sides of the lifecycle stay off Salary/Others. Auto-created
        // the first time a user opens this page.
        supabase.from('categories').select('id').eq('type', 'income').eq('name', 'Receivables').limit(1),
        supabase.from('categories').select('id').eq('type', 'expense').eq('name', 'Receivables').limit(1),
      ]);
      setRows((rowsRes.data || []) as Receivable[]);
      const b = (banksRes.data || []) as { id: number; bank_name: string }[];
      setBanks(b);
      if (b.length > 0) {
        setPayBankId(b[0].id);
        setGiveBankId(b[0].id);
      }

      const ensureCat = async (type: 'income' | 'expense', existing: number | null) => {
        if (existing) return existing;
        if (!user?.id) return null;
        const { data: created } = await supabase
          .from('categories')
          .insert({ type, name: 'Receivables', user_id: user.id, is_default: false })
          .select('id')
          .single();
        return created?.id ?? null;
      };
      setIncomeCategoryId(await ensureCat('income',  (incomeCatRes.data || [])[0]?.id ?? null));
      setExpenseCategoryId(await ensureCat('expense', (expenseCatRes.data || [])[0]?.id ?? null));
      setLoading(false);
    })();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.from_name.trim() || !form.amount || form.amount <= 0) {
      alert('Name and amount are required.');
      return;
    }
    // Auth read may still be in flight if the user clicks fast on a
    // cold session. Grab the id inline as a fallback so the click
    // doesn't silently bail.
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id ?? null;
      setUserId(uid);
      if (!uid) { alert('Still signing you in — try again in a second.'); return; }
    }
    setBusy(true);
    try {
      const payload = {
        user_id: uid,
        from_name: form.from_name.trim(),
        amount: form.amount,
        given_date: form.given_date,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const prev = rows.find((x) => x.id === editingId);
        const { data, error } = await supabase
          .from('receivables')
          .update({
            from_name: payload.from_name,
            amount: payload.amount,
            given_date: payload.given_date,
            notes: payload.notes,
          })
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;
        setRows(rows.map((x) => (x.id === editingId ? (data as Receivable) : x)));
        logAction({
          action: 'update',
          table_name: 'receivables',
          record_id: editingId,
          description: `Updated receivable: ${payload.from_name} — ${formatCurrency(payload.amount)}`,
          old_values: prev as any,
          new_values: payload,
        });
      } else {
        if (!giveBankId)        { alert('Pick a bank to lend from.'); return; }
        if (!expenseCategoryId) { alert('Receivables expense category missing.'); return; }
        const { data, error } = await supabase.from('receivables').insert(payload).select().single();
        if (error) throw error;
        // Debit the chosen bank so the balance drops right away, tagged
        // with the Receivables expense category. Symmetric with the
        // income tx created on mark-received.
        await supabase.from('transactions').insert({
          transaction_type: 'expense',
          bank_id: giveBankId,
          category_id: expenseCategoryId,
          description: `Lent to ${payload.from_name}`,
          amount: payload.amount,
          transaction_date: payload.given_date,
          status: 'posted',
          created_at: new Date().toISOString(),
          created_by: uid,
        });
        setRows([data as Receivable, ...rows]);
        logAction({
          action: 'create',
          table_name: 'receivables',
          record_id: (data as Receivable).id,
          description: `Added receivable: ${payload.from_name} — ${formatCurrency(payload.amount)}`,
          new_values: payload,
        });
      }
      setForm(emptyForm());
      setAmountInput('');
      setEditingId(null);
      setShowForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: Receivable) => {
    setEditingId(r.id);
    setForm({
      from_name: r.from_name,
      amount: Number(r.amount) || 0,
      given_date: r.given_date,
      notes: r.notes || '',
    });
    setAmountInput(String(r.amount ?? ''));
    setShowForm(true);
    // Bring the form into view since it's above the row on mobile.
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openPayModal = (r: Receivable) => {
    setPayingRow(r);
    setPayAmountInput(String(r.amount));
  };
  const closePayModal = () => {
    setPayingRow(null);
    setPayAmountInput('');
  };

  /** Insert the income transaction into the selected bank. Shared by
   *  fully-paid and partial-paid so the balance always moves the same
   *  way whether the return comes in one hit or several. */
  const createIncomeTx = async (r: Receivable, amount: number) => {
    if (!userId || !payBankId || !incomeCategoryId) return;
    const today = formatDateISO(new Date());
    await supabase.from('transactions').insert({
      transaction_type: 'income',
      bank_id: payBankId,
      category_id: incomeCategoryId,
      description: `Received from ${r.from_name}`,
      amount,
      transaction_date: today,
      status: 'posted',
      created_at: new Date().toISOString(),
      created_by: userId,
    });
  };

  const markFullyPaid = async () => {
    if (!payingRow) return;
    if (!payBankId)        { alert('Pick a bank to deposit into.'); return; }
    if (!incomeCategoryId) { alert('No income category found. Create one in Categories.'); return; }
    const r = payingRow;
    try {
      const today = formatDateISO(new Date());
      const { data, error } = await supabase
        .from('receivables')
        .update({ received_date: today })
        .eq('id', r.id)
        .select()
        .single();
      if (error) throw error;
      await createIncomeTx(r, Number(r.amount));
      setRows(rows.map((x) => (x.id === r.id ? (data as Receivable) : x)));
      logAction({
        action: 'update',
        table_name: 'receivables',
        record_id: r.id,
        description: `Received in full from ${r.from_name}: ${formatCurrency(r.amount)}`,
        new_values: { received_date: today },
      });
      closePayModal();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const markPartiallyPaid = async () => {
    if (!payingRow) return;
    if (!payBankId)        { alert('Pick a bank to deposit into.'); return; }
    if (!incomeCategoryId) { alert('No income category found. Create one in Categories.'); return; }
    const r = payingRow;
    const paid = parseFloat(payAmountInput) || 0;
    if (paid <= 0)            { alert('Enter an amount greater than zero.'); return; }
    if (paid >= Number(r.amount)) {
      // Amount ≥ outstanding == fully paid; skip partial path.
      markFullyPaid();
      return;
    }
    const remaining = Number(r.amount) - paid;
    try {
      const { data, error } = await supabase
        .from('receivables')
        .update({ amount: remaining })
        .eq('id', r.id)
        .select()
        .single();
      if (error) throw error;
      await createIncomeTx(r, paid);
      setRows(rows.map((x) => (x.id === r.id ? (data as Receivable) : x)));
      logAction({
        action: 'update',
        table_name: 'receivables',
        record_id: r.id,
        description: `Partial payment from ${r.from_name}: ${formatCurrency(paid)} received, ${formatCurrency(remaining)} still pending`,
        old_values: { amount: r.amount },
        new_values: { amount: remaining, paid },
      });
      closePayModal();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const unmarkReceived = async (r: Receivable) => {
    try {
      const { data, error } = await supabase
        .from('receivables')
        .update({ received_date: null })
        .eq('id', r.id)
        .select()
        .single();
      if (error) throw error;
      setRows(rows.map((x) => (x.id === r.id ? (data as Receivable) : x)));
      logAction({
        action: 'update',
        table_name: 'receivables',
        record_id: r.id,
        description: `Reopened receivable: ${r.from_name} — ${formatCurrency(r.amount)}`,
        new_values: { received_date: null },
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (r: Receivable) => {
    if (!confirm(`Delete receivable from ${r.from_name}?`)) return;
    try {
      const { error } = await supabase.from('receivables').delete().eq('id', r.id);
      if (error) throw error;
      setRows(rows.filter((x) => x.id !== r.id));
      logAction({
        action: 'delete',
        table_name: 'receivables',
        record_id: r.id,
        description: `Deleted receivable: ${r.from_name} — ${formatCurrency(r.amount)}`,
        old_values: r as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const pending  = rows.filter((r) => r.received_date === null);
  const received = rows.filter((r) => r.received_date !== null);
  const pendingTotal  = pending.reduce((s, r) => s + Number(r.amount), 0);
  const receivedTotal = received.reduce((s, r) => s + Number(r.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add button at top-right, matching other More sub-pages */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (showForm) { setShowForm(false); setForm(emptyForm()); setAmountInput(''); setEditingId(null); }
            else { setForm(emptyForm()); setAmountInput(''); setEditingId(null); setShowForm(true); }
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-18-orange border border-18-orange rounded-full px-4 py-2 hover:brightness-110 transition-all"
        >
          <Plus size={14} />
          Add receivable
        </button>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="bg-18-surface border border-18-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Pending</p>
          <p className="text-emerald-400 font-bold text-sm sm:text-base tabular-nums mt-0.5">
            {formatCurrency(pendingTotal)}
          </p>
          <p className="text-[10px] text-white/40 mt-1">{pending.length} {pending.length === 1 ? 'entry' : 'entries'}</p>
        </div>
        <div className="bg-18-surface border border-18-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Received</p>
          <p className="text-white/80 font-bold text-sm sm:text-base tabular-nums mt-0.5">
            {formatCurrency(receivedTotal)}
          </p>
          <p className="text-[10px] text-white/40 mt-1">{received.length} {received.length === 1 ? 'entry' : 'entries'}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-18-surface border border-18-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              {editingId ? 'Edit receivable' : 'New receivable'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm()); setAmountInput(''); setEditingId(null); }}
              className="text-white/60 hover:text-white p-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">From *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Whom you gave"
                value={form.from_name}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Amount (₹) *</label>
              <input
                type="text"
                inputMode="decimal"
                className="form-input"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                    setAmountInput(raw);
                    setForm({ ...form, amount: raw === '' ? 0 : parseFloat(raw) || 0 });
                  }
                }}
                required
              />
            </div>
            <div>
              <label className="form-label">Given on</label>
              <input
                type="date"
                className="form-input"
                value={form.given_date}
                onChange={(e) => setForm({ ...form, given_date: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-input"
                placeholder="Optional"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {/* Bank picker only shown when adding a new receivable —
                editing shouldn't retro-create a bank transaction. */}
            {!editingId && (
              <div>
                <label className="form-label">Paid from</label>
                <select
                  className="form-input"
                  value={giveBankId ?? ''}
                  onChange={(e) => setGiveBankId(Number(e.target.value) || null)}
                >
                  {banks.length === 0 && <option value="">No banks — add one first</option>}
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-18-orange text-white rounded-full px-5 py-2.5 text-sm font-bold hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add receivable'}
          </button>
        </form>
      )}

      {/* Pending list */}
      <Section title="Pending" empty="Nothing pending. Add a receivable when you loan money to someone.">
        {pending.map((r) => (
          <Row
            key={r.id}
            r={r}
            onMark={() => openPayModal(r)}
            onEdit={() => startEdit(r)}
            onDelete={() => handleDelete(r)}
          />
        ))}
      </Section>

      {/* Received list (collapsed visually — smaller, muted) */}
      {received.length > 0 && (
        <Section title="Received" empty="">
          {received.map((r) => (
            <Row
              key={r.id}
              r={r}
              muted
              onUnmark={() => unmarkReceived(r)}
              onEdit={() => startEdit(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </Section>
      )}

      {/* Pay modal — asks how much was received. Fully paid stamps the
          received date; Partial reduces the outstanding amount and keeps
          the row pending. */}
      {payingRow && (() => {
        const outstanding = Number(payingRow.amount);
        const paid = parseFloat(payAmountInput);
        const validPaid = Number.isFinite(paid) && paid > 0;
        const isPartial = validPaid && paid < outstanding;
        return (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
            onClick={closePayModal}
          >
            <div
              className="bg-18-surface border border-18-border rounded-2xl w-full sm:max-w-sm p-5 shadow-[0_20px_80px_-10px_rgba(0,0,0,0.9)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white">
                    Record payment from {payingRow.from_name}
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Outstanding{' '}
                    <span className="text-white font-semibold">
                      {formatCurrency(outstanding)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closePayModal}
                  className="text-white/50 hover:text-white p-1 -mt-1 -mr-1"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
                Deposit into
              </label>
              <select
                className="form-input mt-1 mb-3 w-full"
                value={payBankId ?? ''}
                onChange={(e) => setPayBankId(Number(e.target.value) || null)}
              >
                {banks.length === 0 && <option value="">No banks — add one first</option>}
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.bank_name}</option>
                ))}
              </select>

              <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
                Amount received (₹)
              </label>
              {/* Input + "Fully paid" checkbox on one row. Checking the box
                  autofills the input with the outstanding amount and locks
                  it; unchecking hands editing back for a partial. */}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  disabled={payAmountInput === String(outstanding)}
                  className="form-input flex-1"
                  value={payAmountInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                      setPayAmountInput(raw);
                    }
                  }}
                />
                <label className="flex items-center gap-1.5 text-xs text-white/70 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payAmountInput === String(outstanding)}
                    onChange={(e) => {
                      // Checked → autofill full outstanding. Unchecked → clear
                      // so the user can type a partial amount.
                      setPayAmountInput(e.target.checked ? String(outstanding) : '');
                    }}
                    className="accent-18-orange h-4 w-4"
                  />
                  Fully paid
                </label>
              </div>
              {validPaid && isPartial && (
                <p className="text-xs text-white/60 mt-2">
                  Remaining after partial:{' '}
                  <span className="text-emerald-400 font-semibold tabular-nums">
                    {formatCurrency(outstanding - paid)}
                  </span>
                </p>
              )}

              <button
                type="button"
                disabled={!validPaid || paid > outstanding}
                onClick={paid >= outstanding ? markFullyPaid : markPartiallyPaid}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-18-orange border border-18-orange rounded-full px-5 py-2.5 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={14} />
                Paid
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  const isEmpty = arr.filter(Boolean).length === 0;
  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold px-1">{title}</p>
      {isEmpty ? (
        empty ? (
          <div className="bg-18-surface border border-18-border rounded-2xl p-6 text-center">
            <p className="text-white/60 text-sm">{empty}</p>
          </div>
        ) : null
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function Row({
  r,
  muted = false,
  onMark,
  onUnmark,
  onEdit,
  onDelete,
}: {
  r: Receivable;
  muted?: boolean;
  onMark?: () => void;
  onUnmark?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`bg-18-surface border rounded-xl p-3 ${muted ? 'border-white/5 opacity-70' : 'border-18-border'}`}>
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Coins size={16} className="text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{r.from_name}</p>
          <p className="text-[11px] text-white/50 truncate mt-0.5">
            Given {formatDate(r.given_date)}
            {r.received_date && <> · Received {formatDate(r.received_date)}</>}
            {r.notes && <> · {r.notes}</>}
          </p>
        </div>
        <p className={`text-sm font-bold tabular-nums shrink-0 ${muted ? 'text-white/60' : 'text-emerald-400'}`}>
          {formatCurrency(r.amount)}
        </p>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2">
        {onMark && (
          <button
            onClick={onMark}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1"
            title="Mark as received"
          >
            <Check size={12} /> Mark received
          </button>
        )}
        {onUnmark && (
          <button
            onClick={onUnmark}
            className="text-xs font-semibold text-white/60 hover:text-white bg-white/5 border border-white/10 rounded-full px-3 py-1"
            title="Move back to pending"
          >
            Reopen
          </button>
        )}
        <button
          onClick={onEdit}
          className="text-white/60 hover:text-18-orange p-1.5"
          title="Edit"
          aria-label="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={onDelete}
          className="text-red-400 hover:text-red-300 p-1.5"
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
