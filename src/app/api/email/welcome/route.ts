// POST /api/email/welcome
// Sends the welcome + trial-started email to the caller's account.
// Idempotent — if welcome_sent_at is already set, this is a no-op. Safe
// to call from anywhere (dashboard mount, signup form, OAuth callback).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildWelcome } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // The client passes an access token so we know WHO is asking. Auth token
  // comes from supabase.auth.getSession() on the browser side.
  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the token via admin — returns the user or null.
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  const user = userData.user;

  // Idempotency check — skip if we've already sent.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('welcome_sent_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (sub?.welcome_sent_at) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (!user.email) {
    return NextResponse.json({ error: 'User has no email' }, { status: 400 });
  }

  const firstName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  const { subject, html } = buildWelcome({ firstName, appUrl });
  const result = await sendEmail({ to: user.email, subject, html });
  if (!result.ok) {
    // Don't 500 — silently succeed so the client doesn't retry endlessly.
    console.warn('[email/welcome] send failed:', result.error);
    return NextResponse.json({ ok: false, error: result.error });
  }

  // Mark sent to prevent duplicates.
  await admin
    .from('subscriptions')
    .update({ welcome_sent_at: new Date().toISOString() })
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
