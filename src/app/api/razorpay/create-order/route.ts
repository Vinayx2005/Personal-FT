// POST /api/razorpay/create-order
// Creates a Razorpay Order via their REST API and returns the order_id +
// public key so the client can launch checkout. All price/currency logic
// lives here so a compromised client can't ask for a discount.
//
// Auth: requires a Supabase Bearer JWT. The signed-in user's id is
// embedded in the order's `notes` field so /api/razorpay/webhook can
// later resolve payment.captured events back to the paying user (needed
// when the browser callback never fires).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const AMOUNT_INR_PAISE = 49900; // Rs 499.00
const CURRENCY = 'INR';

export async function POST(req: NextRequest) {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: 'Razorpay is not configured on the server' },
      { status: 500 }
    );
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Auth — need to know WHO is paying so the webhook can identify them.
  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const userId = userData.user.id;

  try {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: AMOUNT_INR_PAISE,
        currency: CURRENCY,
        receipt: `pft_${Date.now()}`,
        // Razorpay round-trips notes onto every payment event, so
        // /api/razorpay/webhook can read notes.user_id off the
        // payment.captured payload and flip is_paid=true for the right user.
        notes: { product: 'Personal FT lifetime access', user_id: userId },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: 'Razorpay order creation failed', detail: text },
        { status: 502 }
      );
    }
    const order = await res.json();
    return NextResponse.json({
      orderId: order.id,
      amount: AMOUNT_INR_PAISE,
      currency: CURRENCY,
      keyId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
