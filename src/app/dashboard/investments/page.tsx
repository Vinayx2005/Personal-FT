'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bank, Investment, InvestmentType, INVESTMENT_TYPE_LABELS } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Trash2, X } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

const TYPE_OPTIONS: InvestmentType[] = ['fd', 'smallcase', 'stocks', 'mutual_fund', 'others'];

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: '',
    type: 'fd' as InvestmentType,
    amount: 0,
    source_bank_id: 0,
    start_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    interest_rate: 0,
    notes: '',
    deduct_from_bank: true,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        setCurrentUserId(authUser?.id ?? null);

        const { data: banksData } = await supabase.from('banks').select('*').eq('is_active', true);
        const { data: invData } = await supabase
          .from('investments')
          .select('*')
          .order('created_at', { ascending: false });

        setBanks(banksData || []);
        setInvestments(invData || []);
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
      start_date: new Date().toISOString().split('T')[0],
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-18-charcoal mb-2">Investments</h1>
          <p className="text-18-dark-text">Track FDs, Smallcases, Stocks, Mutual Funds and more</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={16} />
          Add Investment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="card !bg-18-yellow !border-18-yellow">
          <p className="text-xs font-bold uppercase text-18-charcoal">Total</p>
          <h3 className="text-lg font-bold text-18-charcoal">{formatCurrency(total)}</h3>
          <p className="text-xs text-18-charcoal/70 mt-1">{investments.length} item{investments.length !== 1 ? 's' : ''}</p>
        </div>
        {byType.map((b) => (
          <div key={b.type} className="card">
            <p className="text-xs font-bold uppercase text-18-dark-text">{b.label}</p>
            <h3 className="text-lg font-bold text-18-charcoal">{formatCurrency(b.total)}</h3>
            <p className="text-xs text-18-dark-text mt-1">{b.count} item{b.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card bg-18-yellow mb-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">New Investment</h3>
            <button onClick={() => setShowForm(false)} className="text-18-charcoal hover:text-18-orange">
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
                  <label htmlFor="deduct_from_bank" className="text-sm text-18-charcoal">
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
                          className="text-red-600 hover:text-red-800"
                          title="Delete investment"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6} className="text-right font-bold text-18-charcoal">Total value</td>
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
