'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Bank, Category, BankBalanceHistory } from '@/types';
import { formatCurrency, formatDate, formatDateISO } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Plus, Edit2, Trash2, X, History, AlertTriangle, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { logAction } from '@/lib/auditLog';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  // net (income − expense) across all time, keyed by bank_id — for live balance display
  const [bankNet, setBankNet] = useState<Record<number, number>>({});
  // Net movement per bank BEFORE today (client local). Used to render the
  // "today's opening" caption on each bank row — auto-rolls at midnight
  // because yesterday's transactions fall into this bucket at 00:00.
  const [bankNetBeforeToday, setBankNetBeforeToday] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [showBankForm, setShowBankForm] = useState(false);

  const [bankForm, setBankForm] = useState({
    bank_name: '',
    opening_balance: 0,
  });
  // Separate raw text state so the input can truly be empty (a number `0`
  // in `bankForm.opening_balance` used to render as "0" that couldn't
  // be cleared — every keystroke re-clamped back to 0 through parseFloat).
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');

  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<Category[]>([]);
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newIncomeCategory, setNewIncomeCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [editingBankId, setEditingBankId] = useState<number | null>(null);
  const [balanceChangeReason, setBalanceChangeReason] = useState('');
  const [historyOpenFor, setHistoryOpenFor] = useState<number | null>(null);
  const [historyByBank, setHistoryByBank] = useState<Record<number, BankBalanceHistory[]>>({});

  // ----- Password management -----
  // hasPassword = null while loading; true if user already has an email/password
  // identity, false if they only signed in via an OAuth provider (Google) and
  // need to "set" a password for the first time.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        // Track whether the user has an email/password identity (so we know
        // to show a "current password" field) or is OAuth-only (so we show
        // "set password" instead of "change password").
        const identities = (authUser?.identities || []) as Array<{ provider: string }>;
        setHasPassword(identities.some((i) => i.provider === 'email'));
        setAuthEmail(authUser?.email || '');

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser?.id)
          .single();

        setCurrentUser(userData);

        const { data: banksData } = await supabase.from('banks').select('*');
        const { data: categoriesData } = await supabase.from('categories').select('*');

        // Per-bank net across all time (transfers included — real money movement).
        // Also compute the subset dated BEFORE today so each bank row can show
        // "today's opening" (anchor + everything before today = balance at 00:00).
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
        setBankNet(net);
        setBankNetBeforeToday(netBeforeToday);

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
      opening_balance: 0,
    });
    setOpeningBalanceInput('');
    setEditingBankId(null);
    setBalanceChangeReason('');
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.id) {
      alert('Session expired — please reload.');
      return;
    }
    if (!bankForm.bank_name.trim()) {
      alert('Bank name is required');
      return;
    }

    try {
      if (editingBankId) {
        const existing = banks.find((b) => b.id === editingBankId);
        const prevOpening = existing?.opening_balance ?? 0;
        const net = bankNet[editingBankId] || 0;
        const prevCurrent = prevOpening + net;

        // The field is bound to `bankForm.opening_balance` for legacy reasons
        // but in edit mode represents the DESIRED CURRENT balance. Back-compute
        // the opening so opening + net = desiredCurrent. The transaction total
        // (net) is not touched, so no history is corrupted.
        const desiredCurrent = bankForm.opening_balance;
        const newOpening = desiredCurrent - net;
        const balanceChanged = prevCurrent !== desiredCurrent;

        const { data, error } = await supabase
          .from('banks')
          .update({
            bank_name: bankForm.bank_name,
            opening_balance: newOpening,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBankId)
          .select()
          .single();
        if (error) throw error;

        if (balanceChanged) {
          // bank_balance_history records the OPENING change (that's what the
          // schema tracks). The audit log message frames it as a current-
          // balance correction, which is how the user thinks about it.
          const { error: histErr } = await supabase.from('bank_balance_history').insert({
            bank_id: editingBankId,
            previous_balance: prevOpening,
            new_balance: newOpening,
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
            description: `Corrected ${bankForm.bank_name} balance: ${formatCurrency(prevCurrent)} → ${formatCurrency(desiredCurrent)}${balanceChangeReason ? ` (${balanceChangeReason})` : ''}`,
            old_values: { opening_balance: prevOpening, current_balance: prevCurrent },
            new_values: { opening_balance: newOpening, current_balance: desiredCurrent, reason: balanceChangeReason },
          });
        } else {
          logAction({
            action: 'update',
            table_name: 'banks',
            record_id: editingBankId,
            description: `Updated bank details: ${bankForm.bank_name}`,
            new_values: { bank_name: bankForm.bank_name },
          });
        }

        setBanks(banks.map((b) => (b.id === editingBankId ? { ...b, ...data } : b)));
      } else {
        const { data, error } = await supabase
          .from('banks')
          .insert({ ...bankForm, is_active: true, user_id: currentUser?.id })
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
          description: `Added bank: ${bankForm.bank_name} — opening ${formatCurrency(bankForm.opening_balance)}`,
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
    // For an existing bank, the field represents the CURRENT balance the user
    // sees on their statement today — not the historical opening. This makes
    // corrections one-step: "my card says -₹2,000 now" → enter -2000. On save
    // we back-compute the opening so opening + net = the number typed here.
    // The `bankForm.opening_balance` slot holds this desired-current value in
    // edit mode (its name is legacy; interpret contextually via editingBankId).
    const opening = bank.opening_balance || 0;
    const net = bankNet[bank.id] || 0;
    const current = opening + net;
    setBankForm({
      bank_name: bank.bank_name,
      opening_balance: current,
    });
    setOpeningBalanceInput(current !== 0 ? String(current) : '');
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
        .insert({ type, name, is_default: false, user_id: currentUser?.id })
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
    const list = type === 'expense' ? expenseCategories : incomeCategories;
    const prev = list.find((c) => c.id === id);
    // Check for referencing transactions first — the FK has no ON DELETE
    // action, so a DELETE while any transaction points here throws a raw
    // Postgres foreign-key error at the user.
    try {
      const { count, error: countErr } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id);
      if (countErr) throw countErr;
      if ((count ?? 0) > 0) {
        alert(
          `Can't delete "${prev?.name}" — ${count} transaction${count === 1 ? '' : 's'} still use this category. Move them to another category first, then try again.`
        );
        return;
      }
    } catch (err: any) {
      alert(`Error checking category usage: ${err.message}`);
      return;
    }
    if (!confirm(`Delete "${prev?.name}"?`)) return;
    try {
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

  const startEditCategory = (c: Category) => {
    setEditingCategoryId(c.id);
    setEditingCategoryName(c.name);
  };
  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };
  const handleUpdateCategory = async (id: number, type: 'expense' | 'income') => {
    const name = editingCategoryName.trim();
    if (!name) return;
    const list = type === 'expense' ? expenseCategories : incomeCategories;
    const prev = list.find((c) => c.id === id);
    if (prev && prev.name === name) { cancelEditCategory(); return; }
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const updater = (arr: Category[]) => arr.map((c) => (c.id === id ? (data as Category) : c));
      if (type === 'expense') setExpenseCategories(updater(expenseCategories));
      else setIncomeCategories(updater(incomeCategories));
      logAction({
        action: 'update',
        table_name: 'categories',
        record_id: id,
        description: `Renamed ${type} category: ${prev?.name || id} → ${name}`,
        old_values: prev as any,
        new_values: { name },
      });
      cancelEditCategory();
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
        description: `Deleted bank: ${prev?.bank_name}`,
        old_values: prev as any,
      });
      alert('Bank deleted');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', text: 'New password and confirmation don’t match.' });
      return;
    }
    if (hasPassword && !currentPassword) {
      setPasswordFeedback({ type: 'error', text: 'Enter your current password to confirm the change.' });
      return;
    }

    setSavingPassword(true);
    try {
      // If they already have a password, verify it first by re-signing in.
      // Supabase's updateUser doesn't require the old password, so without
      // this check anyone with a live session could rotate the credential.
      if (hasPassword) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: currentPassword,
        });
        if (verifyErr) {
          setPasswordFeedback({ type: 'error', text: 'Current password is incorrect.' });
          setSavingPassword(false);
          return;
        }
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) {
        setPasswordFeedback({ type: 'error', text: updErr.message });
        setSavingPassword(false);
        return;
      }

      // Refresh identity info — after setting a password on an OAuth-only
      // account, the email identity now exists so future visits show the
      // "current password" field.
      const { data: { user: refreshed } } = await supabase.auth.getUser();
      const identities = (refreshed?.identities || []) as Array<{ provider: string }>;
      setHasPassword(identities.some((i) => i.provider === 'email'));

      setPasswordFeedback({
        type: 'success',
        text: hasPassword ? 'Password updated.' : 'Password set — you can now sign in with email + password too.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', text: err.message || 'Something went wrong.' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      // The RPC wipes every row this user owns AND their auth.users row.
      // If it hasn't been installed yet, fall back to a best-effort wipe
      // via RLS-scoped deletes so at least the data is gone.
      const { error: rpcErr } = await supabase.rpc('delete_own_account');
      if (rpcErr) {
        console.warn('delete_own_account RPC failed:', rpcErr.message);
        const uid = currentUser?.id;
        if (uid) {
          // Use the actual column names — transactions/investments use
          // `created_by`, bank_balance_history uses `changed_by`.
          await Promise.all([
            supabase.from('transactions').delete().eq('created_by', uid),
            supabase.from('investments').delete().eq('created_by', uid),
            supabase.from('bank_balance_history').delete().eq('changed_by', uid),
            supabase.from('budgets').delete().eq('user_id', uid),
            supabase.from('banks').delete().eq('user_id', uid),
            supabase.from('categories').delete().eq('user_id', uid),
            supabase.from('audit_log').delete().eq('user_id', uid),
          ]);
        }
      }
      await supabase.auth.signOut();
      router.replace('/');
    } catch (err: any) {
      alert(`Delete failed: ${err.message || err}`);
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return <div className="spinner w-12 h-12 mx-auto"></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* Banks Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Banks/Cards</h2>
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
            Add Bank/Card
          </button>
        </div>

        {showBankForm && (
          <div className="card bg-18-surface border-18-border mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {editingBankId ? 'Edit Bank/Card' : 'Add New Bank/Card'}
              </h3>
              <button
                onClick={() => {
                  setShowBankForm(false);
                  resetBankForm();
                }}
                className="text-white hover:text-18-orange"
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
                <div className="form-group md:col-span-2">
                  <label className="form-label">
                    {editingBankId ? 'Current Balance (₹)' : 'Opening Balance (₹)'}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="0.00"
                    value={openingBalanceInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Allow empty OR a valid partial decimal, with an optional
                      // leading `-` for credit cards / accounts that start in
                      // the red. "-", "-1", "-1.", "-.5", "1.5" all accepted
                      // during typing; parseFloat treats a lone "-" as NaN so
                      // we fall through to 0 until a digit is entered.
                      if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
                        setOpeningBalanceInput(raw);
                        setBankForm({
                          ...bankForm,
                          opening_balance: raw === '' ? 0 : parseFloat(raw) || 0,
                        });
                      }
                    }}
                  />
                  <p className="text-xs text-18-dark-text mt-1">
                    {editingBankId
                      ? "What your statement shows right now. We'll adjust the opening balance so the math lines up — transactions aren't touched."
                      : 'Starting cash in this account. Enter a negative value for credit cards or any account that starts in the red.'}
                  </p>
                </div>
                {editingBankId && (() => {
                  // Show the reason field only when the desired current differs
                  // from what the app currently computes (opening + net).
                  const existing = banks.find((b) => b.id === editingBankId);
                  const existingOpening = existing?.opening_balance || 0;
                  const net = bankNet[editingBankId] || 0;
                  const existingCurrent = existingOpening + net;
                  if (bankForm.opening_balance === existingCurrent) return null;
                  return (
                    <div className="form-group md:col-span-2">
                      <label className="form-label">Reason for balance correction</label>
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
                  );
                })()}
              </div>

              <button type="submit" className="btn btn-primary">
                {editingBankId ? 'Save Changes' : 'Add Bank/Card'}
              </button>
            </form>
          </div>
        )}

        <div className="card">
          {banks.length > 0 ? (
            <div className="space-y-4">
              {banks.map((bank) => {
                const opening = bank.opening_balance || 0;
                const net = bankNet[bank.id] || 0;
                const current = opening + net;
                // Today's opening = anchor + everything before today. The ±
                // beside it is only today's movement (current − todayOpening),
                // so the two numbers add up to the big "current" figure.
                const netBeforeToday = bankNetBeforeToday[bank.id] || 0;
                const todayOpening = opening + netBeforeToday;
                const todayChange = current - todayOpening;
                return (
                <div key={bank.id} className="pb-4 border-b border-18-border last:border-b-0">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{bank.bank_name}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-end">
                      <div className="text-right">
                        <p className="text-xs text-18-dark-text uppercase font-semibold">Current</p>
                        <p className={`font-bold ${current < 0 ? 'text-red-300' : 'text-white'}`}>
                          {formatCurrency(current)}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">
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
                      </div>
                      <button
                        onClick={() => toggleBankHistory(bank.id)}
                        className={`hover:text-18-orange p-2 -m-2 ${
                          historyOpenFor === bank.id ? 'text-18-orange' : 'text-18-dark-text'
                        }`}
                        title="Balance history"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => startEditBank(bank)}
                        className="text-18-dark-text hover:text-18-orange p-2 -m-2"
                        title="Edit bank"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBank(bank.id)}
                        className="text-red-400 hover:text-red-300 p-2 -m-2"
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
                                  <span className="text-red-400 line-through">
                                    {formatCurrency(h.previous_balance)}
                                  </span>
                                  <span className="mx-2 text-18-dark-text">→</span>
                                </>
                              ) : (
                                <span className="mr-1 text-18-dark-text italic">initial</span>
                              )}
                              <span className="font-semibold text-white">
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
                );
              })}
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
            <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
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
                {items.map((c) => {
                  const isEditing = editingCategoryId === c.id;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            className="form-input flex-1 !py-1.5 text-sm"
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleUpdateCategory(c.id, type); }
                              if (e.key === 'Escape') { e.preventDefault(); cancelEditCategory(); }
                            }}
                            autoFocus
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleUpdateCategory(c.id, type)}
                              disabled={!editingCategoryName.trim()}
                              className="text-xs font-semibold text-18-orange hover:text-orange-400 px-2 disabled:opacity-40"
                              title="Save"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditCategory}
                              className="text-white/50 hover:text-white p-1"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-white min-w-0 truncate">
                            {c.name}
                            {c.is_default && (
                              <span className="ml-2 text-xs text-18-dark-text uppercase tracking-wide">
                                default
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startEditCategory(c)}
                              className="text-white/60 hover:text-18-orange p-2"
                              title="Rename category"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id, type)}
                              className="text-red-400 hover:text-red-300 p-2"
                              title="Delete category"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-18-dark-text text-center py-6 text-sm">No categories yet</p>
            )}
          </div>
        ))}
      </div>

      {/* ---------- ACCOUNT SECURITY (PASSWORD) ---------- */}
      <div className="bg-18-surface border border-18-border rounded-2xl p-5 mb-8">
        <div className="flex items-start gap-3 mb-4">
          <Lock className="text-18-orange shrink-0 mt-0.5" size={18} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-white">
              {hasPassword === false ? 'Set a password' : 'Change password'}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              {hasPassword === null
                ? 'Checking your account…'
                : hasPassword
                ? 'Update the password you use to sign in with email.'
                : 'You currently sign in with Google. Set a password so you can also sign in with your email.'}
            </p>
          </div>
        </div>

        {hasPassword !== null && (
          <form onSubmit={handleSavePassword} className="space-y-4 max-w-md">
            {hasPassword && (
              <div>
                <label className="block text-xs uppercase tracking-widest font-bold text-white/50 mb-2">
                  Current password
                </label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="form-input"
                  placeholder="••••••••"
                  disabled={savingPassword}
                />
              </div>
            )}

            <div>
              <label className="block text-xs uppercase tracking-widest font-bold text-white/50 mb-2">
                New password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="form-input"
                placeholder="At least 8 characters"
                disabled={savingPassword}
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest font-bold text-white/50 mb-2">
                Confirm new password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="form-input"
                placeholder="Type it again"
                disabled={savingPassword}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowPasswords((v) => !v)}
              className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
            >
              {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
            </button>

            {passwordFeedback && (
              <div
                className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-green-900/30 border border-green-800/40 text-green-300'
                    : 'bg-red-900/30 border border-red-800/40 text-red-300'
                }`}
              >
                {passwordFeedback.type === 'success' ? (
                  <Check size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                )}
                <span>{passwordFeedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
              className="inline-flex items-center gap-2 bg-18-orange text-white rounded-full px-5 py-2.5 text-sm font-bold hover:brightness-110 transition-all shadow-[0_8px_24px_-8px_rgba(243,115,53,0.6)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Lock size={14} />
              {savingPassword
                ? 'Saving…'
                : hasPassword
                ? 'Update password'
                : 'Set password'}
            </button>
          </form>
        )}
      </div>

      {/* ---------- DANGER ZONE ---------- */}
      <div className="border-2 border-red-900/50 bg-red-950/20 rounded-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <div>
            <h2 className="text-lg font-bold text-red-300">Danger zone</h2>
            <p className="text-sm text-white/60 mt-1">
              Delete your account permanently. Every bank, category, transaction, budget, and investment tied to this account will be wiped. This action cannot be undone.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDeleteConfirmText('');
            setShowDeleteAccount(true);
          }}
          className="inline-flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        >
          <Trash2 size={14} />
          Delete my account
        </button>
      </div>

      {showDeleteAccount && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => !deletingAccount && setShowDeleteAccount(false)}
        >
          <div
            className="bg-18-surface border-2 border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black text-white">Delete your account?</h3>
                <p className="text-xs text-white/50 mt-0.5">This is irreversible.</p>
              </div>
              {!deletingAccount && (
                <button
                  onClick={() => setShowDeleteAccount(false)}
                  className="ml-auto text-white/50 hover:text-white p-1"
                  aria-label="Cancel"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="bg-18-bg/60 border border-red-900/40 rounded-xl p-4 mb-4">
              <p className="text-sm text-white/80 font-semibold mb-2">
                This will permanently wipe:
              </p>
              <ul className="text-sm text-white/70 space-y-1 list-disc pl-5">
                <li>All banks, categories, and their history</li>
                <li>Every transaction (income + expenses)</li>
                <li>Budgets, investments, and audit logs</li>
                <li>Your login — you can&apos;t recover the account</li>
              </ul>
            </div>

            <label className="block text-xs uppercase tracking-widest font-bold text-white/50 mb-2">
              Type <span className="text-red-300">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              autoFocus
              disabled={deletingAccount}
              className="form-input mb-5"
            />

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={() => setShowDeleteAccount(false)}
                disabled={deletingAccount}
                className="sm:flex-1 py-3.5 rounded-full bg-18-surface border border-18-border text-white font-semibold text-base hover:bg-18-surface-2 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount || deleteConfirmText !== 'DELETE'}
                className="sm:flex-1 py-3.5 rounded-full bg-red-500 text-white font-bold text-base hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingAccount ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
