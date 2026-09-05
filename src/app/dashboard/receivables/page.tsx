'use client';

// Receivables — money you're owed by other people. Two lifecycle states:
// pending (received_date IS NULL) and received. Pending totals feed the
// dashboard's Current Balance so the "money out in the world" is visible
// alongside bank balances.
//
// ponytail: mark-received just stamps received_date. It does NOT
// auto-insert an income transaction into the picked bank. Users who want
// their bank balance to reflect the return log the income themselves
// (same pattern as investments today). Add auto-income when users ask.

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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data } = await supabase
        .from('receivables')
        .select('*')
        .order('given_date', { ascending: false });
      setRows((data || []) as Receivable[]);
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
        const { data, error } = await supabase.from('receivables').insert(payload).select().single();
        if (error) throw error;
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

  const markReceived = async (r: Receivable) => {
    if (!confirm(`Mark ${formatCurrency(r.amount)} from ${r.from_name} as received?`)) return;
    try {
      const today = formatDateISO(new Date());
      const { data, error } = await supabase
        .from('receivables')
        .update({ received_date: today })
        .eq('id', r.id)
        .select()
        .single();
      if (error) throw error;
      setRows(rows.map((x) => (x.id === r.id ? (data as Receivable) : x)));
      logAction({
        action: 'update',
        table_name: 'receivables',
        record_id: r.id,
        description: `Marked receivable received: ${r.from_name} — ${formatCurrency(r.amount)}`,
        new_values: { received_date: today },
      });
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
            onMark={() => markReceived(r)}
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
