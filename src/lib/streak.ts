import { supabase } from './supabase';

// Turn a Date into a YYYY-MM-DD string in the local timezone.
// Using local timezone is deliberate: a user who logs at 11pm and again at
// 1am next day should be treated as two consecutive days in their local view,
// not one long "day" in UTC.
const localDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Count consecutive days ending today where the user has at least one row
// in `transactions` (by created_at). Gap = streak broken. Today missing = 0.
export const calculateStreak = (createdAts: string[]): number => {
  if (!createdAts.length) return 0;
  const daySet = new Set(createdAts.map((s) => localDayKey(new Date(s))));

  let streak = 0;
  const cursor = new Date();
  while (daySet.has(localDayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

// Convenience: fetch the last ~35 days of created_at values for the current
// user and compute their streak. Returns 0 if the user has no activity.
export const fetchCurrentStreak = async (): Promise<number> => {
  const since = new Date();
  since.setDate(since.getDate() - 35);
  const { data, error } = await supabase
    .from('transactions')
    .select('created_at')
    .gte('created_at', since.toISOString());
  if (error) {
    console.error('fetchCurrentStreak failed:', error.message);
    return 0;
  }
  return calculateStreak((data || []).map((r: any) => r.created_at));
};
