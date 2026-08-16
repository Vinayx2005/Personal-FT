export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

const iso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
};

// Trimmed to the six presets users actually reach for. Older keys
// (last_week / last_14 / last_30 / current_fy / last_fy) were removed
// per feedback that the picker was too crowded. The type intentionally
// keeps 'custom' as an option so users can still pick any arbitrary
// window from the two date inputs.
export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_month'
  | 'current_month'
  | 'custom';

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7: 'Last 7 days',
  last_month: 'Last month',
  current_month: 'This month',
  custom: 'Custom',
};

export const rangeFor = (preset: PresetKey, now: Date = new Date()): DateRange => {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { from: iso(today), to: iso(today) };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: iso(y), to: iso(y) };
    }
    case 'last_7':
      return { from: iso(addDays(today, -6)), to: iso(today) };
    case 'current_month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: iso(s), to: iso(e) };
    }
    case 'last_month': {
      const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const e = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case 'custom':
      return { from: iso(today), to: iso(today) };
  }
};

export const defaultRange = (): DateRange => rangeFor('current_month');

// Shift a DateRange one "period" earlier (dir = -1) or later (dir = +1),
// inferring the period from the shape of the range itself:
//   - single day (from == to)             → shift by 1 day
//   - full calendar month (1st → last)    → shift by 1 month
//   - Indian financial year (Apr 1→Mar 31)→ shift by 1 year
//   - anything else                        → shift by the range width in days
// Powers the prev/next chevrons around the Entries date-range picker so
// users can walk through "This month" → previous months, "Today" → yesterday,
// "Current FY" → last FY, "Last 30" → the 30 days before that, etc.
export const shiftRange = (range: DateRange, dir: -1 | 1): DateRange => {
  const parse = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  const from = parse(range.from);
  const to = parse(range.to);

  // Single day
  if (range.from === range.to) {
    const s = addDays(from, dir);
    return { from: iso(s), to: iso(s) };
  }

  // Full calendar month (from = 1st of month, to = last day of same month)
  const lastOfFromMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0);
  const isFullMonth =
    from.getDate() === 1 &&
    to.getFullYear() === from.getFullYear() &&
    to.getMonth() === from.getMonth() &&
    to.getDate() === lastOfFromMonth.getDate();
  if (isFullMonth) {
    const newStart = new Date(from.getFullYear(), from.getMonth() + dir, 1);
    const newEnd = new Date(from.getFullYear(), from.getMonth() + dir + 1, 0);
    return { from: iso(newStart), to: iso(newEnd) };
  }

  // Indian FY (Apr 1 of Y → Mar 31 of Y+1)
  const isFY =
    from.getMonth() === 3 &&
    from.getDate() === 1 &&
    to.getMonth() === 2 &&
    to.getDate() === 31 &&
    to.getFullYear() === from.getFullYear() + 1;
  if (isFY) {
    const newStart = new Date(from.getFullYear() + dir, 3, 1);
    const newEnd = new Date(from.getFullYear() + dir + 1, 2, 31);
    return { from: iso(newStart), to: iso(newEnd) };
  }

  // Fallback: shift by width. Width is inclusive of both endpoints.
  const widthDays =
    Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const newFrom = addDays(from, dir * widthDays);
  const newTo = addDays(newFrom, widthDays - 1);
  return { from: iso(newFrom), to: iso(newTo) };
};
