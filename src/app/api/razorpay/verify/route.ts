// POST /api/razorpay/verify
// Verifies Razorpay's HMAC signature on the checkout success payload,
// then marks the user paid in the subscriptions table (via service_role,
// bypassing RLS). Signature check is the ONLY thing that prevents a
// malicious client from marking themselves paid — do NOT skip it.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { buildPaymentDone } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

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

  // Fire-and-forget receipt email. Never block the payment success on this —
  // if Resend is misconfigured or down, the user is still paid and can log
  // in normally. Errors just get logged for admin follow-up.
  try {
    const { data: userRow } = await admin.auth.admin.getUserById(userId);
    const email = userRow?.user?.email;
    const firstName =
      (userRow?.user?.user_metadata?.full_name as string | undefined) ||
      (userRow?.user?.user_metadata?.name as string | undefined) ||
      null;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    if (email) {
      const tpl = buildPaymentDone({
        firstName,
        appUrl,
        amountInRupees: 499,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
    }
  } catch (mailErr) {
    console.warn('[razorpay/verify] receipt email failed:', mailErr);
  }

  return NextResponse.json({ ok: true });
}
