'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import GoogleAuthButton from '@/components/GoogleAuthButton';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() || email.split('@')[0] },
        },
      });

      if (authError) throw authError;

      if (data.session) {
        router.push('/dashboard');
      } else {
        setNeedsVerification(true);
      }
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (needsVerification) {
    return (
      <div className="relative min-h-screen bg-18-bg text-white flex items-center justify-center px-4 font-poppins overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />
        <div className="relative z-10 w-full max-w-md bg-18-surface border border-18-border rounded-2xl p-10 text-center shadow-2xl">
          <div className="bg-18-orange/15 border border-18-orange/40 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6">
            <span className="text-3xl">📬</span>
          </div>
          <h1 className="text-2xl font-black text-white">Check your email</h1>
          <p className="text-gray-400 mt-3">
            We sent a verification link to <strong className="text-white">{email}</strong>.
            Click it, then come back and sign in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-18-orange font-semibold hover:underline"
          >
            Go to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-18-bg text-white flex items-center justify-center px-4 py-8 font-poppins overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.5)]">
              <span className="text-white font-bold text-xs">PFT</span>
            </div>
            <span className="font-bold text-white text-lg">Personal FT</span>
          </Link>
          <h1 className="text-3xl font-black text-white">
            Start tracking, <span className="text-18-orange italic">free</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">Create your account in 30 seconds.</p>
        </div>

        <div className="bg-18-surface border border-18-border rounded-2xl p-8 shadow-2xl">
          <GoogleAuthButton label="Sign up with Google" />

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-18-border" />
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-18-border" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Your name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Priya Sharma"
                className="w-full px-4 py-3 bg-18-bg border border-18-border rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:border-18-orange transition-colors"
                required
              />
            </div>

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
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Password
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-18-orange font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
