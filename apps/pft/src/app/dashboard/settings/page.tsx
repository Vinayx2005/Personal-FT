'use client';

// Settings — account-level knobs plus, on desktop, the Banks and
// Categories managers. Mobile keeps Banks and Categories on their own
// routes (/dashboard/banks, /dashboard/categories) reached from the
// More tab; desktop users are used to finding them alongside password
// and account controls, so we render them inline here behind md:block.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { useRouter } from 'next/navigation';
import { Trash2, X, AlertTriangle, Lock, Eye, EyeOff, Check, LogOut } from 'lucide-react';
import BanksManager from '@/components/BanksManager';
import CategoriesManager from '@/components/CategoriesManager';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ----- Password management -----
  // hasPassword = null while loading; true if the user already has an
  // email/password identity, false if OAuth-only (Google) — the form
  // adapts between "change" and "set".
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ----- Delete account -----
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const identities = (authUser?.identities || []) as Array<{ provider: string }>;
        setHasPassword(identities.some((i) => i.provider === 'email'));
        setAuthEmail(authUser?.email || '');

        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser?.id)
          .single();
        setCurrentUser(userData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setLoading(false);
      }
    })();
  }, []);

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

      // After setting a password on an OAuth-only account, the email
      // identity now exists so future visits show the "current" field.
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
    return <div className="spinner w-12 h-12 mx-auto" />;
  }

  return (
    <div className="space-y-4">
      {/* Page identity comes from the More tab that brought you here —
          H1 dropped so the password / sign-out / danger blocks show
          higher up on the mobile viewport. */}

      {/* Banks + Categories — desktop only. On mobile these live on their
          own routes reached from the More tab; showing them here too
          would double the scroll for the same content. */}
      <div className="hidden md:block">
        <BanksManager />
      </div>
      <div className="hidden md:block">
        <CategoriesManager />
      </div>

      {/* ---------- ACCOUNT SECURITY (PASSWORD) ---------- */}
      <div className="bg-18-surface border border-18-border rounded-2xl p-5">
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

            {/* Show/hide toggle sits on its own row and left-aligned so it
                doesn't share a line with the submit button — on mobile the
                two would otherwise collide and the "Set password" pill got
                squished against the right edge. */}
            <div>
              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="inline-flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
              >
                {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPasswords ? 'Hide passwords' : 'Show passwords'}
              </button>
            </div>

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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-18-orange text-white rounded-full px-5 py-3 sm:py-2.5 text-sm font-bold hover:brightness-110 transition-all shadow-[0_8px_24px_-8px_rgba(243,115,53,0.6)] disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* ---------- SIGN OUT ---------- */}
      {/* Kept above the danger zone so a mis-tap toward "leave" hits the
          safe option first — sign-out ends the session but keeps all
          data intact. */}
      <div className="bg-18-surface border border-18-border rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">Sign out</h2>
            <p className="text-sm text-white/60 mt-1">
              End this session on this device. Your data stays on our servers.
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
            className="shrink-0 inline-flex items-center gap-2 bg-white/5 border border-white/15 text-white hover:bg-white/10 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
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
