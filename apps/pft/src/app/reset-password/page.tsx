'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw authError;
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err: any) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="relative min-h-[100dvh] bg-18-bg text-white flex items-center justify-center px-4 py-8 font-poppins">
      <div className="pointer-events-none absolute inset-0 bg-glow-hero overflow-hidden" aria-hidden />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );

  if (done) {
    return (
      <Wrapper>
        <div className="bg-18-surface border border-18-border rounded-2xl p-10 text-center shadow-2xl">
          <div className="bg-green-900/40 border border-green-800/50 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6">
            <span className="text-3xl">✓</span>
          </div>
          <h1 className="text-2xl font-black text-white">Password updated</h1>
          <p className="text-gray-400 mt-3">Taking you to your dashboard…</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.5)]">
            <span className="text-white font-bold text-xs">PFT</span>
          </div>
          <span className="font-bold text-white text-lg">Personal FT</span>
        </Link>
        <h1 className="text-3xl font-black text-white">Set a new password</h1>
        {!ready && (
          <p className="text-sm text-gray-400 mt-2">Waiting for the recovery link…</p>
        )}
      </div>

      <div className="bg-18-surface border border-18-border rounded-2xl p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              className="w-full px-4 py-3 bg-18-bg border border-18-border rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-18-orange transition-colors"
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Type it again"
              minLength={8}
              className="w-full px-4 py-3 bg-18-bg border border-18-border rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-18-orange transition-colors"
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !ready}
            className="w-full py-3 bg-18-orange text-white font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_10px_30px_-5px_rgba(243,115,53,0.5)]"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-400 mt-6">
        <Link href="/login" className="text-18-orange font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </Wrapper>
  );
}
