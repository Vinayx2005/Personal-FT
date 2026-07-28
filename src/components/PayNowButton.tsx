'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Razorpay's checkout script attaches this global.
declare global {
  interface Window {
    Razorpay?: new (opts: RazorpayOptions) => { open: () => void };
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (r: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

const loadRazorpayScript = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_SCRIPT;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
};

interface Props {
  onPaid?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export default function PayNowButton({ onPaid, className, children }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      // 1. Load Razorpay checkout script on demand.
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) throw new Error('Razorpay checkout failed to load. Check your internet.');

      // 2. Ask our server to create an order.
      const orderRes = await fetch('/api/razorpay/create-order', { method: 'POST' });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Could not create order');

      // 3. Get the current user's id + email for prefill + verify.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to pay');

      // 4. Launch the checkout modal.
      const rzp = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: 'Personal FT',
        description: 'Lifetime access',
        prefill: { email: user.email || undefined },
        theme: { color: '#F37335' },
        handler: async (r) => {
          // 5. Verify the signature server-side, then mark paid.
          try {
            const vRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: r.razorpay_order_id,
                razorpay_payment_id: r.razorpay_payment_id,
                razorpay_signature: r.razorpay_signature,
                userId: user.id,
              }),
            });
            const vData = await vRes.json();
            if (!vRes.ok) throw new Error(vData.error || 'Verification failed');
            onPaid?.();
          } catch (err: any) {
            setError(err?.message || 'Payment verification failed. Contact support.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err: any) {
      setError(err?.message || 'Unable to start payment');
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className={
          className ||
          'w-full inline-flex items-center justify-center gap-2 bg-18-orange text-white font-bold text-base px-8 py-4 rounded-full hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_10px_40px_-5px_rgba(243,115,53,0.5)]'
        }
      >
        {loading ? 'Opening checkout…' : (children ?? 'Pay ₹499 for lifetime access')}
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
      )}
    </div>
  );
}
