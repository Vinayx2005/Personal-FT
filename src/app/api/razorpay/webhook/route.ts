// POST /api/razorpay/webhook
// Razorpay-initiated callback for payment events. Fires reliably even when
// the browser's post-checkout `/verify` call fails (network drop, tab
// closed, phone died between success screen and callback) — which is the
// whole reason to wire this up.
//
// Setup in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://personal-ft-liard.vercel.app/api/razorpay/webhook
//   Secret: (anything random — save it to RAZORPAY_WEBHOOK_SECRET in Vercel)
//   Events: payment.captured  (primary — flips is_paid true)
//           payment.failed    (optional — logged for audit)
//
// Auth: HMAC-SHA256 signature over the RAW request body, comparing against
// the X-Razorpay-Signature header. Never trust the payload if the signature
// doesn't match — someone hitting this URL could otherwise mark random
// users paid.
//
// Idempotency: we upsert is_paid=true keyed on razorpay_payment_id. If the
// event fires multiple times (Razorpay retries) or after /verify already
// ran, subsequent calls are DB no-ops and skip the receipt email.

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { buildPaymentDone } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

interface RazorpayPaymentEntity {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  notes?: Record<string, string> | null;
}
interface RazorpayEvent {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
  };
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'RAZORPAY_WEBHOOK_SECRET not set' }, { status: 500 });
  }
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Must read the RAW body — the signature is computed over the exact bytes
  // Razorpay sent, and JSON.stringify(parsed) can produce different bytes
  // (whitespace, key order) that break verification.
  const rawBody = await req.text();

  const providedSig = req.headers.get('x-razorpay-signature') || '';
  const expectedSig = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

  // timingSafeEqual guards against timing side-channels; the length check
  // is required because it throws on unequal-length buffers.
  const providedBuf = Buffer.from(providedSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    console.warn('[razorpay/webhook] signature mismatch');
    return NextResponse.json({ error: 'Signature mismatch' }, { status: 400 });
  }

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;

  // Log-only for non-captured events so we can see them in Vercel logs
  // without doing anything to the DB.
  if (event.event !== 'payment.captured') {
    console.log(
      `[razorpay/webhook] non-capture event: ${event.event}`,
      payment ? { id: payment.id, status: payment.status } : {}
    );
    return NextResponse.json({ ok: true, event: event.event, action: 'logged' });
  }

  if (!payment?.id || !payment.order_id) {
    return NextResponse.json({ error: 'Malformed payment payload' }, { status: 400 });
  }

  // The user_id we stashed in the order's notes when creating it.
  const userId = payment.notes?.user_id;
  if (!userId) {
    console.warn(
      '[razorpay/webhook] no user_id in payment.notes',
      { paymentId: payment.id, orderId: payment.order_id }
    );
    return NextResponse.json(
      { error: 'user_id missing from order notes' },
      { status: 400 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Idempotency: only mark paid if the same payment id hasn't already been
  // recorded. If /verify beat the webhook, this becomes a no-op.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('is_paid, razorpay_payment_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.is_paid && existing.razorpay_payment_id === payment.id) {
    return NextResponse.json({
      ok: true,
      event: event.event,
      action: 'already_recorded',
      paymentId: payment.id,
    });
  }

  const { error: updErr } = await admin
    .from('subscriptions')
    .update({
      is_paid: true,
      paid_at: new Date().toISOString(),
      // Razorpay amounts are in paise — convert back to rupees for display.
      amount: Math.round(payment.amount / 100),
      razorpay_order_id: payment.order_id,
      razorpay_payment_id: payment.id,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  if (updErr) {
    console.error('[razorpay/webhook] subscription update failed:', updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Receipt email — fire-and-forget. Same behaviour as /verify: if Resend
  // is down, the customer is still paid; just log for admin follow-up.
  // Also skip if /verify already sent it (existing.is_paid true would have
  // caught that above, but be defensive).
  try {
    const { data: userRow } = await admin.auth.admin.getUserById(userId);
    const email = userRow?.user?.email;
    const firstName =
      (userRow?.user?.user_metadata?.full_name as string | undefined) ||
      (userRow?.user?.user_metadata?.name as string | undefined) ||
      null;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    if (email) {
      const tpl = buildPaymentDone({
        firstName,
        appUrl,
        amountInRupees: Math.round(payment.amount / 100),
        paymentId: payment.id,
        orderId: payment.order_id,
      });
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html });
    }
  } catch (mailErr) {
    console.warn('[razorpay/webhook] receipt email failed:', mailErr);
  }

  return NextResponse.json({
    ok: true,
    event: event.event,
    action: 'marked_paid',
    userId,
    paymentId: payment.id,
  });
}
