'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  Mic,
  Eye,
  Shield,
  Smartphone,
  LineChart,
  ArrowRight,
  Check,
  X as XIcon,
  Flame,
  Wallet,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

const ROTATING_WORDS = ['Track', 'Plan', 'Grow'];

export default function LandingPage() {
  const router = useRouter();
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard');
    });
  }, [router]);

  useEffect(() => {
    const id = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_WORDS.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-18-bg text-white font-poppins overflow-x-hidden">
      {/* ------------------------------- NAV ------------------------------- */}
      <header className="relative z-20 max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.5)]">
            <span className="text-white font-bold text-xs">PFT</span>
          </div>
          <span className="font-bold text-white text-lg">Personal FT</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors">Features</a>
          <a href="#how" className="text-sm text-gray-300 hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="text-sm text-gray-300 hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="text-sm text-gray-300 hover:text-white transition-colors">FAQ</a>
        </nav>
        <Link
          href="/signup"
          className="bg-white text-18-bg font-semibold text-sm px-5 py-2 rounded-full hover:bg-gray-100 transition-all flex items-center gap-1"
        >
          Start free trial
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* ------------------------------ HERO ------------------------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />

        {/* Drifting ambient blob — adds slow ambient motion */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-br from-18-orange/25 via-fuchsia-500/10 to-transparent blur-3xl hero-blob"
          aria-hidden
        />

        {/* Floating transaction chips — desktop only to avoid mobile clutter */}
        <div className="pointer-events-none hidden lg:block absolute inset-0 z-[5]" aria-hidden>
          <div
            className="hero-chip absolute top-24 left-6 xl:left-16 flex items-center gap-2 bg-18-surface/80 border border-18-border rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-sm"
            style={{ ['--rot' as string]: '-6deg' }}
          >
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-[11px] font-semibold text-gray-200">Zomato</span>
            <span className="text-[11px] font-bold text-rose-400 tabular-nums">−₹480</span>
          </div>
          <div
            className="hero-chip-b absolute top-40 right-6 xl:right-16 flex items-center gap-2 bg-18-surface/80 border border-18-border rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-sm"
            style={{ ['--rot' as string]: '5deg' }}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold text-gray-200">Salary</span>
            <span className="text-[11px] font-bold text-emerald-400 tabular-nums">+₹85k</span>
          </div>
          <div
            className="hero-chip-c absolute top-72 left-2 xl:left-10 flex items-center gap-2 bg-18-surface/80 border border-18-border rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-sm"
            style={{ ['--rot' as string]: '-4deg' }}
          >
            <Flame size={12} className="text-18-orange" />
            <span className="text-[11px] font-bold text-18-orange">7-day streak</span>
          </div>
          <div
            className="hero-chip-d absolute top-[19rem] right-2 xl:right-10 flex items-center gap-2 bg-18-surface/80 border border-18-border rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-sm"
            style={{ ['--rot' as string]: '7deg' }}
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-semibold text-gray-200">Rent</span>
            <span className="text-[11px] font-bold text-gray-300">42%</span>
          </div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pt-14 md:pt-20 pb-16 text-center">
          {/* Trust badges */}
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-8 px-1">
            {['7-day free trial', 'Lifetime access ₹499', 'No bank linking'].map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 bg-18-surface/60 border border-18-border/60 rounded-full px-3 py-1 backdrop-blur-sm"
              >
                <Check size={12} className="text-18-orange" />
                {t}
              </span>
            ))}
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-8">
            <span className="text-white">Stop Wondering Where</span>
            <br />
            <span className="text-white">Your Money Goes: </span>
            <span className="hero-rotator text-18-orange italic inline-block align-baseline min-w-[4.5ch] md:min-w-[6ch] text-left">
              <span key={wordIdx}>{ROTATING_WORDS[wordIdx]}.</span>
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track your spending with voice notes, understand your habits, and
            take control of your money — in under 5 minutes a day.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/signup"
              className="hero-cta-pulse bg-18-orange text-white font-semibold text-base px-8 py-4 rounded-full hover:brightness-110 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              Start 7-day free trial
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="text-gray-300 font-semibold text-base px-6 py-4 hover:text-white transition-colors"
            >
              I already have an account
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-8">7-day free trial · Then ₹499 for lifetime access · No card required to start</p>
        </div>

        {/* ---------- PRODUCT PREVIEW MOCK (visual anchor) ---------- */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pb-20">
          <div className="relative">
            {/* Halo glow behind the mock */}
            <div
              className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-18-orange/25 via-fuchsia-500/10 to-transparent blur-2xl"
              aria-hidden
            />
            <div className="relative bg-18-surface border border-18-border rounded-[24px] p-4 md:p-6 shadow-2xl backdrop-blur-sm">
              {/* Fake top bar */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="bg-18-orange rounded-full h-6 w-6 flex items-center justify-center">
                    <span className="text-white font-bold text-[9px]">PFT</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-400">Dashboard</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-18-orange/10 border border-18-orange/30 rounded-full px-2.5 py-1">
                  <Flame size={12} className="text-18-orange" />
                  <span className="text-xs font-bold text-18-orange">7-day streak</span>
                </div>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
                {[
                  { label: 'Balance', value: '₹48,320', tone: 'text-white' },
                  { label: 'This month', value: '−₹12,480', tone: 'text-rose-400' },
                  { label: 'Saved', value: '₹6,200', tone: 'text-emerald-400' },
                ].map((k) => (
                  <div key={k.label} className="bg-18-bg/70 border border-18-border rounded-xl p-3 md:p-4">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5 font-semibold">{k.label}</p>
                    <p className={`text-sm md:text-xl font-bold tabular-nums whitespace-nowrap ${k.tone}`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart + list row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Donut chart mock */}
                <div className="bg-18-bg/70 border border-18-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Category breakdown</p>
                  <div className="flex items-center gap-4">
                    <svg viewBox="0 0 42 42" className="w-24 h-24 -rotate-90">
                      {[
                        { pct: 42, color: '#F37335', offset: 0 },
                        { pct: 28, color: '#FFF392', offset: 42 },
                        { pct: 18, color: '#A78BFA', offset: 70 },
                        { pct: 12, color: '#22D3EE', offset: 88 },
                      ].map((s, i) => (
                        <circle
                          key={i}
                          cx="21"
                          cy="21"
                          r="15.9155"
                          fill="transparent"
                          stroke={s.color}
                          strokeWidth="6"
                          strokeDasharray={`${s.pct} ${100 - s.pct}`}
                          strokeDashoffset={-s.offset}
                        />
                      ))}
                    </svg>
                    <div className="space-y-1.5 text-xs">
                      {[
                        { c: '#F37335', l: 'Rent', v: '42%' },
                        { c: '#FFF392', l: 'Food', v: '28%' },
                        { c: '#A78BFA', l: 'Travel', v: '18%' },
                        { c: '#22D3EE', l: 'Other', v: '12%' },
                      ].map((row) => (
                        <div key={row.l} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.c }} />
                          <span className="text-gray-400 w-14">{row.l}</span>
                          <span className="text-gray-300 font-semibold">{row.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recent transactions mock */}
                <div className="bg-18-bg/70 border border-18-border rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Latest activity</p>
                  <div className="space-y-2.5">
                    {[
                      { m: 'Zomato · Dinner', c: 'Food', a: '−₹480', neg: true },
                      { m: 'Salary · Aug', c: 'Income', a: '+₹85,000', neg: false },
                      { m: 'Uber · Airport', c: 'Travel', a: '−₹720', neg: true },
                    ].map((t) => (
                      <div key={t.m} className="flex items-center justify-between text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-white font-medium truncate">{t.m}</p>
                          <p className="text-gray-500 mt-0.5">{t.c}</p>
                        </div>
                        <span className={`font-bold tabular-nums ${t.neg ? 'text-rose-400' : 'text-emerald-400'}`}>{t.a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mt-4">Preview — actual dashboard from a demo account.</p>
        </div>
      </section>

      {/* ---------------------------- FEATURES ---------------------------- */}
      <section id="features" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="pointer-events-none absolute inset-0 bg-glow-soft" aria-hidden />
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-18-orange bg-18-orange/10 border border-18-orange/30 rounded-full px-3 py-1 mb-4">
              <Sparkles size={12} />
              Built for young professionals
            </span>
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white mb-4">
              Not another chart-heavy{' '}
              <span className="text-18-orange italic">budgeting app.</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              You earn well, but the month always ends broke. This isn&apos;t about
              budgeting — it&apos;s about seeing where the leaks are, so you can plug them.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Mic,
                title: 'Voice-based tracking',
                body: 'Speak your expense — "Paid 500 for groceries at DMart" — Personal FT parses it and files it in the right category.',
                gradient: 'from-amber-500 to-orange-600',
              },
              {
                icon: Eye,
                title: 'Spot the leaks',
                body: 'Category-wise analysis and monthly reports show your biggest lines, spikes, and subscriptions you forgot about.',
                gradient: 'from-purple-500 to-fuchsia-500',
              },
              {
                icon: Shield,
                title: 'Your data stays yours',
                body: 'No bank linking, no scraping, no data-selling. You own it. Export any time.',
                gradient: 'from-emerald-500 to-teal-500',
              },
              {
                icon: LineChart,
                title: 'Real-time reports',
                body: 'Get actionable feedback, category breakdown, and streaks — inputs that build better finance discipline.',
                gradient: 'from-cyan-500 to-blue-500',
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group bg-18-surface border border-18-border rounded-2xl p-6 hover:border-18-orange/50 hover:-translate-y-1 transition-all"
              >
                <div className={`bg-gradient-to-br ${f.gradient} w-12 h-12 rounded-xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="text-white" size={22} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------- BEFORE PFT vs AFTER PFT --------------------- */}
      <section className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-18-orange bg-18-orange/10 border border-18-orange/30 rounded-full px-3 py-1 mb-4">
              The shift
            </span>
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white mb-4">
              Before Personal FT{' '}
              <span className="text-18-orange italic">vs</span> after.
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              The everyday change once tracking becomes effortless.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Before column */}
            <div className="bg-18-surface/40 border border-18-border rounded-2xl p-6 md:p-8">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-gray-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Before</span>
              </div>
              <ul className="space-y-4">
                {[
                  'Guessing where your money went',
                  'Unnecessary spending',
                  'No financial tracking',
                  'Overspending without realizing',
                  'Forgetting small purchases',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <XIcon className="text-gray-600 mt-0.5 flex-shrink-0" size={16} />
                    <span className="text-gray-400 line-through decoration-gray-700">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After column */}
            <div className="relative bg-gradient-to-br from-18-orange/10 via-18-surface to-18-surface border border-18-orange/40 rounded-2xl p-6 md:p-8 shadow-[0_0_60px_-15px_rgba(243,115,53,0.35)]">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-2 h-2 rounded-full bg-18-orange" />
                <span className="text-xs font-bold uppercase tracking-wider text-18-orange">After Personal FT</span>
              </div>
              <ul className="space-y-4">
                {[
                  'Know exactly where every rupee goes',
                  'Reduce wasteful expenses',
                  'Track with voice notes',
                  'Stay on budget',
                  'Financial clarity & confidence',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check className="text-emerald-400 mt-0.5 flex-shrink-0" size={16} />
                    <span className="text-white">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- MOBILE PWA --------------------------- */}
      <section id="how" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="pointer-events-none absolute inset-0 bg-glow-soft" aria-hidden />
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-18-orange/10 border border-18-orange/30 rounded-full px-3 py-1 mb-4">
                <Smartphone size={14} className="text-18-orange" />
                <span className="text-xs font-bold uppercase tracking-wide text-18-orange">
                  Mobile-first
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                Add it to your home screen. Log in{' '}
                <span className="text-18-orange italic">one tap.</span>
              </h2>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Install Personal FT as a Progressive Web App and the icon lives
                on your phone&apos;s home screen. One tap opens Quick Add. No
                app store, no download nag, no permission theatre.
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-18-orange text-white font-semibold px-6 py-3 rounded-full hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]"
              >
                Get started
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Phone-frame mock around the 4-line entry */}
            <div className="flex justify-center">
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-[52px] bg-gradient-to-br from-18-orange/30 via-fuchsia-500/10 to-transparent blur-2xl"
                  aria-hidden
                />
                <div className="relative bg-18-bg border-[10px] border-neutral-900 rounded-[42px] shadow-2xl w-[280px] p-4">
                  {/* Notch */}
                  <div className="mx-auto h-4 w-24 bg-neutral-900 rounded-b-2xl -mt-4 mb-4" />
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Voice Add
                    </p>
                    <Flame size={14} className="text-18-orange" />
                  </div>

                  {/* Big pulsing mic — the voice interaction */}
                  <div className="flex flex-col items-center py-4 mb-3">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <span
                        className="absolute inset-0 rounded-full bg-18-orange/40 animate-ping"
                        aria-hidden
                      />
                      <div className="relative w-14 h-14 rounded-full bg-18-orange flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.7)]">
                        <Mic className="text-white" size={22} />
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-500 mt-3 uppercase tracking-[0.15em] font-bold">
                      You said
                    </p>
                    <p className="text-[11px] text-gray-300 italic text-center mt-1 px-2">
                      &ldquo;Paid 500 for groceries at DMart&rdquo;
                    </p>
                  </div>

                  {/* Parsed expense */}
                  <div className="font-mono text-xs bg-18-surface border border-18-border rounded-lg p-3 text-white mb-4 space-y-0.5">
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider font-bold not-italic mb-1">Parsed</div>
                    <div className="text-18-orange font-bold">500</div>
                    <div>Groceries at DMart</div>
                    <div className="text-gray-400">Food &amp; Groceries</div>
                    <div className="text-gray-400">HDFC</div>
                  </div>
                  <button className="w-full bg-18-orange text-white text-sm font-semibold py-2.5 rounded-lg">
                    Add expense
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-emerald-400 font-semibold mt-3">
                    <Check size={12} />
                    Instantly on your dashboard.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- HOW IT WORKS -------------------------- */}
      <section className="relative bg-18-bg py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-16 leading-tight">
            Three minutes to your{' '}
            <span className="text-18-orange italic">first insight</span>
          </h2>

          {/* Steps with a subtle horizontal line connecting them on desktop */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {/* Connector line — only shows on md+ */}
            <div
              className="hidden md:block absolute top-8 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-18-orange/40 to-transparent"
              aria-hidden
            />
            {[
              { n: '1', h: 'Sign up', b: 'Email + password. Or Google, one click. That’s it.', icon: Wallet },
              { n: '2', h: 'Add a bank', b: 'Just the name and opening balance. No connections, no scraping.', icon: Shield },
              { n: '3', h: 'Log your first spend', b: 'Four lines. Dashboard fills in. You start seeing patterns.', icon: TrendingUp },
            ].map((s) => (
              <div key={s.n} className="relative text-center">
                <div className="bg-18-orange/15 border border-18-orange/40 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_-8px_rgba(243,115,53,0.6)] relative z-10 backdrop-blur-sm">
                  <span className="text-2xl font-black text-18-orange">{s.n}</span>
                </div>
                <h3 className="font-bold text-white mb-2 text-lg">{s.h}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------- PRICING --------------------------- */}
      <section id="pricing" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="pointer-events-none absolute inset-0 bg-glow-soft" aria-hidden />
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-18-orange bg-18-orange/10 border border-18-orange/30 rounded-full px-3 py-1 mb-4">
              Simple pricing
            </span>
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white mb-4">
              One payment.{' '}
              <span className="text-18-orange italic">Lifetime access.</span>
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Try free for 7 days. If you love it, pay once — never again.
            </p>
          </div>

          {/* Pricing card */}
          <div className="relative">
            {/* Halo glow behind the card */}
            <div
              className="absolute -inset-4 rounded-[32px] bg-gradient-to-br from-18-orange/25 via-fuchsia-500/10 to-transparent blur-2xl"
              aria-hidden
            />
            <div className="relative bg-18-surface border border-18-orange/40 rounded-[24px] p-6 md:p-10 shadow-2xl">
              {/* Lifetime badge */}
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-18-orange bg-18-orange/15 border border-18-orange/40 rounded-full px-3 py-1">
                  <Sparkles size={12} />
                  Lifetime access
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
                  Save 90%
                </span>
              </div>

              {/* Price row */}
              <div className="flex items-baseline flex-wrap gap-3 mb-2">
                <span className="text-5xl md:text-6xl font-semibold text-white tabular-nums tracking-tight">₹499</span>
                <span className="text-2xl font-medium text-gray-500 line-through decoration-gray-600 tabular-nums">₹4,999</span>
              </div>
              <p className="text-sm text-gray-400 mb-8">
                One-time payment · Never a subscription
              </p>

              {/* Divider */}
              <div className="border-t border-18-border/60 mb-8" />

              {/* Feature checklist */}
              <ul className="space-y-3 mb-10">
                {[
                  '7-day free trial — full access, no card required',
                  'Voice-based expense tracking',
                  'Income & expense tracking',
                  'Budget planner & category-wise analysis',
                  'Monthly reports with personalised insights',
                  'Spending trends & budget vs actual',
                  'PWA — installs on your home screen',
                  'Data is yours — export or delete anytime',
                ].map((feat) => (
                  <li key={feat} className="flex items-start gap-3">
                    <Check className="text-emerald-400 mt-0.5 flex-shrink-0" size={16} />
                    <span className="text-sm text-gray-200">{feat}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href="/signup"
                className="w-full flex items-center justify-center gap-2 bg-18-orange text-white font-bold text-base px-8 py-4 rounded-full hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]"
              >
                Start your 7-day free trial
                <ArrowRight size={16} />
              </Link>
              <p className="text-xs text-center text-gray-500 mt-4">
                No credit card required to start. Cancel trial any time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------- FAQ ------------------------------ */}
      <section id="faq" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-4 leading-tight">
            Frequently asked{' '}
            <span className="text-18-orange italic">questions</span>
          </h2>
          <p className="text-center text-gray-400 mb-12">
            Quick answers to the things new users ask most.
          </p>
          <div className="space-y-3">
            {[
              {
                q: 'How much does Personal FT cost?',
                a: '₹499, paid once — that unlocks lifetime access. Regular price is ₹4,999 (90% launch discount). Start with a 7-day free trial; no card required. If it is not for you, walk away with nothing charged.',
              },
              {
                q: 'Do I need any finance knowledge to use this?',
                a: 'No. Personal FT is built for people who never learned "budgeting" — log what you spend, and the reports explain the rest.',
              },
              {
                q: 'How much time does it take daily?',
                a: 'Under 5 minutes. Voice-log a spend in seconds, glance at the dashboard once a day. That is the whole workflow.',
              },
              {
                q: 'Do I need to connect my bank account?',
                a: 'No. Personal FT never asks for bank credentials. You enter transactions with voice, quick-add, or a CSV import — that is the whole point of the privacy angle.',
              },
              {
                q: 'Is my data secure?',
                a: 'Yes. Data is stored per-user with row-level security, encrypted in transit, and you can export or delete everything from settings at any time.',
              },
              {
                q: 'Do I need Excel or any spreadsheets?',
                a: 'No. Personal FT replaces the spreadsheet — categories, reports, budgets, and monthly summaries are built in.',
              },
              {
                q: 'Can I use it on my phone?',
                a: 'Yes — installable as a PWA on both Android and iOS. Icon on home screen, one tap opens Quick Add. Feels like a native app.',
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group bg-18-surface border border-18-border rounded-xl px-5 py-4 open:border-18-orange/40 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <span className="font-semibold text-white pr-4">{item.q}</span>
                  <span className="text-18-orange text-2xl leading-none transform transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-sm text-gray-400 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- FINAL CTA --------------------------- */}
      <section className="relative py-24">
        <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Start making smarter money{' '}
            <span className="text-18-orange italic">decisions today.</span>
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Personal finance doesn&apos;t have to be complicated. Build better habits,
            understand your spending, and take control — in just 5 minutes each day.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-18-orange text-white font-bold text-base px-10 py-4 rounded-full hover:brightness-110 hover:-translate-y-0.5 transition-all shadow-[0_10px_50px_-5px_rgba(243,115,53,0.6)]"
          >
            Start your 7-day free trial
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-gray-500 mt-5">
            Then ₹499 for lifetime access. No card required to start.
          </p>
        </div>
      </section>

      {/* ------------------------------ FOOTER ----------------------------- */}
      <footer className="border-t border-18-border/30 bg-18-bg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="bg-18-orange rounded-full h-6 w-6 flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">PFT</span>
            </div>
            <span>Personal FT · Made for young professionals</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
