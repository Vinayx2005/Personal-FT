'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import PayNowButton from './PayNowButton';
import { fetchSubscription, SubscriptionStatus } from '@/lib/subscription';

// Once dismissed within a session, the soft banner stays hidden until
// the next day. Keyed per-user so switching accounts refreshes it.
const bannerDismissKey = (userIdHint: string | null, dateStr: string) =>
  `pft_trial_banner_dismissed_${userIdHint || 'anon'}_${dateStr}`;

const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function SubscriptionGate() {
  const [status, setStatus] = useState<SubscriptionStatus>({
    isPaid: false,
    trialEndsAt: null,
    daysLeft: null,
    isExpired: false,
    loading: true,
  });
  const [bannerHidden, setBannerHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSubscription().then((s) => {
      if (cancelled) return;
      setStatus(s);
      // Restore dismissal for today so we don't re-nag on every page nav.
      if (typeof window !== 'undefined' && s.trialEndsAt) {
        const uidHint = s.trialEndsAt.toISOString(); // uniqueish per user's trial
        const key = bannerDismissKey(uidHint, todayLocalISO());
        if (localStorage.getItem(key) === 'yes') setBannerHidden(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => fetchSubscription().then(setStatus);

  const dismissBanner = () => {
    setBannerHidden(true);
    if (typeof window !== 'undefined' && status.trialEndsAt) {
      const key = bannerDismissKey(status.trialEndsAt.toISOString(), todayLocalISO());
      localStorage.setItem(key, 'yes');
    }
  };

  if (status.loading || status.isPaid) return null;

  // ---- HARD PAYWALL — trial expired, must pay to continue ----
  if (status.isExpired) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-18-surface border border-18-orange/50 rounded-2xl max-w-md w-full p-6 md:p-8 shadow-[0_20px_80px_-10px_rgba(243,115,53,0.5)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-18-orange/20 border border-18-orange/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="text-18-orange" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Your trial has ended</h2>
              <p className="text-xs text-white/50 mt-0.5">Unlock lifetime access to continue</p>
            </div>
          </div>

          <div className="bg-18-bg/60 border border-18-border rounded-xl p-4 mb-5">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold text-white tabular-nums">₹499</span>
              <span className="text-sm font-medium text-gray-500 line-through">₹4,999</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                Save 90%
              </span>
            </div>
            <p className="text-xs text-white/60 mt-2">One-time payment · Lifetime access · No renewals</p>
          </div>

          <ul className="text-sm text-white/70 space-y-2 mb-6 list-disc pl-5">
            <li>Every category, budget, and report you set up stays yours</li>
            <li>Unlimited transactions, voice logging, PDF exports</li>
            <li>Future updates included at no extra cost</li>
          </ul>

          <PayNowButton onPaid={refresh}>Pay ₹499 &amp; unlock forever</PayNowButton>
          <p className="text-[11px] text-white/40 mt-3 text-center">
            Secure checkout by Razorpay. UPI, cards, netbanking supported.
          </p>
        </div>
      </div>
    );
  }

  // ---- SOFT BANNER — last 3 days of trial (4th day = 3 left, ...) ----
  if (
    !bannerHidden &&
    status.daysLeft !== null &&
    status.daysLeft > 0 &&
    status.daysLeft <= 3
  ) {
    const label =
      status.daysLeft === 1 ? '1 day left' : `${status.daysLeft} days left`;
    return (
      <div className="fixed bottom-24 md:bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-40">
        <div className="bg-18-surface border border-18-orange/50 rounded-2xl p-4 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)]">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-18-orange/15 border border-18-orange/40 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-18-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">
                Trial: <span className="text-18-orange">{label}</span>
              </p>
              <p className="text-xs text-white/60 mt-0.5">
                Lock in lifetime access for a one-time ₹499.
              </p>
            </div>
            <button
              onClick={dismissBanner}
              className="text-white/40 hover:text-white p-1"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mt-3">
            <PayNowButton
              onPaid={refresh}
              className="w-full inline-flex items-center justify-center gap-2 bg-18-orange text-white font-bold text-sm px-4 py-2.5 rounded-full hover:brightness-110 disabled:opacity-50 transition-all"
            >
              Pay ₹499 now
            </PayNowButton>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
