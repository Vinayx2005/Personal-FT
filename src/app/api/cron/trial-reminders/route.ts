// GET /api/cron/trial-reminders
// Called once a day by Vercel Cron. Finds users whose trial expires in
// ~3 / ~2 / ~1 days, sends the matching reminder, and stamps the DB so
// tomorrow's run doesn't re-send. Auth via CRON_SECRET Bearer token so
// random public callers can't trigger sends.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  build3DayReminder,
  build2DayReminder,
  build1DayReminder,
} from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/send';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  user_id: string;
  trial_ends_at: string;
  reminder_3d_sent_at: string | null;
  reminder_2d_sent_at: string | null;
  reminder_1d_sent_at: string | null;
}

export async function GET(req: NextRequest) {
  // Auth — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. If it's
  // missing or wrong, refuse. Also allow a `?secret=` query param for local
  // manual testing.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') || '';
  const querySecret = new URL(req.url).searchParams.get('secret') || '';
  if (auth !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Grab everyone still on trial whose window is <= 3 days from expiring.
  // Cheap query — subscriptions is small.
  const now = Date.now();
  const in4Days = new Date(now + 4 * DAY_MS).toISOString();
  const { data: subs, error: fetchErr } = await admin
    .from('subscriptions')
    .select('user_id, trial_ends_at, reminder_3d_sent_at, reminder_2d_sent_at, reminder_1d_sent_at')
    .eq('is_paid', false)
    .lte('trial_ends_at', in4Days)
    .gt('trial_ends_at', new Date(now).toISOString());
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const results: Array<{ userId: string; sent: string | null; error?: string }> = [];

  for (const sub of (subs as Row[] | null) || []) {
    const msLeft = new Date(sub.trial_ends_at).getTime() - now;
    // Use ceil so "36 hours left" → 2 days, "12 hours left" → 1 day
    // (matches how the in-app banner shows it).
    const daysLeft = Math.ceil(msLeft / DAY_MS);

    let templateKey: '3d' | '2d' | '1d' | null = null;
    if (daysLeft === 3 && !sub.reminder_3d_sent_at) templateKey = '3d';
    else if (daysLeft === 2 && !sub.reminder_2d_sent_at) templateKey = '2d';
    else if (daysLeft === 1 && !sub.reminder_1d_sent_at) templateKey = '1d';

    if (!templateKey) {
      results.push({ userId: sub.user_id, sent: null });
      continue;
    }

    // Look up the user's email + name via admin API.
    const { data: userData } = await admin.auth.admin.getUserById(sub.user_id);
    const user = userData?.user;
    if (!user?.email) {
      results.push({ userId: sub.user_id, sent: null, error: 'no email on user' });
      continue;
    }
    const firstName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      null;

    const tpl =
      templateKey === '3d' ? build3DayReminder({ firstName, appUrl })
      : templateKey === '2d' ? build2DayReminder({ firstName, appUrl })
      : build1DayReminder({ firstName, appUrl });

    const send = await sendEmail({ to: user.email, subject: tpl.subject, html: tpl.html });
    if (!send.ok) {
      results.push({ userId: sub.user_id, sent: null, error: send.error });
      continue;
    }
    const stampField =
      templateKey === '3d' ? 'reminder_3d_sent_at'
      : templateKey === '2d' ? 'reminder_2d_sent_at'
      : 'reminder_1d_sent_at';
    await admin
      .from('subscriptions')
      .update({ [stampField]: new Date().toISOString() })
      .eq('user_id', sub.user_id);
    results.push({ userId: sub.user_id, sent: templateKey });
  }

  return NextResponse.json({ ok: true, results });
}
