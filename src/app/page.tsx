'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Star, Zap, Eye, Shield, Smartphone, LineChart, ArrowRight, Check } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard');
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-18-bg text-white font-poppins overflow-x-hidden">
      {/* Nav */}
      <header className="relative z-20 max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-18-orange rounded-full h-8 w-8 flex items-center justify-center shadow-[0_0_30px_rgba(243,115,53,0.5)]">
            <span className="text-white font-bold text-xs">PFT</span>
          </div>
          <span className="font-bold text-white text-lg">Personal FT</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#why" className="text-sm text-gray-300 hover:text-white transition-colors">Why it matters</a>
          <a href="#features" className="text-sm text-gray-300 hover:text-white transition-colors">Features</a>
          <a href="#how" className="text-sm text-gray-300 hover:text-white transition-colors">How it works</a>
          <a href="#faq" className="text-sm text-gray-300 hover:text-white transition-colors">FAQ</a>
        </nav>
        <Link
          href="/signup"
          className="bg-white text-18-bg font-semibold text-sm px-5 py-2 rounded-full hover:bg-gray-100 transition-all flex items-center gap-1"
        >
          Start free
          <ArrowRight size={14} />
        </Link>
      </header>

      {/* Hero — with radial orange glow */}
      <section className="relative">
        {/* Glow layer */}
        <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-20 text-center">
          {/* Rating pill */}
          <div className="inline-flex items-center gap-2 mb-8">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-sm text-gray-300 font-medium">4.8 · Built by users, for users</span>
          </div>

          {/* Big italic hero */}
          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-8">
            <span className="text-18-orange italic">Know</span>{' '}
            <span className="text-white">where</span>
            <br />
            <span className="text-white">your money </span>
            <span className="text-18-orange italic">goes.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            The dead-simple finance tracker for young professionals who want to
            see their spending leaks — without giving anyone their bank credentials.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link
              href="/signup"
              className="bg-18-orange text-white font-semibold text-base px-8 py-4 rounded-full hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]"
            >
              Reserve your free seat
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="text-gray-300 font-semibold text-base px-6 py-4 hover:text-white transition-colors"
            >
              I already have an account
            </Link>
          </div>
          <p className="text-xs text-gray-500 mt-8">30 seconds a day. That&apos;s all it takes.</p>
        </div>
      </section>

      {/* Why funnels matter section (stats) */}
      <section id="why" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="pointer-events-none absolute inset-0 bg-glow-soft" aria-hidden />
        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            {/* Testimonial-style avatars */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <div className="flex -space-x-2">
                {['from-orange-400 to-pink-500', 'from-purple-400 to-indigo-500', 'from-green-400 to-teal-500', 'from-yellow-400 to-orange-500', 'from-blue-400 to-purple-500'].map((g, i) => (
                  <div key={i} className={`h-8 w-8 rounded-full bg-gradient-to-br ${g} border-2 border-18-bg`} />
                ))}
              </div>
              <div>
                <div className="flex gap-0.5 justify-start">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={12} className="fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Loved by early users</p>
              </div>
            </div>

            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white mb-4">
              Why tracking matters{' '}
              <span className="text-18-orange italic">more than ever</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              You earn well, but the month always ends broke. This isn&apos;t about
              budgeting — it&apos;s about seeing where the leaks actually are, so
              you can plug them.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 mt-8 bg-18-orange text-white font-semibold px-6 py-3 rounded-full hover:brightness-110 transition-all shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]"
            >
              Start free — no card
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 mt-16 pt-12 border-t border-18-border/30">
            {[
              { n: '4-line', l: 'entry format — amount, description, category, bank. That&#39;s it.' },
              { n: '<30 sec', l: 'to log an expense from your home screen' },
              { n: '0', l: 'bank credentials asked. Ever.' },
              { n: 'Free', l: 'forever tier. Pay only if you want the extras.' },
            ].map((s, i) => (
              <div key={i} className="text-center md:text-left">
                <div className="text-5xl md:text-6xl font-black text-gray-700 mb-3">{s.n}</div>
                <p className="text-sm text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.l }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you'll get section */}
      <section id="features" className="relative bg-18-bg py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black leading-tight text-white mb-4">
              What you&apos;ll{' '}
              <span className="text-18-orange italic">get</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Not another chart-heavy budgeting app. Just the tools you need to
              see, understand, and adjust your money habits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Zap,
                title: 'Quick Add',
                body: 'Four lines, one tap from your home screen. Log an expense faster than you can order chai.',
              },
              {
                icon: Eye,
                title: 'Spot the leaks',
                body: 'Weekly recaps show your biggest categories, unusual spikes, and subscriptions you forgot about.',
              },
              {
                icon: Shield,
                title: 'Your data stays yours',
                body: 'No bank linking, no scraping, no data-selling. You own it. Export any time.',
              },
              {
                icon: LineChart,
                title: 'Real dashboards',
                body: 'Monthly P&L, category breakdown, streaks. All the visibility, none of the guilt.',
              },
            ].map((f, i) => (
              <div key={i} className="bg-18-surface border border-18-border rounded-2xl p-6 hover:border-18-orange/50 transition-colors">
                <div className="bg-18-orange/10 border border-18-orange/30 w-11 h-11 rounded-xl flex items-center justify-center mb-5">
                  <f.icon className="text-18-orange" size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile PWA highlight */}
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
                className="inline-flex items-center gap-2 bg-18-orange text-white font-semibold px-6 py-3 rounded-full hover:brightness-110 transition-all shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]"
              >
                Get started
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="bg-18-surface border border-18-border rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <div className="h-2 w-2 rounded-full bg-green-500" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                Quick add — 4-line format
              </p>
              <div className="font-mono text-sm bg-18-bg border border-18-border rounded-lg p-4 text-white mb-4">
                <div>500</div>
                <div>Groceries at DMart</div>
                <div>Food &amp; Groceries</div>
                <div>HDFC</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-green-400 font-semibold">
                <Check size={14} />
                Instantly on your dashboard.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three-step how-it-works */}
      <section className="relative bg-18-bg py-24">
        <div className="max-w-5xl mx-auto px-4 md:px-8">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-16 leading-tight">
            Three minutes to your{' '}
            <span className="text-18-orange italic">first insight</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { n: '1', h: 'Sign up', b: 'Email + password. Or Google, one click. That&#39;s it.' },
              { n: '2', h: 'Add a bank', b: 'Just the name and opening balance. No connections, no scraping.' },
              { n: '3', h: 'Log your first spend', b: 'Four lines. Dashboard fills in. You start seeing patterns.' },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="bg-18-orange/15 border border-18-orange/40 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_-8px_rgba(243,115,53,0.5)]">
                  <span className="text-2xl font-black text-18-orange">{s.n}</span>
                </div>
                <h3 className="font-bold text-white mb-2 text-lg">{s.h}</h3>
                <p className="text-sm text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: s.b }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative bg-18-bg py-24 border-t border-18-border/30">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-4 leading-tight">
            Frequently asked{' '}
            <span className="text-18-orange italic">questions</span>
          </h2>
          <p className="text-center text-gray-400 mb-12">
            Quick answers. If yours isn&apos;t here,{' '}
            <a href="mailto:hi@personalft.app" className="text-18-orange hover:underline">
              email me
            </a>
            .
          </p>
          <div className="space-y-3">
            {[
              {
                q: 'Do I need to connect my bank account?',
                a: 'No. Personal FT never asks for bank credentials. You enter your transactions manually or via CSV — that’s the whole point of the privacy angle.',
              },
              {
                q: 'Is it really free?',
                a: 'Yes, the core tracker is free forever. Paid tier (coming soon) will add power-user features like SMS auto-parse and monthly recap emails.',
              },
              {
                q: 'Can I use it on my phone?',
                a: 'Yes — installable as a PWA on both Android and iOS. Icon on home screen, one tap opens Quick Add. Feels like a native app.',
              },
              {
                q: 'What happens to my data if I stop using it?',
                a: 'You own it. Export any time from settings. Delete account nukes everything — clean exit, no dark patterns.',
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

      {/* Final CTA */}
      <section className="relative py-24">
        <div className="pointer-events-none absolute inset-0 bg-glow-hero" aria-hidden />
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
            Ready to see where your{' '}
            <span className="text-18-orange italic">money goes?</span>
          </h2>
          <p className="text-lg text-gray-300 mb-8">
            Free forever. No credit card. No bank linking.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-18-orange text-white font-bold text-base px-10 py-4 rounded-full hover:brightness-110 transition-all shadow-[0_10px_50px_-5px_rgba(243,115,53,0.6)]"
          >
            Create your free account
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
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
