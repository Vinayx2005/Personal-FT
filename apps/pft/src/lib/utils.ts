export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

// User-facing display: dd-mm-yyyy.
// Accepts a YYYY-MM-DD string (what we store in Postgres) or a Date object.
// For a YYYY-MM-DD input we parse without a time zone shift so a stored
// "2026-07-08" always renders as "08-07-2026" regardless of the viewer's TZ.
export const formatDate = (date: string | Date): string => {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, d] = date.slice(0, 10).split('-');
    return `${d}-${m}-${y}`;
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Parse a "YYYY-MM-DD" string as a LOCAL midnight Date. `new Date(raw)` treats
// the string as UTC and shifts by the viewer's offset — mis-filing dates near
// month/day boundaries for anyone outside UTC.
export const parseLocalDate = (raw: string): Date => {
  const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// DB-safe format: YYYY-MM-DD. Use for anything written to a Postgres date column.
export const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Accepts a user-supplied date string in either dd-mm-yyyy, dd/mm/yyyy, or
// YYYY-MM-DD (the two separators — hyphen and slash — cover Google Sheets exports
// and typed input). Returns a YYYY-MM-DD string for DB use, or null if it can't
// be parsed. Rejects nonsense like 32-13-2026 by round-tripping through Date.
export const parseUserDate = (raw: unknown): string | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Already YYYY-MM-DD → validate and pass through.
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    const dt = new Date(`${y}-${mo}-${d}T00:00:00Z`);
    if (isNaN(dt.getTime())) return null;
    if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() + 1 !== +mo || dt.getUTCDate() !== +d) return null;
    return `${y}-${mo}-${d}`;
  }

  // dd-mm-yyyy or dd/mm/yyyy → normalise.
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    const dt = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (isNaN(dt.getTime())) return null;
    if (dt.getUTCFullYear() !== +yyyy || dt.getUTCMonth() + 1 !== +mm || dt.getUTCDate() !== +dd) return null;
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
};

export const getCurrentFinancialYear = (): {
  start: Date;
  end: Date;
  label: string;
} => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let startYear = currentYear;
  let endYear = currentYear;

  if (currentMonth < 3) {
    // Jan, Feb, Mar - previous FY
    startYear = currentYear - 1;
    endYear = currentYear;
  } else {
    // Apr onwards - current FY
    startYear = currentYear;
    endYear = currentYear + 1;
  }

  return {
    start: new Date(startYear, 3, 1), // April 1
    end: new Date(endYear, 2, 31), // March 31
    label: `${startYear}-${String(endYear).slice(-2)}`,
  };
};

export const getFinancialMonthStart = (): Date => {
  const today = new Date();
  const currentMonth = today.getMonth();

  if (currentMonth >= 3) {
    // Apr onwards - current year
    return new Date(today.getFullYear(), 3, 1);
  } else {
    // Jan-Mar - previous year
    return new Date(today.getFullYear() - 1, 3, 1);
  }
};

// RFC-4180-ish parser: handles quoted fields, embedded commas, escaped quotes ("")
const parseCSVLine = (line: string): string[] => {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
};

// Split a CSV string into logical rows. A logical row can span multiple
// physical lines when a value contains a newline inside a quoted field —
// Excel and Google Sheets emit these routinely (e.g. addresses, multi-line
// descriptions). Newlines OUTSIDE quotes are row separators; newlines INSIDE
// quotes stay in the value.
const splitCSVRows = (csv: string): string[] => {
  const src = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"') {
      // Preserve doubled quotes literally so parseCSVLine handles them
      if (inQuotes && src[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      cur += ch;
    } else if (ch === '\n' && !inQuotes) {
      if (cur.trim().length > 0) rows.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length > 0) rows.push(cur);
  return rows;
};

export const parseCSV = (csv: string): Record<string, string>[] => {
  const rows = splitCSVRows(csv);
  if (rows.length < 2) return [];
  const headers = parseCSVLine(rows[0]).map((h) => h.toLowerCase());
  return rows.slice(1).map((row) => {
    const values = parseCSVLine(row);
    const out: Record<string, string> = {};
    headers.forEach((h, i) => (out[h] = values[i] ?? ''));
    return out;
  });
};

export const calculatePnL = (
  revenue: number,
  expenses: number
): { profit: number } => {
  return { profit: revenue - expenses };
};

export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validateAmount = (amount: any): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return (value * 100).toFixed(decimals) + '%';
};

// Group items by YYYY-MM key derived from a date field; newest month first.
export function groupByMonth<T>(
  items: T[],
  getDate: (item: T) => string
): { key: string; label: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const raw = getDate(item);
    if (!raw) continue;
    // The raw value is a YYYY-MM-DD string from a Postgres date column.
    // Slicing the string keeps the intended calendar date — parsing via
    // `new Date(raw)` treats it as UTC midnight and shifts by the viewer's
    // offset, mis-filing month-boundary transactions in any TZ != UTC.
    const key = raw.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      return { key, label, items: list };
    });
}
