'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/reset-password`
              : undefined,
        }
      );
      if (authError) throw authError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
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

  if (sent) {
    return (
      <Wrapper>
        <div className="bg-18-surface border border-18-border rounded-2xl p-10 text-center shadow-2xl">
          <div className="bg-18-orange/15 border border-18-orange/40 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6">
            <span className="text-3xl">📬</span>
          </div>
          <h1 className="text-2xl font-black text-white">Check your email</h1>
          <p className="text-gray-400 mt-3">
            If an account exists for <strong className="text-white">{email}</strong>, we sent a
            link to reset your password. Check your inbox (and spam).
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-18-orange font-semibold hover:underline"
          >
            Back to sign in →
          </Link>
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
        <h1 className="text-3xl font-black text-white">Reset your password</h1>
        <p className="text-sm text-gray-400 mt-2">
          Enter your email — we&apos;ll send you a link to set a new password.
        </p>
      </div>

      <div className="bg-18-surface border border-18-border rounded-2xl p-8 shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-18-bg border border-18-border rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-18-orange transition-colors"
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-18-orange text-white font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all shadow-[0_10px_30px_-5px_rgba(243,115,53,0.5)]"
          >
            {loading ? 'Sending…' : 'Send reset link'}
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
