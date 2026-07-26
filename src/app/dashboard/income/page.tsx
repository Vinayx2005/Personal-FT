'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Category, Bank } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Upload, Download, ArrowRightLeft } from 'lucide-react';
import { buildImportRows, downloadCSVTemplate, extractCsvCategoryNames } from '@/lib/csvImport';
import { logAction } from '@/lib/auditLog';
import CategorySelect from '@/components/CategorySelect';
import DateRangePicker from '@/components/DateRangePicker';
import { DateRange, defaultRange } from '@/lib/dateRanges';
import { groupByMonth } from '@/lib/utils';
import { useScrollToHash } from '@/lib/scrollToHash';

interface IncomeForm {
  description: string;
  amount: number;
  bank_id: number;
  category_id: number;
  transaction_date: string;
  payee_name: string;
  notes: string;
}

export default function IncomePage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [income, setIncome] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [categoryFilter, setCategoryFilter] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    from_bank_id: 0,
    to_bank_id: 0,
    amount: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [transferring, setTransferring] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'refunds' | 'self_transfer'>('all');

  const [form, setForm] = useState<IncomeForm>({
    description: '',
    amount: 0,
    bank_id: 0,
    category_id: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    payee_name: '',
    notes: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setCurrentUserId(authUser?.id ?? null);

        const { data: incomeData } = await supabase
          .from('transactions')
          .select('*')
          .eq('transaction_type', 'income')
          .order('transaction_date', { ascending: false });

        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('type', 'income');

        const { data: banksData } = await supabase
          .from('banks')
          .select('*')
          .eq('is_active', true);

        setIncome(incomeData || []);
        setCategories(categoriesData || []);
        setBanks(banksData || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching income:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useScrollToHash([income.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.amount || !form.category_id || !form.bank_id) {
      alert('Please fill all required fields');
      return;
    }

    const payload = { ...form };

    try {
      if (editingId) {
        const prev = income.find((i) => i.id === editingId);
        const { error } = await supabase
          .from('transactions')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;

        setIncome(income.map((i) => (i.id === editingId ? { ...i, ...payload } : i)));
        logAction({
          action: 'update',
          table_name: 'transactions',
          record_id: editingId,
          description: `Updated income: ${payload.description || 'no description'} — ${formatCurrency(payload.amount)}`,
          old_values: prev as any,
          new_values: payload as any,
        });
        alert('Income updated successfully');
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            transaction_type: 'income',
            ...payload,
            created_at: new Date().toISOString(),
            status: 'posted',
            created_by: currentUserId,
          })
          .select();

        if (error) throw error;

        setIncome([data[0], ...income]);
        // If the row falls outside the current date range, widen the range so the user sees it
        if (payload.transaction_date < range.from || payload.transaction_date > range.to) {
          setRange({
            from: payload.transaction_date < range.from ? payload.transaction_date : range.from,
            to: payload.transaction_date > range.to ? payload.transaction_date : range.to,
          });
        }
        // If picked category is Self Transfer / Refund / Sales, jump to that tab
        const catName = (categories.find((c) => c.id === payload.category_id)?.name || '').toLowerCase();
        if (catName === 'self transfer') setActiveTab('self_transfer');
        else if (catName === 'refund' || catName === 'refunds') setActiveTab('refunds');
        else if (catName === 'sales') setActiveTab('sales');
        logAction({
          action: 'create',
          table_name: 'transactions',
          record_id: data[0].id,
          description: `Added income: ${payload.description || 'no description'} — ${formatCurrency(payload.amount)}`,
          new_values: data[0],
        });
        alert('Income added successfully');
      }

      resetForm();
      setShowForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;

    try {
      const prev = income.find((i) => i.id === id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);

      if (error) throw error;

      setIncome(income.filter((i) => i.id !== id));
      logAction({
        action: 'delete',
        table_name: 'transactions',
        record_id: id,
        description: `Deleted income: ${prev?.description || 'no description'} — ${formatCurrency(prev?.amount || 0)}`,
        old_values: prev as any,
      });
      alert('Income deleted');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected income entr${ids.length === 1 ? 'y' : 'ies'}?`)) return;
    try {
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
      setIncome(income.filter((i) => !selectedIds.has(i.id)));
      logAction({
        action: 'delete',
        table_name: 'transactions',
        description: `Bulk deleted ${ids.length} income entr${ids.length === 1 ? 'y' : 'ies'}`,
        old_values: { ids },
      });
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSelfTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const { from_bank_id, to_bank_id, amount, transaction_date, notes } = transferForm;
    if (!from_bank_id || !to_bank_id || from_bank_id === to_bank_id) {
      alert('Pick two different banks.');
      return;
    }
    if (!amount || amount <= 0) {
      alert('Enter a valid amount.');
      return;
    }
    const transferCat = categories.find((c) => c.name.toLowerCase() === 'self transfer');
    if (!transferCat) {
      alert('Add a "Self Transfer" income category first (Settings).');
      return;
    }
    // Find matching expense category too
    const { data: expenseCats } = await supabase
      .from('categories')
      .select('*')
      .eq('type', 'expense')
      .eq('name', 'Self Transfer')
      .limit(1);
    const expenseCatId = expenseCats?.[0]?.id;
    if (!expenseCatId) {
      alert('Add a "Self Transfer" expense category first (Settings).');
      return;
    }

    setTransferring(true);
    try {
      const transferGroupId = crypto.randomUUID();
      const fromBank = banks.find((b) => b.id === from_bank_id);
      const toBank = banks.find((b) => b.id === to_bank_id);
      const commonNote = notes
        ? `Self transfer: ${fromBank?.bank_name} → ${toBank?.bank_name}. ${notes}`
        : `Self transfer: ${fromBank?.bank_name} → ${toBank?.bank_name}`;
      const nowIso = new Date().toISOString();
      const rows = [
        {
          transaction_type: 'expense',
          bank_id: from_bank_id,
          category_id: expenseCatId,
          description: `Self transfer to ${toBank?.bank_name}`,
          amount,
          transaction_date,
          payee_name: '',
          notes: commonNote,
          status: 'posted',
          transfer_group_id: transferGroupId,
          created_at: nowIso,
          created_by: currentUserId,
        },
        {
          transaction_type: 'income',
          bank_id: to_bank_id,
          category_id: transferCat.id,
          description: `Self transfer from ${fromBank?.bank_name}`,
          amount,
          transaction_date,
          payee_name: '',
          notes: commonNote,
          status: 'posted',
          transfer_group_id: transferGroupId,
          created_at: nowIso,
          created_by: currentUserId,
        },
      ];
      const { data, error } = await supabase.from('transactions').insert(rows).select();
      if (error) throw error;
      const incomeRow = data?.find((d) => d.transaction_type === 'income');
      if (incomeRow) setIncome([incomeRow, ...income]);
      logAction({
        action: 'create',
        table_name: 'transactions',
        description: `Self transfer ${formatCurrency(amount)}: ${fromBank?.bank_name} → ${toBank?.bank_name}`,
        new_values: { amount, from: fromBank?.bank_name, to: toBank?.bank_name, transfer_group_id: transferGroupId },
      });
      // Auto-widen the date range to include this transfer's date, and switch to the Self Transfers tab
      if (transaction_date < range.from || transaction_date > range.to) {
        setRange({
          from: transaction_date < range.from ? transaction_date : range.from,
          to: transaction_date > range.to ? transaction_date : range.to,
        });
      }
      setActiveTab('self_transfer');
      setTransferForm({ from_bank_id: 0, to_bank_id: 0, amount: 0, transaction_date: new Date().toISOString().split('T')[0], notes: '' });
      setShowTransfer(false);
      alert('Transfer recorded on both accounts.');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTransferring(false);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = '';
    if (!file) return;

    if (banks.length === 0) {
      alert('Please add at least one bank before importing. (Categories are auto-created from the CSV.)');
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();

      // Auto-create any category names in the CSV that don't already exist
      // (case-insensitive). Keeps CSV imports friction-free even for brand
      // new categories.
      const csvCatNames = extractCsvCategoryNames(text);
      const existingLower = new Set(categories.map((c) => c.name.toLowerCase()));
      const toCreate = csvCatNames.filter((n) => !existingLower.has(n.toLowerCase()));
      let effectiveCategories = categories;
      if (toCreate.length > 0) {
        const { data: created, error: createErr } = await supabase
          .from('categories')
          .insert(toCreate.map((name) => ({ type: 'income', name, is_default: false, user_id: currentUserId })))
          .select();
        if (createErr) {
          alert(`Failed to auto-create categories: ${createErr.message}`);
          return;
        }
        effectiveCategories = [...categories, ...(created || [])];
        setCategories(effectiveCategories);
      }

      const { rows, errors } = buildImportRows(text, 'income', effectiveCategories, banks);

      if (rows.length === 0) {
        alert(`No valid rows to import.\n\nErrors:\n${errors.map((er) => `Line ${er.line}: ${er.message}`).join('\n')}`);
        return;
      }

      const proceed = errors.length === 0
        ? confirm(`Import ${rows.length} income entr${rows.length === 1 ? 'y' : 'ies'}?`)
        : confirm(`Import ${rows.length} valid row(s)? ${errors.length} row(s) will be skipped:\n\n${errors.slice(0, 10).map((er) => `Line ${er.line}: ${er.message}`).join('\n')}${errors.length > 10 ? `\n\n(+${errors.length - 10} more)` : ''}`);
      if (!proceed) return;

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .insert(rows.map((r) => ({ ...r, created_at: nowIso, created_by: currentUserId })))
        .select();

      if (error) throw error;

      setIncome([...(data || []), ...income]);
      logAction({
        action: 'import',
        table_name: 'transactions',
        description: `Imported ${data?.length || 0} income entr${(data?.length || 0) === 1 ? 'y' : 'ies'} via CSV`,
        new_values: { count: data?.length || 0, skipped: errors.length },
      });
      alert(`Imported ${data?.length || 0} income entr${(data?.length || 0) === 1 ? 'y' : 'ies'} successfully.`);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setForm({
      description: '',
      amount: 0,
      bank_id: 0,
      category_id: 0,
      transaction_date: new Date().toISOString().split('T')[0],
      payee_name: '',
      notes: '',
    });
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  const inRangeAll = income.filter(
    (i) => i.transaction_date >= range.from && i.transaction_date <= range.to
  );
  const q = searchText.trim().toLowerCase();
  const minA = minAmount.trim() ? parseFloat(minAmount) : null;
  const maxA = maxAmount.trim() ? parseFloat(maxAmount) : null;
  const inRange = inRangeAll.filter((i) => {
    if (categoryFilter.size > 0 && !categoryFilter.has(i.category_id)) return false;
    if (q) {
      const desc = (i.description || '').toLowerCase();
      const payee = (i.payee_name || '').toLowerCase();
      if (!desc.includes(q) && !payee.includes(q)) return false;
    }
    if (minA !== null && !isNaN(minA) && (i.amount || 0) < minA) return false;
    if (maxA !== null && !isNaN(maxA) && (i.amount || 0) > maxA) return false;
    return true;
  });

  const catNameOf = (id: number) =>
    (categories.find((c) => c.id === id)?.name || '').toLowerCase();
  const isSelfTransfer = (i: Transaction): boolean => {
    if (i.transfer_group_id) return true;
    const n = catNameOf(i.category_id);
    return n.includes('self transfer') || n.includes('self-transfer');
  };
  const isSales = (i: Transaction): boolean => catNameOf(i.category_id) === 'sales';
  const isRefund = (i: Transaction): boolean => {
    const n = catNameOf(i.category_id);
    return n === 'refund' || n === 'refunds';
  };
  const tabFilter = (i: Transaction): boolean => {
    if (activeTab === 'all') return true;
    if (activeTab === 'self_transfer') return isSelfTransfer(i);
    if (activeTab === 'sales') return isSales(i);
    if (activeTab === 'refunds') return isRefund(i);
    return true;
  };
  const filteredInRange = inRange.filter(tabFilter);
  const grouped = groupByMonth(filteredInRange, (i) => i.transaction_date);

  // Real income excludes self-transfers and refunds
  const realIncome = inRange.filter((i) => !isSelfTransfer(i) && !isRefund(i));
  const totalIncome = realIncome.reduce((sum, i) => sum + i.amount, 0);
  const realTxCount = realIncome.length;
  const tabCounts = {
    all: inRange.length,
    sales: inRange.filter(isSales).length,
    refunds: inRange.filter(isRefund).length,
    self_transfer: inRange.filter(isSelfTransfer).length,
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Income</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={() => downloadCSVTemplate('income')}
            className="btn btn-outline"
            title="Download CSV template"
          >
            <Download size={16} />
            Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            disabled={importing}
          >
            <Upload size={16} />
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCSVImport}
          />
          <button
            onClick={() => setShowTransfer(true)}
            className="btn btn-secondary"
          >
            <ArrowRightLeft size={16} />
            Self Transfer
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Add Income
          </button>
        </div>
      </div>

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="card bg-red-900/20 border-red-800/40 mb-4 flex items-center justify-between py-3">
          <p className="text-sm text-red-300 font-semibold">
            {selectedIds.size} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="btn btn-secondary"
            >
              Clear
            </button>
            <button onClick={handleBulkDelete} className="btn btn-primary bg-red-600 hover:bg-red-700">
              <Trash2 size={16} />
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Self transfer modal */}
      {showTransfer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowTransfer(false)}
        >
          <div
            className="bg-18-surface rounded-18-md p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Self Transfer</h2>
              <button onClick={() => setShowTransfer(false)} className="text-18-dark-text hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-18-dark-text mb-4">
              Records an expense on the source bank and matching income on the destination bank. Both are excluded from net income.
            </p>
            <form onSubmit={handleSelfTransfer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">From bank *</label>
                  <select
                    className="form-select"
                    value={transferForm.from_bank_id}
                    onChange={(e) => setTransferForm({ ...transferForm, from_bank_id: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.bank_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">To bank *</label>
                  <select
                    className="form-select"
                    value={transferForm.to_bank_id}
                    onChange={(e) => setTransferForm({ ...transferForm, to_bank_id: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.bank_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={transferForm.transaction_date}
                    onChange={(e) => setTransferForm({ ...transferForm, transaction_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary" disabled={transferring}>
                  {transferring ? 'Transferring…' : 'Transfer'}
                </button>
                <button type="button" onClick={() => setShowTransfer(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters (Item 8) */}
      <div className="mb-4 card !p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
          <input
            type="text"
            placeholder="Search description or payer…"
            className="form-input md:col-span-2 !py-2 text-sm"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <input
            type="number"
            placeholder="Min amount"
            className="form-input !py-2 text-sm"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
          />
          <input
            type="number"
            placeholder="Max amount"
            className="form-input !py-2 text-sm"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
          />
        </div>
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-semibold text-white flex items-center justify-between">
            <span>
              Filter by category
              {categoryFilter.size > 0 && (
                <span className="ml-2 text-xs bg-18-orange text-white rounded-full px-2 py-0.5">
                  {categoryFilter.size} selected
                </span>
              )}
            </span>
            {(categoryFilter.size > 0 || searchText || minAmount || maxAmount) && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setCategoryFilter(new Set());
                  setSearchText('');
                  setMinAmount('');
                  setMaxAmount('');
                }}
                className="text-xs text-18-orange hover:underline"
              >
                Clear all
              </button>
            )}
          </summary>
          <div className="p-3 border-t border-18-border mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {categories.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
              const checked = categoryFilter.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer border ${
                    checked ? 'bg-18-orange/10 border-18-orange' : 'bg-18-surface border-18-border hover:border-18-dark-text'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-18-orange"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(categoryFilter);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setCategoryFilter(next);
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              );
            })}
          </div>
        </details>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card bg-green-900/20 border-green-800/40">
          <p className="text-green-300 text-sm font-bold uppercase mb-2">Total Income</p>
          <h3 className="text-xl font-bold text-green-300">{formatCurrency(totalIncome)}</h3>
        </div>
        <div className="card bg-18-orange/15 border-18-orange/40">
          <p className="text-white text-sm font-bold uppercase mb-2">Transactions</p>
          <h3 className="text-xl font-bold text-white">{realTxCount}</h3>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 border-b border-18-border">
        {(
          [
            { key: 'all', label: 'All' },
            { key: 'sales', label: 'Sales' },
            { key: 'refunds', label: 'Refunds' },
            { key: 'self_transfer', label: 'Self Transfers' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key);
              setSelectedIds(new Set());
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-18-orange text-18-orange'
                : 'border-transparent text-18-dark-text hover:text-white'
            }`}
          >
            {t.label}
            <span className="ml-2 text-xs text-18-dark-text">({tabCounts[t.key]})</span>
          </button>
        ))}
      </div>

      {/* Form (modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div className="card bg-18-surface border-18-border w-full max-w-3xl my-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {editingId ? 'Edit Income' : 'New Income'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="text-white hover:text-18-orange"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bank *</label>
                <select
                  className="form-select"
                  value={form.bank_id}
                  onChange={(e) => setForm({ ...form, bank_id: parseInt(e.target.value) })}
                  required
                >
                  <option value="">Select Bank</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <CategorySelect
                  type="income"
                  categories={categories}
                  value={form.category_id}
                  onChange={(id) => setForm({ ...form, category_id: id })}
                  onCategoryCreated={(c) => setCategories([...categories, c])}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.transaction_date}
                  onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Income description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payer Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.payee_name}
                  onChange={(e) => setForm({ ...form, payee_name: e.target.value })}
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update Income' : 'Add Income'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Income grouped by month */}
      {grouped.length === 0 ? (
        <div className="card">
          <p className="text-18-dark-text text-center py-8">No income in this range</p>
        </div>
      ) : (
        grouped.map((g) => {
          const monthTotal = g.items.reduce((s, x) => s + (x.amount || 0), 0);
          return (
            <div key={g.key} className="card mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">{g.label}</h3>
                <div className="text-sm">
                  <span className="text-18-dark-text">{g.items.length} entries · </span>
                  <span className="font-bold text-white">{formatCurrency(monthTotal)}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table>
                  <thead>
                    <tr>
                      <th className="w-8"></th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Payer</th>
                      <th>Description</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((inc) => {
                      const category = categories.find((c) => c.id === inc.category_id);
                      const checked = selectedIds.has(inc.id);
                      return (
                        <tr key={inc.id} id={`row-tx-${inc.id}`} className={checked ? 'bg-red-50' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-red-600"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(inc.id);
                                else next.delete(inc.id);
                                setSelectedIds(next);
                              }}
                            />
                          </td>
                      <td className="whitespace-nowrap">{formatDate(inc.transaction_date)}</td>
                      <td>
                        <span className="badge badge-orange">{category?.name}</span>
                      </td>
                      <td>{inc.payee_name}</td>
                      <td>{inc.description}</td>
                      <td className="text-right font-bold">{formatCurrency(inc.amount)}</td>
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => {
                              setForm({
                                description: inc.description || '',
                                amount: inc.amount,
                                bank_id: inc.bank_id,
                                category_id: inc.category_id,
                                transaction_date: inc.transaction_date,
                                payee_name: inc.payee_name || '',
                                notes: inc.notes || '',
                              });
                              setEditingId(inc.id);
                              setShowForm(true);
                            }}
                            className="text-18-orange hover:text-white transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(inc.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
