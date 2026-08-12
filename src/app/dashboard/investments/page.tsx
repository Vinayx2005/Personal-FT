'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Bank,
  Category,
  Investment,
  InvestmentType,
  INVESTMENT_TYPE_LABELS,
  Sip,
  SipFrequency,
  SIP_FREQUENCY_LABELS,
} from '@/types';
import { formatCurrency, formatDate, formatDateISO } from '@/lib/utils';
import { Plus, Trash2, X, Repeat, Pause, Play, Calendar } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

const TYPE_OPTIONS: InvestmentType[] = ['fd', 'smallcase', 'stocks', 'mutual_fund', 'others'];
const SIP_FREQ_OPTIONS: SipFrequency[] = ['monthly', 'quarterly', 'weekly'];

// Given today + frequency + debit_day, return the FIRST future debit ISO date
// so the initial cron pickup lines up with the user's schedule. Same logic as
// the cron's roll-forward, but bootstrapping from "today" instead of a prior
// debit. Runs on the client for the form preview + initial insert.
function computeFirstDebitDate(startIso: string, freq: SipFrequency, day: number): string {
  const start = new Date(startIso + 'T00:00:00');
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  if (freq === 'weekly') {
    // day = 1 (Mon) .. 7 (Sun). JS getDay(): 0=Sun..6=Sat.
    const jsTargetDow = day === 7 ? 0 : day; // 1..6 for Mon..Sat; 0 for Sun
    const d = new Date(start);
    const cur = d.getDay();
    let delta = jsTargetDow - cur;
    if (delta < 0) delta += 7;
    d.setDate(d.getDate() + delta);
    return iso(d);
  }
  // monthly or quarterly — target debit_day in the start month; if that date
  // already passed, roll forward one cycle.
  const monthStep = freq === 'monthly' ? 1 : 3;
  const target = new Date(start);
  target.setDate(1);
  let daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInMonth));
  if (target < start) {
    target.setDate(1);
    target.setMonth(target.getMonth() + monthStep);
    daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, daysInMonth));
  }
  return iso(target);
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [sips, setSips] = useState<Sip[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSipForm, setShowSipForm] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'fd' as InvestmentType,
    amount: 0,
    source_bank_id: 0,
    start_date: formatDateISO(new Date()),
    maturity_date: '',
    interest_rate: 0,
    notes: '',
    deduct_from_bank: true,
  });

  const [sipForm, setSipForm] = useState({
    name: '',
    amount: 0,
    frequency: 'monthly' as SipFrequency,
    debit_day: 1,
    source_bank_id: 0,
    category_id: 0,
    investment_id: 0, // 0 = not linked
    start_date: formatDateISO(new Date()),
    end_date: '',
    notes: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setCurrentUserId(authUser?.id ?? null);

        const [banksRes, invRes, catsRes, sipsRes] = await Promise.all([
          supabase.from('banks').select('*').eq('is_active', true),
          supabase.from('investments').select('*').order('created_at', { ascending: false }),
          supabase.from('categories').select('*').eq('type', 'expense').order('name'),
          supabase.from('sips').select('*').order('next_debit_date', { ascending: true }),
        ]);

        setBanks(banksRes.data || []);
        setInvestments(invRes.data || []);
        setExpenseCategories(catsRes.data || []);
        setSips(sipsRes.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error loading investments:', err);
        setLoading(false);
      }
    };
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      type: 'fd',
      amount: 0,
      source_bank_id: 0,
      start_date: formatDateISO(new Date()),
      maturity_date: '',
      interest_rate: 0,
      notes: '',
      deduct_from_bank: true,
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount || form.amount <= 0) {
      alert('Name and amount are required.');
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        amount: form.amount,
        source_bank_id: form.source_bank_id || null,
        start_date: form.start_date || null,
        maturity_date: form.maturity_date || null,
        interest_rate: form.interest_rate || null,
        notes: form.notes || null,
        created_by: currentUserId,
      };
      const { data, error } = await supabase.from('investments').insert(payload).select().single();
      if (error) throw error;

      // Optionally deduct from source bank
      if (form.deduct_from_bank && form.source_bank_id) {
        const src = banks.find((b) => b.id === form.source_bank_id);
        if (src) {
          const newBalance = (src.opening_balance || 0) - form.amount;
          const { error: updErr } = await supabase
            .from('banks')
            .update({ opening_balance: newBalance, updated_at: new Date().toISOString() })
            .eq('id', src.id);
          if (updErr) console.error('bank update failed:', updErr.message);
          else {
            await supabase.from('bank_balance_history').insert({
              bank_id: src.id,
              previous_balance: src.opening_balance || 0,
              new_balance: newBalance,
              reason: `Moved to investment: ${form.name.trim()}`,
              changed_by: currentUserId,
            });
            setBanks(banks.map((b) => (b.id === src.id ? { ...b, opening_balance: newBalance } : b)));
          }
        }
      }

      setInvestments([data, ...investments]);
      logAction({
        action: 'create',
        table_name: 'investments',
        record_id: data.id,
        description: `Added ${INVESTMENT_TYPE_LABELS[form.type]}: ${payload.name} — ${formatCurrency(payload.amount)}${form.deduct_from_bank && form.source_bank_id ? ' (deducted from bank)' : ''}`,
        new_values: payload,
      });
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this investment? (Bank balances are NOT reverted automatically.)')) return;
    try {
      const prev = investments.find((i) => i.id === id);
      const { error } = await supabase.from('investments').delete().eq('id', id);
      if (error) throw error;
      setInvestments(investments.filter((i) => i.id !== id));
      logAction({
        action: 'delete',
        table_name: 'investments',
        record_id: id,
        description: `Deleted ${prev ? INVESTMENT_TYPE_LABELS[prev.type] : 'investment'}: ${prev?.name}`,
        old_values: prev as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // ------- SIP handlers -------

  const resetSipForm = () => {
    setSipForm({
      name: '',
      amount: 0,
      frequency: 'monthly',
      debit_day: 1,
      source_bank_id: 0,
      category_id: 0,
      investment_id: 0,
      start_date: formatDateISO(new Date()),
      end_date: '',
      notes: '',
    });
  };

  const handleAddSip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sipForm.name.trim() || !sipForm.amount || sipForm.amount <= 0) {
      alert('Name and amount are required.');
      return;
    }
    if (!sipForm.source_bank_id) {
      alert('Pick a source bank — SIP needs to know which account to debit from.');
      return;
    }
    try {
      const nextDebit = computeFirstDebitDate(
        sipForm.start_date,
        sipForm.frequency,
        sipForm.debit_day
      );
      const payload = {
        user_id: currentUserId,
        name: sipForm.name.trim(),
        amount: sipForm.amount,
        frequency: sipForm.frequency,
        debit_day: sipForm.debit_day,
        source_bank_id: sipForm.source_bank_id,
        category_id: sipForm.category_id || null,
        investment_id: sipForm.investment_id || null,
        start_date: sipForm.start_date,
        end_date: sipForm.end_date || null,
        next_debit_date: nextDebit,
        notes: sipForm.notes || null,
      };
      const { data, error } = await supabase.from('sips').insert(payload).select().single();
      if (error) throw error;
      setSips([data as Sip, ...sips]);
      logAction({
        action: 'create',
        table_name: 'sips',
        record_id: (data as Sip).id,
        description: `Set up SIP: ${payload.name} — ${formatCurrency(payload.amount)} ${SIP_FREQUENCY_LABELS[payload.frequency]}`,
        new_values: payload,
      });
      resetSipForm();
      setShowSipForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleSip = async (id: number) => {
    const cur = sips.find((s) => s.id === id);
    if (!cur) return;
    try {
      const { data, error } = await supabase
        .from('sips')
        .update({ is_active: !cur.is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      setSips(sips.map((s) => (s.id === id ? (data as Sip) : s)));
      logAction({
        action: 'update',
        table_name: 'sips',
        record_id: id,
        description: `${cur.is_active ? 'Paused' : 'Resumed'} SIP: ${cur.name}`,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteSip = async (id: number) => {
    if (!confirm('Delete this SIP? Past auto-debits stay in your expenses; future ones stop.')) return;
    try {
      const prev = sips.find((s) => s.id === id);
      const { error } = await supabase.from('sips').delete().eq('id', id);
      if (error) throw error;
      setSips(sips.filter((s) => s.id !== id));
      logAction({
        action: 'delete',
        table_name: 'sips',
        record_id: id,
        description: `Deleted SIP: ${prev?.name}`,
        old_values: prev as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  const total = investments.reduce((s, i) => s + (i.amount || 0), 0);
  const byType = TYPE_OPTIONS.map((t) => ({
    type: t,
    label: INVESTMENT_TYPE_LABELS[t],
    total: investments.filter((i) => i.type === t).reduce((s, i) => s + (i.amount || 0), 0),
    count: investments.filter((i) => i.type === t).length,
  }));

  // Monthly-equivalent commitment across all active SIPs — quarterly ÷ 3,
  // weekly × ~4.33. Handy summary number without joining.
  const monthlySipCommit = sips
    .filter((s) => s.is_active)
    .reduce((acc, s) => {
      if (s.frequency === 'monthly') return acc + Number(s.amount);
      if (s.frequency === 'quarterly') return acc + Number(s.amount) / 3;
      // weekly
      return acc + Number(s.amount) * (52 / 12);
    }, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Investments</h1>
          <p className="text-18-dark-text">Track FDs, Smallcases, Stocks, Mutual Funds and more</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={16} />
          Add Investment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="card !bg-18-orange/15 !border-18-orange/40">
          <p className="text-xs font-bold uppercase text-white">Total</p>
          <h3 className="text-base md:text-lg font-bold text-white break-words">{formatCurrency(total)}</h3>
          <p className="text-xs text-white/70 mt-1">{investments.length} item{investments.length !== 1 ? 's' : ''}</p>
        </div>
        {byType.map((b) => (
          <div key={b.type} className="card">
            <p className="text-xs font-bold uppercase text-18-dark-text">{b.label}</p>
            <h3 className="text-base md:text-lg font-bold text-white break-words">{formatCurrency(b.total)}</h3>
            <p className="text-xs text-18-dark-text mt-1">{b.count} item{b.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {/* -------- SIP section -------- */}
      <div className="card bg-18-surface border-18-border mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-18-orange/20 border border-18-orange/40 flex items-center justify-center">
              <Repeat size={14} className="text-18-orange" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">SIPs — recurring debits</h3>
              <p className="text-[11px] text-white/50 leading-tight">
                Auto-records each scheduled instalment as an expense.{' '}
                <span className="text-white/70">
                  You still set the actual debit up with your bank / MF.
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {monthlySipCommit > 0 && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">Monthly commit</p>
                <p className="text-sm font-bold text-white">{formatCurrency(monthlySipCommit)}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSipForm(!showSipForm)}
              className="btn btn-primary"
            >
              <Plus size={14} /> Add SIP
            </button>
          </div>
        </div>

        {showSipForm && (
          <form
            onSubmit={handleAddSip}
            className="bg-18-bg/60 border border-18-border rounded-xl p-4 mb-4 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Nifty50 monthly SIP"
                  value={sipForm.name}
                  onChange={(e) => setSipForm({ ...sipForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Amount per debit (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={sipForm.amount || ''}
                  onChange={(e) => setSipForm({ ...sipForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Frequency *</label>
                <select
                  className="form-select"
                  value={sipForm.frequency}
                  onChange={(e) => setSipForm({ ...sipForm, frequency: e.target.value as SipFrequency })}
                >
                  {SIP_FREQ_OPTIONS.map((f) => (
                    <option key={f} value={f}>{SIP_FREQUENCY_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {sipForm.frequency === 'weekly'
                    ? 'Day of week (1=Mon … 7=Sun) *'
                    : 'Day of month (1–31) *'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={sipForm.frequency === 'weekly' ? 7 : 31}
                  className="form-input"
                  value={sipForm.debit_day}
                  onChange={(e) =>
                    setSipForm({
                      ...sipForm,
                      debit_day: Math.max(1, Math.min(sipForm.frequency === 'weekly' ? 7 : 31, parseInt(e.target.value) || 1)),
                    })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Debit from bank *</label>
                <select
                  className="form-select"
                  value={sipForm.source_bank_id}
                  onChange={(e) => setSipForm({ ...sipForm, source_bank_id: parseInt(e.target.value) || 0 })}
                  required
                >
                  <option value="">— select bank —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expense category</label>
                <select
                  className="form-select"
                  value={sipForm.category_id}
                  onChange={(e) => setSipForm({ ...sipForm, category_id: parseInt(e.target.value) || 0 })}
                >
                  <option value="">— none —</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Link to investment (optional)</label>
                <select
                  className="form-select"
                  value={sipForm.investment_id}
                  onChange={(e) => setSipForm({ ...sipForm, investment_id: parseInt(e.target.value) || 0 })}
                >
                  <option value="">— none (record as expense only) —</option>
                  {investments.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {INVESTMENT_TYPE_LABELS[i.type]}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-white/40 mt-1">
                  When linked, each debit adds to the investment&apos;s total value.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Start date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={sipForm.start_date}
                  onChange={(e) => setSipForm({ ...sipForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">End date (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={sipForm.end_date}
                  onChange={(e) => setSipForm({ ...sipForm, end_date: e.target.value })}
                />
              </div>
              <div className="form-group md:col-span-2">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  value={sipForm.notes}
                  onChange={(e) => setSipForm({ ...sipForm, notes: e.target.value })}
                />
              </div>
            </div>
            {sipForm.amount > 0 && sipForm.source_bank_id > 0 && (
              <p className="text-[11px] text-white/60 flex items-center gap-1.5">
                <Calendar size={12} />
                First debit:{' '}
                <strong className="text-white">
                  {formatDate(computeFirstDebitDate(sipForm.start_date, sipForm.frequency, sipForm.debit_day))}
                </strong>
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary">Save SIP</button>
              <button
                type="button"
                onClick={() => { setShowSipForm(false); resetSipForm(); }}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {sips.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="text-right">Amount</th>
                  <th>Frequency</th>
                  <th>Source Bank</th>
                  <th>Next debit</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sips.map((s) => {
                  const bank = banks.find((b) => b.id === s.source_bank_id);
                  return (
                    <tr key={s.id}>
                      <td className="font-semibold">
                        {s.name}
                        {s.investment_id && (
                          <span className="ml-2 text-[10px] text-18-orange/80">→ {investments.find((i) => i.id === s.investment_id)?.name || 'linked'}</span>
                        )}
                      </td>
                      <td className="text-right font-bold">{formatCurrency(s.amount)}</td>
                      <td>
                        <span className="badge badge-orange">
                          {SIP_FREQUENCY_LABELS[s.frequency]} · d{s.debit_day}
                        </span>
                      </td>
                      <td className="text-18-dark-text">{bank?.bank_name || '—'}</td>
                      <td className="text-18-dark-text">
                        {s.is_active ? formatDate(s.next_debit_date) : <span className="text-white/40">paused</span>}
                      </td>
                      <td>
                        <span className={`text-xs font-semibold ${s.is_active ? 'text-green-400' : 'text-white/40'}`}>
                          {s.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleToggleSip(s.id)}
                            className="text-white/60 hover:text-white transition-colors"
                            title={s.is_active ? 'Pause SIP' : 'Resume SIP'}
                          >
                            {s.is_active ? <Pause size={14} /> : <Play size={14} />}
                          </button>
                          <button
                            onClick={() => handleDeleteSip(s.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Delete SIP"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-18-dark-text text-center py-6">
            No SIPs set up yet. Add one to auto-record recurring investment debits.
          </p>
        )}
      </div>

      {showForm && (
        <div className="card bg-18-surface border-18-border mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">New Investment</h3>
            <button onClick={() => setShowForm(false)} className="text-white hover:text-18-orange">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select
                  className="form-select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as InvestmentType })}
                  required
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{INVESTMENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HDFC 1Y FD / Nifty50 Smallcase"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Source bank</label>
                <select
                  className="form-select"
                  value={form.source_bank_id}
                  onChange={(e) => setForm({ ...form, source_bank_id: parseInt(e.target.value) || 0 })}
                >
                  <option value="">— none (manual entry) —</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>{b.bank_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {form.type === 'fd' ? 'Interest rate (%)' : 'Expected return (%)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="e.g. 7.25"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  {form.type === 'fd' ? 'Start date' : 'Purchase date'}
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              {form.type === 'fd' && (
                <div className="form-group">
                  <label className="form-label">Maturity date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.maturity_date}
                    onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                  />
                </div>
              )}
              <div className="form-group md:col-span-2">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {form.source_bank_id > 0 && (
                <div className="form-group md:col-span-2 flex items-center gap-2">
                  <input
                    id="deduct_from_bank"
                    type="checkbox"
                    className="h-4 w-4 accent-18-orange"
                    checked={form.deduct_from_bank}
                    onChange={(e) => setForm({ ...form, deduct_from_bank: e.target.checked })}
                  />
                  <label htmlFor="deduct_from_bank" className="text-sm text-white">
                    Also deduct {formatCurrency(form.amount || 0)} from selected bank&apos;s opening balance
                  </label>
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary">
              Save Investment
            </button>
          </form>
        </div>
      )}

      <div className="card">
        {investments.length > 0 ? (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Source Bank</th>
                  <th>Start / Purchase</th>
                  <th>Maturity</th>
                  <th className="text-right">Rate / Return</th>
                  <th className="text-right">Amount</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => {
                  const bank = banks.find((b) => b.id === inv.source_bank_id);
                  return (
                    <tr key={inv.id}>
                      <td className="font-semibold">{inv.name}</td>
                      <td>
                        <span className="badge badge-orange">{INVESTMENT_TYPE_LABELS[inv.type]}</span>
                      </td>
                      <td className="text-18-dark-text">{bank?.bank_name || '—'}</td>
                      <td className="text-18-dark-text">{inv.start_date ? formatDate(inv.start_date) : '—'}</td>
                      <td className="text-18-dark-text">{inv.maturity_date ? formatDate(inv.maturity_date) : '—'}</td>
                      <td className="text-right text-18-dark-text">
                        {inv.interest_rate ? `${inv.interest_rate}%` : '—'}
                      </td>
                      <td className="text-right font-bold">{formatCurrency(inv.amount)}</td>
                      <td className="text-center">
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete investment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6} className="text-right font-bold text-white">Total value</td>
                  <td className="text-right font-bold text-18-orange">{formatCurrency(total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-18-dark-text text-center py-8">
            No investments recorded. Click <strong>Add Investment</strong> to start.
          </p>
        )}
      </div>
    </div>
  );
}
