'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import GoogleAuthButton from '@/components/GoogleAuthButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.push('/dashboard');
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      router.push('/dashboard');
    } catch (err: any) {
      // Supabase auth errors sometimes come back as objects with a nested
      // shape (e.g. { code, message } or { error, error_description }). The
      // old `err.message || 'Login failed'` was rendering `{}` when the
      // message was itself an empty-object placeholder. Try each shape in
      // order and only fall back to the generic string.
      const msg =
        (typeof err?.message === 'string' && err.message.trim() && err.message !== '{}' && err.message) ||
        (typeof err?.error_description === 'string' && err.error_description) ||
        (typeof err?.error === 'string' && err.error) ||
        (err?.status ? `Login failed (HTTP ${err.status})` : null) ||
        'Login failed. Check your email and password, then try again.';
      setError(String(msg));
      // Log the full shape so we can debug from browser devtools even when
      // the visible bubble is the friendly fallback.
      // eslint-disable-next-line no-console
      console.warn('[login] signInWithPassword error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    // NOTE: `min-h-[100dvh]` (dynamic viewport height) so iOS mobile Safari
    // shrinks this container when the on-screen keyboard opens instead of
    // keeping it at the full pre-keyboard height. Combined with removing
    // `overflow-hidden` from the outer wrapper, this stops the focus-loss/
    // refocus cycle that made the keyboard flicker on every keystroke inside
    // the installed PWA (iOS's "scroll input into view" was fighting a
    // clipped 100vh ancestor).
    <div className="relative min-h-[100dvh] bg-18-bg text-white flex items-center justify-center px-4 py-8 font-poppins">
      <div className="pointer-events-none absolute inset-0 bg-glow-hero overflow-hidden" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.5)]">
              <span className="text-white font-bold text-xs">PFT</span>
            </div>
            <span className="font-bold text-white text-lg">Personal FT</span>
          </Link>
          <h1 className="text-3xl font-black text-white">Welcome back</h1>
          <p className="text-sm text-gray-400 mt-2">Sign in to see where your money went.</p>
        </div>

        <div className="bg-18-surface border border-18-border rounded-2xl p-8 shadow-2xl">
          <GoogleAuthButton label="Sign in with Google" />

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-18-border" />
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-18-border" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-18-orange hover:underline">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-18-bg border border-18-border rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-18-orange transition-colors"
                required
                autoComplete="current-password"
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
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          New here?{' '}
          <Link href="/signup" className="text-18-orange font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
