import { supabase } from './supabase';

export interface SubscriptionStatus {
  isPaid: boolean;
  trialEndsAt: Date | null;
  daysLeft: number | null; // rounded down; 0 on the last day; negative when expired
  isExpired: boolean;      // trial has ended AND not paid
  loading: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Fetch subscription for the current user. Returns nulls if not logged in
// or if the subscriptions row doesn't exist yet (migration not run).
export async function fetchSubscription(): Promise<SubscriptionStatus> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { isPaid: false, trialEndsAt: null, daysLeft: null, isExpired: false, loading: false };
  }
  const { data, error } = await supabase
    .from('subscriptions')
    .select('is_paid, trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) {
    // Migration missing OR RLS issue — treat as "trial active" so the app
    // stays usable. Payment features become inert until admin fixes DB.
    return { isPaid: false, trialEndsAt: null, daysLeft: null, isExpired: false, loading: false };
  }
  const isPaid = !!data.is_paid;
  const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
  let daysLeft: number | null = null;
  let isExpired = false;
  if (trialEndsAt) {
    const ms = trialEndsAt.getTime() - Date.now();
    // Round UP so "12 hours left" shows as 1 day, matching user intuition.
    daysLeft = Math.ceil(ms / DAY_MS);
    isExpired = !isPaid && ms <= 0;
  }
  return { isPaid, trialEndsAt, daysLeft, isExpired, loading: false };
}
