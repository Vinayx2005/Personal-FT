// GET /api/cron/sip-debit
// Runs once a day via Vercel Cron. Finds every active SIP whose
// next_debit_date has arrived, inserts an expense transaction from the
// source bank, optionally increments the linked investment's total value,
// and rolls next_debit_date forward by the frequency.
//
// Auth via CRON_SECRET Bearer (or `?secret=` query param for manual runs).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SipRow {
  id: number;
  user_id: string;
  investment_id: number | null;
  name: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'quarterly';
  debit_day: number;
  source_bank_id: number;
  category_id: number | null;
  start_date: string;
  end_date: string | null;
  next_debit_date: string;
}

/** Return YYYY-MM-DD in the server's local calendar. */
function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Given today's debit date + frequency + debit_day, return the ISO YYYY-MM-DD
 * of the next debit. For monthly/quarterly, clamp the day to the last day of
 * the target month so debit_day=31 doesn't skip February. For weekly, advance
 * by 7 days from the current debit date.
 */
function computeNextDebitDate(
  currentDebitIso: string,
  frequency: SipRow['frequency'],
  debitDay: number
): string {
  const cur = new Date(currentDebitIso + 'T00:00:00');
  const next = new Date(cur);
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    const monthStep = frequency === 'monthly' ? 1 : 3;
    // Jump to the first of the target month, then clamp debit_day to that
    // month's length.
    next.setDate(1);
    next.setMonth(next.getMonth() + monthStep);
    const daysInMonth = new Date(
      next.getFullYear(),
      next.getMonth() + 1,
      0
    ).getDate();
    next.setDate(Math.min(debitDay, daysInMonth));
  }
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET(req: NextRequest) {
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

  const today = todayIso();

  // Pull every SIP whose next_debit_date is today or overdue. Overdue rows
  // catch up one cycle per cron run — if the cron missed a day, tomorrow's
  // run picks it up.
  const { data: sips, error: fetchErr } = await admin
    .from('sips')
    .select(
      'id, user_id, investment_id, name, amount, frequency, debit_day, source_bank_id, category_id, start_date, end_date, next_debit_date'
    )
    .eq('is_active', true)
    .lte('next_debit_date', today)
    .or(`end_date.is.null,end_date.gte.${today}`);
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const results: Array<{
    sipId: number;
    debited: boolean;
    transactionId?: number;
    error?: string;
  }> = [];

  for (const sip of (sips as SipRow[] | null) || []) {
    try {
      // 1. Insert the expense transaction on the SIP's due date (not today —
      // if we're catching up an overdue SIP, we honour the original schedule).
      const { data: tx, error: txErr } = await admin
        .from('transactions')
        .insert({
          transaction_type: 'expense',
          bank_id: sip.source_bank_id,
          category_id: sip.category_id,
          description: sip.name,
          amount: sip.amount,
          transaction_date: sip.next_debit_date,
          notes: 'via SIP auto-debit',
          status: 'posted',
          created_by: sip.user_id,
        })
        .select('id')
        .single();
      if (txErr) throw txErr;

      // 2. If linked to an investment, bump its running total.
      if (sip.investment_id) {
        // Read current amount → add → write. Race-safe enough for a personal
        // app; not a hot path.
        const { data: invRow } = await admin
          .from('investments')
          .select('amount')
          .eq('id', sip.investment_id)
          .single();
        const current = Number(invRow?.amount || 0);
        await admin
          .from('investments')
          .update({
            amount: current + Number(sip.amount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sip.investment_id);
      }

      // 3. Roll next_debit_date forward and stamp last_debited_at.
      const newNext = computeNextDebitDate(
        sip.next_debit_date,
        sip.frequency,
        sip.debit_day
      );
      await admin
        .from('sips')
        .update({
          next_debit_date: newNext,
          last_debited_at: new Date().toISOString(),
        })
        .eq('id', sip.id);

      results.push({ sipId: sip.id, debited: true, transactionId: tx?.id });
    } catch (err: any) {
      results.push({ sipId: sip.id, debited: false, error: err.message });
    }
  }

  return NextResponse.json({ ok: true, ran_on: today, results });
}
