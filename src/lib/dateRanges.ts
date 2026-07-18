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

// Indian financial year: Apr 1 → Mar 31
export const financialYearFor = (d: Date): { start: Date; end: Date; label: string } => {
  const m = d.getMonth();
  const y = d.getFullYear();
  const startYear = m < 3 ? y - 1 : y;
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31),
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
  };
};

export type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last_7'
  | 'last_week'
  | 'last_14'
  | 'last_30'
  | 'last_month'
  | 'current_month'
  | 'current_fy'
  | 'last_fy'
  | 'custom';

export const PRESET_LABELS: Record<PresetKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7: 'Last 7 days',
  last_week: 'Last week',
  last_14: 'Last 14 days',
  last_30: 'Last 30 days',
  last_month: 'Last month',
  current_month: 'This month',
  current_fy: 'Current FY',
  last_fy: 'Last FY',
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
    case 'last_week': {
      // Previous Mon–Sun
      const dow = today.getDay(); // 0 = Sun, 1 = Mon
      const daysSinceMon = (dow + 6) % 7;
      const thisMon = addDays(today, -daysSinceMon);
      const lastMon = addDays(thisMon, -7);
      const lastSun = addDays(lastMon, 6);
      return { from: iso(lastMon), to: iso(lastSun) };
    }
    case 'last_14':
      return { from: iso(addDays(today, -13)), to: iso(today) };
    case 'last_30':
      return { from: iso(addDays(today, -29)), to: iso(today) };
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
    case 'current_fy': {
      const fy = financialYearFor(today);
      return { from: iso(fy.start), to: iso(fy.end) };
    }
    case 'last_fy': {
      const prev = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      const fy = financialYearFor(prev);
      return { from: iso(fy.start), to: iso(fy.end) };
    }
    case 'custom':
      return { from: iso(today), to: iso(today) };
  }
};

export const defaultRange = (): DateRange => rangeFor('current_month');
