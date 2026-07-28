// POST /api/razorpay/verify
// Verifies Razorpay's HMAC signature on the checkout success payload,
// then marks the user paid in the subscriptions table (via service_role,
// bypassing RLS). Signature check is the ONLY thing that prevents a
// malicious client from marking themselves paid — do NOT skip it.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

interface VerifyBody {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  userId?: string;
}

export async function POST(req: NextRequest) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keySecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server payment/verify not configured' },
      { status: 500 }
    );
  }

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Recompute the HMAC-SHA256 signature exactly like Razorpay documents.
  const expected = createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
  }

  // Signature is valid — mark the user paid. Uses service_role so the RLS
  // policies (which only allow SELECT for the user) don't block us.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin
    .from('subscriptions')
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      amount: 499,
      razorpay_order_id,
      razorpay_payment_id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
