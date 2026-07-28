// POST /api/razorpay/create-order
// Creates a Razorpay Order via their REST API and returns the order_id +
// public key so the client can launch checkout. All price/currency logic
// lives here so a compromised client can't ask for a discount.

import { NextResponse } from 'next/server';

const AMOUNT_INR_PAISE = 49900; // Rs 499.00
const CURRENCY = 'INR';

export async function POST() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: 'Razorpay is not configured on the server' },
      { status: 500 }
    );
  }

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
        notes: { product: 'Personal FT lifetime access' },
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
