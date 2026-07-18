'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Bank, Category, BankBalanceHistory } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, History } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBankForm, setShowBankForm] = useState(false);

  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    account_holder: '',
    ifsc_code: '',
    opening_balance: 0,
  });

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');

  const [editingBankId, setEditingBankId] = useState<number | null>(null);
  const [balanceChangeReason, setBalanceChangeReason] = useState('');
  const [historyOpenFor, setHistoryOpenFor] = useState<number | null>(null);
  const [historyByBank, setHistoryByBank] = useState<Record<number, BankBalanceHistory[]>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser?.id)
          .single();

        setCurrentUser(userData);

        const { data: banksData } = await supabase.from('banks').select('*');
        const { data: categoriesData } = await supabase.from('categories').select('*');

        setBanks(banksData || []);
        setExpenseCategories((categoriesData || []).filter((c: Category) => c.type === 'expense'));
        setIncomeCategories((categoriesData || []).filter((c: Category) => c.type === 'income'));

        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resetBankForm = () => {
    setBankForm({
      bank_name: '',
      account_number: '',
      account_holder: '',
      ifsc_code: '',
      opening_balance: 0,
    });
    setEditingBankId(null);
    setBalanceChangeReason('');
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankForm.bank_name || !bankForm.account_number) {
      alert('Please fill required fields');
      return;
    }

    try {
      if (editingBankId) {
        const existing = banks.find((b) => b.id === editingBankId);
        const prevBalance = existing?.opening_balance ?? 0;
        const balanceChanged = prevBalance !== bankForm.opening_balance;

        const { data, error } = await supabase
          .from('banks')
          .update({
            ...bankForm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBankId)
          .select()
          .single();
        if (error) throw error;

        if (balanceChanged) {
          const { error: histErr } = await supabase.from('bank_balance_history').insert({
            bank_id: editingBankId,
            previous_balance: prevBalance,
            new_balance: bankForm.opening_balance,
            reason: balanceChangeReason.trim() || null,
            changed_by: currentUser?.id,
          });
          if (histErr) console.error('history log failed:', histErr.message);
          // Invalidate cached history for this bank
          setHistoryByBank((h) => {
            const next = { ...h };
            delete next[editingBankId];
            return next;
          });
          logAction({
            action: 'update',
            table_name: 'banks',
            record_id: editingBankId,
            description: `Opening balance changed for ${bankForm.bank_name}: ${formatCurrency(prevBalance)} → ${formatCurrency(bankForm.opening_balance)}${balanceChangeReason ? ` (${balanceChangeReason})` : ''}`,
            old_values: { opening_balance: prevBalance },
            new_values: { opening_balance: bankForm.opening_balance, reason: balanceChangeReason },
          });
        } else {
          logAction({
            action: 'update',
            table_name: 'banks',
            record_id: editingBankId,
            description: `Updated bank details: ${bankForm.bank_name}`,
            new_values: bankForm,
          });
        }

        setBanks(banks.map((b) => (b.id === editingBankId ? { ...b, ...data } : b)));
      } else {
        const { data, error } = await supabase
          .from('banks')
          .insert({ ...bankForm, is_active: true })
          .select()
          .single();
        if (error) throw error;

        if (bankForm.opening_balance) {
          await supabase.from('bank_balance_history').insert({
            bank_id: data.id,
            previous_balance: null,
            new_balance: bankForm.opening_balance,
            reason: 'Initial balance',
            changed_by: currentUser?.id,
          });
        }
        logAction({
          action: 'create',
          table_name: 'banks',
          record_id: data.id,
          description: `Added bank: ${bankForm.bank_name} (${bankForm.account_number}) — opening ${formatCurrency(bankForm.opening_balance)}`,
          new_values: bankForm,
        });

        setBanks([...banks, data]);
      }

      resetBankForm();
      setShowBankForm(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const startEditBank = (bank: Bank) => {
    setBankForm({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_holder: bank.account_holder || '',
      ifsc_code: bank.ifsc_code || '',
      opening_balance: bank.opening_balance || 0,
    });
    setEditingBankId(bank.id);
    setBalanceChangeReason('');
    setShowBankForm(true);
  };

  const toggleBankHistory = async (bankId: number) => {
    if (historyOpenFor === bankId) {
      setHistoryOpenFor(null);
      return;
    }
    setHistoryOpenFor(bankId);
    if (!historyByBank[bankId]) {
      const { data, error } = await supabase
        .from('bank_balance_history')
        .select('*')
        .eq('bank_id', bankId)
        .order('created_at', { ascending: false });
      if (error) {
        alert(`Error loading history: ${error.message}`);
        return;
      }
      setHistoryByBank((h) => ({ ...h, [bankId]: data || [] }));
    }
  };

  const handleAddCategory = async (type: 'expense' | 'income') => {
    const name = (type === 'expense' ? newExpenseCategory : newIncomeCategory).trim();
    if (!name) return;

    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ type, name, is_default: false, created_by: currentUser?.id })
        .select()
        .single();
      if (error) throw error;

      if (type === 'expense') {
        setExpenseCategories([...expenseCategories, data]);
        setNewExpenseCategory('');
      } else {
        setIncomeCategories([...incomeCategories, data]);
        setNewIncomeCategory('');
      }
      logAction({
        action: 'create',
        table_name: 'categories',
        record_id: data.id,
        description: `Added ${type} category: ${name}`,
        new_values: { type, name },
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: number, type: 'expense' | 'income') => {
    if (!confirm('Delete this category? Existing transactions using it will retain the reference.')) return;
    try {
      const list = type === 'expense' ? expenseCategories : incomeCategories;
      const prev = list.find((c) => c.id === id);
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      if (type === 'expense') {
        setExpenseCategories(expenseCategories.filter((c) => c.id !== id));
      } else {
        setIncomeCategories(incomeCategories.filter((c) => c.id !== id));
      }
      logAction({
        action: 'delete',
        table_name: 'categories',
        record_id: id,
        description: `Deleted ${type} category: ${prev?.name || id}`,
        old_values: prev as any,
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteBank = async (id: number) => {
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
        description: `Deleted bank: ${prev?.bank_name} (${prev?.account_number})`,
        old_values: prev as any,
      });
      alert('Bank deleted');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="spinner w-12 h-12 mx-auto"></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-18-charcoal mb-8">Settings</h1>

      {/* Banks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-18-charcoal">Banks</h2>
          <button
            onClick={() => {
              if (showBankForm) {
                setShowBankForm(false);
                resetBankForm();
              } else {
                resetBankForm();
                setShowBankForm(true);
              }
            }}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            Add Bank
          </button>
        </div>

        {showBankForm && (
          <div className="card bg-18-yellow mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingBankId ? 'Edit Bank' : 'Add New Bank'}
              </h3>
              <button
                onClick={() => {
                  setShowBankForm(false);
                  resetBankForm();
                }}
                className="text-18-charcoal hover:text-18-orange"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Bank Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankForm.account_number}
                    onChange={(e) =>
                      setBankForm({ ...bankForm, account_number: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Holder</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankForm.account_holder}
                    onChange={(e) =>
                      setBankForm({ ...bankForm, account_holder: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankForm.ifsc_code}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value })}
                  />
                </div>
                <div className="form-group md:col-span-2">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={bankForm.opening_balance}
                    onChange={(e) =>
                      setBankForm({
                        ...bankForm,
                        opening_balance: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  <p className="text-xs text-18-dark-text mt-1">
                    Starting cash in this bank. Used by the Dashboard&apos;s Current Balance.
                  </p>
                </div>
                {editingBankId &&
                  bankForm.opening_balance !==
                    (banks.find((b) => b.id === editingBankId)?.opening_balance || 0) && (
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Reason for balance change</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Reconciled to bank statement"
                        value={balanceChangeReason}
                        onChange={(e) => setBalanceChangeReason(e.target.value)}
                      />
                      <p className="text-xs text-18-dark-text mt-1">
                        Logged in the balance history for this bank.
                      </p>
                    </div>
                  )}
              </div>

              <button type="submit" className="btn btn-primary">
                {editingBankId ? 'Save Changes' : 'Add Bank'}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          {banks.length > 0 ? (
            <div className="space-y-4">
              {banks.map((bank) => (
                <div key={bank.id} className="pb-4 border-b border-18-border last:border-b-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-18-charcoal">{bank.bank_name}</p>
                      <p className="text-sm text-18-dark-text">{bank.account_number}</p>
                      {bank.account_holder && (
                        <p className="text-xs text-18-dark-text">{bank.account_holder}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-18-dark-text uppercase font-semibold">Opening</p>
                        <p className="font-bold text-18-charcoal">
                          {formatCurrency(bank.opening_balance || 0)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleBankHistory(bank.id)}
                        className={`hover:text-18-orange ${
                          historyOpenFor === bank.id ? 'text-18-orange' : 'text-18-dark-text'
                        }`}
                        title="Balance history"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => startEditBank(bank)}
                        className="text-18-dark-text hover:text-18-orange"
                        title="Edit bank"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBank(bank.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete bank"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {historyOpenFor === bank.id && (
                    <div className="mt-4 pl-4 border-l-2 border-18-border">
                      <p className="text-xs uppercase font-bold text-18-dark-text mb-2">
                        Opening balance history
                      </p>
                      {historyByBank[bank.id] === undefined ? (
                        <p className="text-xs text-18-dark-text">Loading…</p>
                      ) : historyByBank[bank.id].length === 0 ? (
                        <p className="text-xs text-18-dark-text">No changes recorded.</p>
                      ) : (
                        <ul className="space-y-2">
                          {historyByBank[bank.id].map((h) => (
                            <li key={h.id} className="text-xs">
                              <span className="text-18-dark-text">{formatDate(h.created_at)} — </span>
                              {h.previous_balance !== null ? (
                                <>
                                  <span className="text-red-600 line-through">
                                    {formatCurrency(h.previous_balance)}
                                  </span>
                                  <span className="mx-2 text-18-dark-text">→</span>
                                </>
                              ) : (
                                <span className="mr-1 text-18-dark-text italic">initial</span>
                              )}
                              <span className="font-semibold text-18-charcoal">
                                {formatCurrency(h.new_balance)}
                              </span>
                              {h.reason && (
                                <span className="text-18-dark-text"> — {h.reason}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-18-dark-text text-center py-8">No banks configured</p>
          )}
        </div>
      </div>

      {/* Categories Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {(
          [
            {
              type: 'expense' as const,
              title: 'Expense Categories',
              items: expenseCategories,
              value: newExpenseCategory,
              setValue: setNewExpenseCategory,
            },
            {
              type: 'income' as const,
              title: 'Income Categories',
              items: incomeCategories,
              value: newIncomeCategory,
              setValue: setNewIncomeCategory,
            },
          ]
        ).map(({ type, title, items, value, setValue }) => (
          <div key={type} className="card">
            <h2 className="text-xl font-bold text-18-charcoal mb-4">{title}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCategory(type);
              }}
              className="flex gap-2 mb-4"
            >
              <input
                type="text"
                className="form-input flex-1"
                placeholder={`New ${type} category`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
                <Plus size={16} />
                Add
              </button>
            </form>
            {items.length > 0 ? (
              <ul className="divide-y divide-18-border">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2">
                    <span className="text-18-charcoal">
                      {c.name}
                      {c.is_default && (
                        <span className="ml-2 text-xs text-18-dark-text uppercase tracking-wide">
                          default
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(c.id, type)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-18-dark-text text-center py-6 text-sm">No categories yet</p>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
