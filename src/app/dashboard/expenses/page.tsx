'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Transaction, Category, Bank } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Upload, Download, Paperclip, FileText } from 'lucide-react';
import { buildImportRows, downloadCSVTemplate, extractCsvCategoryNames } from '@/lib/csvImport';
import { logAction } from '@/lib/auditLog';
import CategorySelect from '@/components/CategorySelect';
import DateRangePicker from '@/components/DateRangePicker';
import ReceiptPreview from '@/components/ReceiptPreview';
import { DateRange, defaultRange } from '@/lib/dateRanges';
import { groupByMonth } from '@/lib/utils';
import { useScrollToHash } from '@/lib/scrollToHash';

interface ExpenseForm {
  description: string;
  amount: number;
  bank_id: number;
  category_id: number;
  transaction_date: string;
  payee_name: string;
  notes: string;
  receipt_url: string | null;
}

export default function ExpensesPage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<number>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [viewing, setViewing] = useState<{ expense: Transaction } | null>(null);

  const openView = (expense: Transaction) => {
    setViewing({ expense });
  };

  const [form, setForm] = useState<ExpenseForm>({
    description: '',
    amount: 0,
    bank_id: 0,
    category_id: 0,
    transaction_date: new Date().toISOString().split('T')[0],
    payee_name: '',
    notes: '',
    receipt_url: null,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setCurrentUserId(authUser?.id ?? null);

        // Fetch expenses
        const { data: expensesData } = await supabase
          .from('transactions')
          .select('*')
          .eq('transaction_type', 'expense')
          .order('transaction_date', { ascending: false });

        // Fetch categories
        const { data: categoriesData } = await supabase
          .from('categories')
          .select('*')
          .eq('type', 'expense');

        // Fetch banks
        const { data: banksData } = await supabase
          .from('banks')
          .select('*')
          .eq('is_active', true);

        setExpenses(expensesData || []);
        setCategories(categoriesData || []);
        setBanks(banksData || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching expenses:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useScrollToHash([expenses.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.amount || !form.category_id || !form.bank_id) {
      alert('Please fill all required fields');
      return;
    }

    const payload = { ...form };

    try {
      if (editingId) {
        const prev = expenses.find((e) => e.id === editingId);
        const { error } = await supabase
          .from('transactions')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;

        setExpenses(
          expenses.map((e) => (e.id === editingId ? { ...e, ...payload } : e))
        );
        logAction({
          action: 'update',
          table_name: 'transactions',
          record_id: editingId,
          description: `Updated expense: ${payload.description || 'no description'} — ${formatCurrency(payload.amount)}`,
          old_values: prev as any,
          new_values: payload as any,
        });
        alert('Expense updated successfully');
      } else {
        const { data, error } = await supabase
          .from('transactions')
          .insert({
            transaction_type: 'expense',
            ...payload,
            created_at: new Date().toISOString(),
            status: 'posted',
            created_by: currentUserId,
          })
          .select();

        if (error) throw error;

        setExpenses([data[0], ...expenses]);
        logAction({
          action: 'create',
          table_name: 'transactions',
          record_id: data[0].id,
          description: `Added expense: ${payload.description || 'no description'} — ${formatCurrency(payload.amount)}`,
          new_values: data[0],
        });
        alert('Expense added successfully');
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
      const prev = expenses.find((e) => e.id === id);
      const { error } = await supabase.from('transactions').delete().eq('id', id);

      if (error) throw error;

      setExpenses(expenses.filter((e) => e.id !== id));
      logAction({
        action: 'delete',
        table_name: 'transactions',
        record_id: id,
        description: `Deleted expense: ${prev?.description || 'no description'} — ${formatCurrency(prev?.amount || 0)}`,
        old_values: prev as any,
      });
      alert('Expense deleted');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected expense${ids.length === 1 ? '' : 's'}?`)) return;
    try {
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
      setExpenses(expenses.filter((e) => !selectedIds.has(e.id)));
      logAction({
        action: 'delete',
        table_name: 'transactions',
        description: `Bulk deleted ${ids.length} expense${ids.length === 1 ? '' : 's'}`,
        old_values: { ids },
      });
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  // Live progress for the post-insert receipt fetch phase of a CSV import.
  // null when idle; { done, total, ok, fail } while receipts are being fetched.
  const [receiptProgress, setReceiptProgress] = useState<
    { done: number; total: number; ok: number; fail: number } | null
  >(null);

  const uploadReceipt = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      setForm((prev) => ({ ...prev, receipt_url: path }));
    } catch (err: any) {
      alert(`Receipt upload failed: ${err.message}`);
    }
    setUploadingReceipt(false);
  };

  const openReceipt = (path: string) => {
    // Navigate to the internal viewer page which fetches through /api/receipts/serve
    // (correct MIME + inline preview + download button).
    router.push(`/dashboard/receipts/view?path=${encodeURIComponent(path)}`);
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
          .insert(toCreate.map((name) => ({ type: 'expense', name, is_default: false, user_id: currentUserId })))
          .select();
        if (createErr) {
          alert(`Failed to auto-create categories: ${createErr.message}`);
          return;
        }
        effectiveCategories = [...categories, ...(created || [])];
        setCategories(effectiveCategories);
      }

      const { rows, receiptDriveUrls, errors } = buildImportRows(text, 'expense', effectiveCategories, banks);

      if (rows.length === 0) {
        alert(`No valid rows to import.\n\nErrors:\n${errors.map((er) => `Line ${er.line}: ${er.message}`).join('\n')}`);
        return;
      }

      const withReceipts = receiptDriveUrls.filter(Boolean).length;
      const receiptNote = withReceipts > 0
        ? `\n\n${withReceipts} row(s) also include Google Drive links — receipts will be fetched after the expenses are saved.`
        : '';
      const proceed = errors.length === 0
        ? confirm(`Import ${rows.length} expense(s)?${receiptNote}`)
        : confirm(`Import ${rows.length} valid row(s)? ${errors.length} row(s) will be skipped:\n\n${errors.slice(0, 10).map((er) => `Line ${er.line}: ${er.message}`).join('\n')}${errors.length > 10 ? `\n\n(+${errors.length - 10} more)` : ''}${receiptNote}`);
      if (!proceed) return;

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('transactions')
        .insert(rows.map((r) => ({ ...r, created_at: nowIso, created_by: currentUserId })))
        .select();

      if (error) throw error;

      setExpenses([...(data || []), ...expenses]);
      logAction({
        action: 'import',
        table_name: 'transactions',
        description: `Imported ${data?.length || 0} expense(s) via CSV`,
        new_values: { count: data?.length || 0, skipped: errors.length },
      });

      // Post-insert: fetch receipts for rows that had a Google Drive link.
      // Uses the same /api/receipts/bulk-import endpoint as the standalone
      // bulk-attach page, chunked to fit Vercel's function timeout.
      const receiptItems: { entity_id: number; drive_url: string }[] = [];
      (data || []).forEach((row: any, i: number) => {
        const url = receiptDriveUrls[i];
        if (url && row?.id) receiptItems.push({ entity_id: row.id, drive_url: url });
      });

      let receiptOk = 0;
      let receiptFail = 0;
      const receiptFailures: string[] = [];

      if (receiptItems.length > 0) {
        setReceiptProgress({ done: 0, total: receiptItems.length, ok: 0, fail: 0 });
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          receiptFail = receiptItems.length;
          receiptFailures.push('not signed in — receipts skipped');
          setReceiptProgress({ done: receiptItems.length, total: receiptItems.length, ok: 0, fail: receiptFail });
        } else {
          const CHUNK = 10;
          for (let i = 0; i < receiptItems.length; i += CHUNK) {
            const chunk = receiptItems.slice(i, i + CHUNK).map((it, j) => ({
              index: i + j + 1,
              entity_type: 'expense',
              entity_ref: String(it.entity_id),
              drive_url: it.drive_url,
            }));
            try {
              const res = await fetch('/api/receipts/bulk-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ rows: chunk }),
              });
              const body = await res.json();
              if (res.ok && body.ok && Array.isArray(body.results)) {
                for (const r of body.results) {
                  if (r.ok) receiptOk++;
                  else {
                    receiptFail++;
                    receiptFailures.push(`expense #${r.entity_id ?? '?'}: ${r.error}`);
                  }
                }
              } else {
                receiptFail += chunk.length;
                receiptFailures.push(body.error || `HTTP ${res.status}`);
              }
            } catch (e: any) {
              receiptFail += chunk.length;
              receiptFailures.push(e?.message || 'network error');
            }
            // Live update after each chunk so the user sees the counter climb.
            setReceiptProgress({
              done: Math.min(i + CHUNK, receiptItems.length),
              total: receiptItems.length,
              ok: receiptOk,
              fail: receiptFail,
            });
          }
        }
      }

      let msg = `Imported ${data?.length || 0} expense(s) successfully.`;
      if (receiptItems.length > 0) {
        msg += `\n\nReceipts: ${receiptOk} attached, ${receiptFail} failed.`;
        if (receiptFail > 0) {
          msg += `\n\nFailures:\n${receiptFailures.slice(0, 10).join('\n')}${receiptFailures.length > 10 ? `\n(+${receiptFailures.length - 10} more)` : ''}`;
        }
        // Refresh expense rows so the Paperclip icon appears for newly-attached ones.
        if (receiptOk > 0) {
          const ids = (data || []).map((r: any) => r.id);
          const { data: refreshed } = await supabase.from('transactions').select('*').in('id', ids);
          if (refreshed) {
            const byId = new Map(refreshed.map((r: any) => [r.id, r]));
            setExpenses((prev) => prev.map((e: any) => (byId.has(e.id) ? (byId.get(e.id) as any) : e)));
          }
        }
      }
      alert(msg);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      // Clear the progress indicator once the alert has been dismissed.
      setReceiptProgress(null);
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
      receipt_url: null,
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

  const inRangeAll = expenses.filter(
    (e) => e.transaction_date >= range.from && e.transaction_date <= range.to
  );
  const q = searchText.trim().toLowerCase();
  const minA = minAmount.trim() ? parseFloat(minAmount) : null;
  const maxA = maxAmount.trim() ? parseFloat(maxAmount) : null;
  const inRange = inRangeAll.filter((e) => {
    if (categoryFilter.size > 0 && !categoryFilter.has(e.category_id)) return false;
    if (q) {
      const desc = (e.description || '').toLowerCase();
      const payee = (e.payee_name || '').toLowerCase();
      if (!desc.includes(q) && !payee.includes(q)) return false;
    }
    if (minA !== null && !isNaN(minA) && (e.amount || 0) < minA) return false;
    if (maxA !== null && !isNaN(maxA) && (e.amount || 0) > maxA) return false;
    return true;
  });
  const catNameOf = (id: number) =>
    (categories.find((c) => c.id === id)?.name || '').toLowerCase();
  const isSelfTransfer = (e: Transaction): boolean => {
    if (e.transfer_group_id) return true;
    const n = catNameOf(e.category_id);
    return n.includes('self transfer') || n.includes('self-transfer');
  };
  // Real expenses exclude self-transfers (movements between own banks are not spending)
  const realExpenses = inRange.filter((e) => !isSelfTransfer(e));
  const totalExpenses = realExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const realTxCount = realExpenses.length;
  const grouped = groupByMonth(inRange, (e) => e.transaction_date);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={() => downloadCSVTemplate('expense')}
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
            {importing
              ? receiptProgress
                ? `Receipts ${receiptProgress.done} / ${receiptProgress.total}…`
                : 'Importing…'
              : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCSVImport}
          />
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* Live receipt-fetch progress during CSV import */}
      {receiptProgress && (
        <div className="mb-4 card !p-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between mb-1 text-sm">
              <span className="font-semibold text-white">
                Fetching receipts from Google Drive
              </span>
              <span className="text-18-dark-text">
                {receiptProgress.done} / {receiptProgress.total}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div
                className="h-full bg-18-orange transition-all"
                style={{
                  width: `${receiptProgress.total > 0 ? Math.round((receiptProgress.done / receiptProgress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-300 font-semibold">✓ {receiptProgress.ok}</span>
            <span className="text-red-400 font-semibold">✗ {receiptProgress.fail}</span>
          </div>
        </div>
      )}

      {/* Filters (Item 8) */}
      <div className="mb-4 card !p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
          <input
            type="text"
            placeholder="Search description or payee…"
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
        <div className="card bg-red-900/20 border-red-800/40">
          <p className="text-red-300 text-sm font-bold uppercase mb-2">Total Expenses</p>
          <h3 className="text-xl font-bold text-red-300">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="card bg-18-orange/15 border-18-orange/40">
          <p className="text-white text-sm font-bold uppercase mb-2">Transactions</p>
          <h3 className="text-xl font-bold text-white">{realTxCount}</h3>
          {inRange.length !== realTxCount && (
            <p className="text-xs text-18-dark-text mt-1">
              +{inRange.length - realTxCount} self-transfer{inRange.length - realTxCount > 1 ? 's' : ''} excluded
            </p>
          )}
        </div>
      </div>

      {/* Form (modal) */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div className="card bg-18-surface border-18-border w-full max-w-3xl my-8 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {editingId ? 'Edit Expense' : 'New Expense'}
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
                  type="expense"
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
                  placeholder="Expense description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payee Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.payee_name}
                  onChange={(e) => setForm({ ...form, payee_name: e.target.value })}
                />
              </div>

              <div className="form-group md:col-span-2">
                <label className="form-label">Receipt / Invoice</label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={receiptInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadReceipt(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => receiptInputRef.current?.click()}
                    className="btn btn-outline"
                    disabled={uploadingReceipt}
                  >
                    <Paperclip size={16} />
                    {uploadingReceipt
                      ? 'Uploading...'
                      : form.receipt_url
                      ? 'Replace file'
                      : 'Attach file'}
                  </button>
                  {form.receipt_url && (
                    <>
                      <button
                        type="button"
                        onClick={() => openReceipt(form.receipt_url!)}
                        className="text-sm text-18-orange hover:underline flex items-center gap-1"
                      >
                        <FileText size={14} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, receipt_url: null })}
                        className="text-sm text-red-400 hover:underline"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-18-dark-text mt-1">
                  Image or PDF; stored privately in Supabase Storage.
                </p>
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
                {editingId ? 'Update Expense' : 'Add Expense'}
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

      {/* Bulk delete bar */}
      {selectedIds.size > 0 && (
        <div className="card bg-red-900/20 border-red-800/40 mb-4 flex items-center justify-between py-3">
          <p className="text-sm text-red-300 font-semibold">
            {selectedIds.size} selected
          </p>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="btn btn-secondary">
              Clear
            </button>
            <button onClick={handleBulkDelete} className="btn btn-primary bg-red-600 hover:bg-red-700">
              <Trash2 size={16} />
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Expenses grouped by month */}
      {grouped.length === 0 ? (
        <div className="card">
          <p className="text-18-dark-text text-center py-8">No expenses in this range</p>
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
                      <th>Payee</th>
                      <th>Description</th>
                      <th className="text-right">Amount</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((expense) => {
                      const category = categories.find((c) => c.id === expense.category_id);
                      const checked = selectedIds.has(expense.id);
                      return (
                        <tr key={expense.id} id={`row-tx-${expense.id}`} className={checked ? 'bg-red-50' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-red-600"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(expense.id);
                                else next.delete(expense.id);
                                setSelectedIds(next);
                              }}
                            />
                          </td>
                      <td className="whitespace-nowrap">{formatDate(expense.transaction_date)}</td>
                      <td>
                        <span className="badge badge-orange">{category?.name}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => openView(expense)}
                          className="text-left hover:text-18-orange transition-colors"
                          title="View details"
                        >
                          {expense.payee_name || <span className="text-18-dark-text italic">—</span>}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => openView(expense)}
                          className="text-left hover:text-18-orange transition-colors"
                          title="View details"
                        >
                          {expense.description || <span className="text-18-dark-text italic">—</span>}
                        </button>
                      </td>
                      <td className="text-right font-bold">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="text-center">
                        <div className="flex gap-2 justify-center">
                          {expense.receipt_url && (
                            <button
                              onClick={() => openReceipt(expense.receipt_url!)}
                              className="text-18-dark-text hover:text-18-orange transition-colors"
                              title="View receipt / invoice"
                            >
                              <Paperclip size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setForm({
                                description: expense.description || '',
                                amount: expense.amount,
                                bank_id: expense.bank_id,
                                category_id: expense.category_id,
                                transaction_date: expense.transaction_date,
                                payee_name: expense.payee_name || '',
                                notes: expense.notes || '',
                                receipt_url: expense.receipt_url || null,
                              });
                              setEditingId(expense.id);
                              setShowForm(true);
                            }}
                            className="text-18-orange hover:text-white transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
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

      {/* Expense detail modal */}
      {viewing && (() => {
        const exp = viewing.expense;
        const category = categories.find((c) => c.id === exp.category_id);
        const bank = banks.find((b) => b.id === exp.bank_id);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setViewing(null);
            }}
          >
            <div className="card bg-18-surface w-full max-w-2xl my-8 shadow-2xl">
              <div className="flex justify-between items-start mb-4 gap-3">
                <div>
                  <p className="text-xs uppercase font-bold text-18-dark-text">
                    Expense · {formatDate(exp.transaction_date)}
                  </p>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {exp.description || exp.payee_name || 'Untitled expense'}
                  </h2>
                </div>
                <button
                  onClick={() => setViewing(null)}
                  className="text-white hover:text-18-orange shrink-0"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-1">Amount</p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(exp.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-1">Payee</p>
                  <p className="text-sm">{exp.payee_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-1">Bank</p>
                  <p className="text-sm">{bank?.bank_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-1">Category</p>
                  {category ? (
                    <span className="badge badge-orange">{category.name}</span>
                  ) : (
                    <p className="text-sm">—</p>
                  )}
                </div>
              </div>

              {exp.notes && (
                <div className="mb-4">
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-line">{exp.notes}</p>
                </div>
              )}

              {exp.receipt_url && (
                <div className="mb-4">
                  <p className="text-xs uppercase font-bold text-18-dark-text mb-2">Receipt</p>
                  <ReceiptPreview path={exp.receipt_url} />
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
