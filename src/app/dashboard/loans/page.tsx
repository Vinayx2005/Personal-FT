'use client';

// Loans — list of debts the user is paying down. Outstanding balance
// per loan is `principal − sum(transactions.amount where loan_id = id)`
// so it stays in sync automatically as EMI expenses are logged (the
// Expenses form shows a "which loan?" picker whenever the category is
// EMI, which stamps loan_id on the transaction).
//
// ponytail: outstanding is the raw principal minus payments made — no
// interest amortisation. For the "how much do I owe today" question
// that's fine; if a user wants a true amortised schedule, add a
// derived view or an interest ledger.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loan } from '@/types';
import { formatCurrency, formatDate, formatDateISO } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Banknote } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

interface Form {
  name: string;
  principal: number;
  emi_amount: number;
  tenure_months: number;
  start_date: string;
  lender: string;
  notes: string;
}

const emptyForm = (): Form => ({
  name: '',
  principal: 0,
  emi_amount: 0,
  tenure_months: 0,
  start_date: formatDateISO(new Date()),
  lender: '',
  notes: '',
});

export default function LoansPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  // Sum of transactions.amount grouped by loan_id — feeds "paid so far".
  const [paidByLoan, setPaidByLoan] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    const [lRes, tRes] = await Promise.all([
      supabase.from('loans').select('*').order('created_at', { ascending: false }),
      // Only need loan_id + amount; small payload even with thousands of rows.
      supabase.from('transactions').select('loan_id, amount').not('loan_id', 'is', null),
    ]);
    setLoans((lRes.data || []) as Loan[]);
    const paid: Record<number, number> = {};
    (tRes.data || []).forEach((t: any) => {
      if (t.loan_id == null) return;
      paid[t.loan_id] = (paid[t.loan_id] || 0) + Number(t.amount || 0);
    });
    setPaidByLoan(paid);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (l: Loan) => {
    setEditingId(l.id);
    setForm({
      name: l.name,
      principal: Number(l.principal) || 0,
      emi_amount: Number(l.emi_amount) || 0,
      tenure_months: Number(l.tenure_months) || 0,
      start_date: l.start_date || formatDateISO(new Date()),
      lender: l.lender || '',
      notes: l.notes || '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.principal || form.principal <= 0) {
      alert('Name and principal are required.');
      return;
    }
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
        name: form.name.trim(),
        principal: form.principal,
        emi_amount: form.emi_amount || null,
        tenure_months: form.tenure_months || null,
        start_date: form.start_date || null,
        lender: form.lender.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const prev = loans.find((l) => l.id === editingId);
        const { data, error } = await supabase
          .from('loans')
          .update(payload)
          .eq('id', editingId)
          .select()
          .single();
        if (error) throw error;
        setLoans(loans.map((l) => (l.id === editingId ? (data as Loan) : l)));
        logAction({
          action: 'update',
          table_name: 'loans',
          record_id: editingId,
          description: `Updated loan: ${payload.name}`,
          old_values: prev as any,
          new_values: payload,
        });
      } else {
        const { data, error } = await supabase
          .from('loans')
          .insert({ ...payload, user_id: uid })
          .select()
          .single();
        if (error) throw error;
        setLoans([data as Loan, ...loans]);
        logAction({
          action: 'create',
          table_name: 'loans',
          record_id: (data as Loan).id,
          description: `Added loan: ${payload.name} — principal ${formatCurrency(payload.principal)}`,
          new_values: payload,
        });
      }
      closeForm();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (l: Loan) => {
    if (!confirm(`Delete loan "${l.name}"? Past EMI transactions are kept but unlinked.`)) return;
    try {
      const { error } = await supabase.from('loans').delete().eq('id', l.id);
      if (error) throw error;
      setLoans(loans.filter((x) => x.id !== l.id));
      logAction({
        action: 'delete',
        table_name: 'loans',
        record_id: l.id,
        description: `Deleted loan: ${l.name}`,
        old_values: l as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const totals = loans.reduce(
    (acc, l) => {
      const principal = Number(l.principal) || 0;
      const paid = paidByLoan[l.id] || 0;
      const out = Math.max(0, principal - paid);
      acc.principal += principal;
      acc.paid += paid;
      acc.outstanding += out;
      return acc;
    },
    { principal: 0, paid: 0, outstanding: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-18-orange border border-18-orange rounded-full px-4 py-2 hover:brightness-110 transition-all"
        >
          <Plus size={14} />
          Add loan
        </button>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-18-surface border border-18-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Principal</p>
          <p className="text-white font-bold text-sm sm:text-base tabular-nums mt-0.5">
            {formatCurrency(totals.principal)}
          </p>
        </div>
        <div className="bg-18-surface border border-18-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Paid</p>
          <p className="text-emerald-400 font-bold text-sm sm:text-base tabular-nums mt-0.5">
            {formatCurrency(totals.paid)}
          </p>
        </div>
        <div className="bg-18-surface border border-18-border rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Outstanding</p>
          <p className="text-rose-400 font-bold text-sm sm:text-base tabular-nums mt-0.5">
            {formatCurrency(totals.outstanding)}
          </p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-18-surface border border-18-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              {editingId ? 'Edit loan' : 'New loan'}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-white/60 hover:text-white p-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Loan name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Home loan, Car loan, Personal loan"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="form-label">Lender / bank</label>
              <input
                type="text"
                className="form-input"
                placeholder="Optional"
                value={form.lender}
                onChange={(e) => setForm({ ...form, lender: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Principal (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.principal || ''}
                onChange={(e) => setForm({ ...form, principal: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div>
              <label className="form-label">EMI amount (₹ per month)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                value={form.emi_amount || ''}
                onChange={(e) => setForm({ ...form, emi_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="form-label">Tenure (months)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                value={form.tenure_months || ''}
                onChange={(e) => setForm({ ...form, tenure_months: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="form-label">Start date</label>
              <input
                type="date"
                className="form-input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
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
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-18-orange text-white rounded-full px-5 py-2.5 text-sm font-bold hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add loan'}
          </button>
        </form>
      )}

      {loans.length === 0 ? (
        <div className="bg-18-surface border border-18-border rounded-2xl p-8 text-center">
          <p className="text-white/60 text-sm">No loans yet.</p>
          <p className="text-white/40 text-xs mt-1">
            Add one, then tag EMI transactions to it — the outstanding
            balance updates automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {loans.map((l) => {
            const principal = Number(l.principal) || 0;
            const paid      = paidByLoan[l.id] || 0;
            const out       = Math.max(0, principal - paid);
            const pct       = principal > 0 ? Math.min(100, (paid / principal) * 100) : 0;
            return (
              <div key={l.id} className="bg-18-surface border border-18-border rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Banknote size={16} className="text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{l.name}</p>
                    <p className="text-[11px] text-white/50 truncate mt-0.5">
                      {formatCurrency(paid)} paid · {formatCurrency(out)} left
                      {l.lender && <> · {l.lender}</>}
                      {l.emi_amount ? <> · EMI {formatCurrency(Number(l.emi_amount))}</> : null}
                      {l.start_date ? <> · from {formatDate(l.start_date)}</> : null}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-rose-400 shrink-0">
                    {formatCurrency(out)}
                  </p>
                </div>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-white/50 tabular-nums">
                    {pct.toFixed(0)}% paid off
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(l)}
                      className="text-white/60 hover:text-18-orange p-1.5"
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(l)}
                      className="text-red-400 hover:text-red-300 p-1.5"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
