// Heuristic parser for the "I paid X for Y from Z bank yesterday" style
// spoken sentences. Not AI — regex + keyword lookup — good enough for the
// common case. Anything ambiguous is left null so the user can fill it in
// before saving. Tuned for Indian English + Hinglish:
//   - rupees / rupaya / rs / ₹ / inr, paise / paisa
//   - Hindi numerics: sau (×100), hazaar (×1000), lakh (×100000)
//   - Hindi digit words: ek do teen chaar paanch chhe saat aath nau das
//   - Date words: today/yesterday/day before yesterday, aaj/kal/parso,
//     "N days ago/back", "last Saturday", "on Monday", "15/12", "15 Dec"

import { formatDateISO } from './utils';

export interface ParsedVoice {
  amount: number | null;
  description: string;
  category: string | null; // matched category name (as it exists in the DB)
  bank: string | null; // matched bank name (as it exists in the DB)
  date: string; // ISO YYYY-MM-DD in user's local timezone
  transcript: string;
  missing: string[]; // human-readable list of what we couldn't extract
}

// Loose keyword → category-name-hint map. Used only when none of the user's
// own categories appear verbatim in the transcript. The value should match
// (case-insensitively) one of the user's actual categories to be useful — if
// none does, we fall through to null.
const CATEGORY_HINTS: Record<string, string[]> = {
  Food: [
    'food', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'restaurant',
    'zomato', 'swiggy', 'pizza', 'burger', 'noodles', 'chai', 'coffee',
    'grocery', 'groceries', 'vegetables', 'sabzi', 'fruits',
  ],
  Transport: [
    'uber', 'ola', 'cab', 'auto', 'rickshaw', 'petrol', 'diesel', 'fuel',
    'metro', 'bus', 'train', 'taxi', 'ride', 'rapido',
  ],
  Rent: ['rent', 'kiraya'],
  Utilities: [
    'electricity', 'bijli', 'water bill', 'gas', 'internet', 'wifi',
    'phone bill', 'mobile recharge', 'broadband', 'utility',
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'shopping', 'clothes', 'kapde',
    'apparel', 'shoes',
  ],
  Healthcare: [
    'medicine', 'davai', 'doctor', 'hospital', 'pharmacy', 'medical',
  ],
  Entertainment: [
    'movie', 'film', 'netflix', 'hotstar', 'spotify', 'game', 'concert',
    'ticket',
  ],
  Travel: [
    'flight', 'hotel', 'trip', 'travel', 'booking', 'irctc',
  ],
  Subscriptions: ['subscription', 'renewal', 'membership'],
};

// Hindi digit words (1–10). Enough to compose with sau/hazaar/lakh.
const HINDI_DIGITS: Record<string, number> = {
  ek: 1,
  do: 2, dou: 2,
  teen: 3, tin: 3,
  char: 4, chaar: 4,
  panch: 5, paanch: 5, pach: 5,
  che: 6, chhe: 6, chhah: 6, chah: 6,
  saat: 7, sat: 7,
  aath: 8, aat: 8,
  nau: 9,
  das: 10,
};

// Replace Indian numeric expressions with plain digits BEFORE running the
// money regexes. Examples this handles:
//   "paanch sau"    → "500"
//   "5 hazaar"      → "5000"
//   "do lakh"       → "200000"
//   "2 crore"       → "20000000"
//   "5k"            → "5000"    (some voice engines emit '5 k')
//   "sau"           → "100" (lone)
function normalizeNumbers(text: string): string {
  const digitOrWord = '(\\d+(?:\\.\\d+)?|ek|do|dou|teen|tin|char|chaar|panch|paanch|pach|che|chhe|chhah|chah|saat|sat|aath|aat|nau|das)';
  const toN = (raw: string) => HINDI_DIGITS[raw.toLowerCase()] ?? parseFloat(raw);

  let out = text;

  // Compound: <N> crore
  out = out.replace(new RegExp(`\\b${digitOrWord}\\s+(crores?|karod)\\b`, 'gi'),
    (_, n) => {
      const v = toN(n);
      return isNaN(v) ? _ : String(v * 10000000);
    });

  // Compound: <N> lakh
  out = out.replace(new RegExp(`\\b${digitOrWord}\\s+(lakhs?|laakh)\\b`, 'gi'),
    (_, n) => {
      const v = toN(n);
      return isNaN(v) ? _ : String(v * 100000);
    });

  // Compound: <N> thousand / hazaar / k
  out = out.replace(new RegExp(`\\b${digitOrWord}\\s+(thousand|hazaar|hazar|k)\\b`, 'gi'),
    (_, n) => {
      const v = toN(n);
      return isNaN(v) ? _ : String(v * 1000);
    });

  // Compound: <N> hundred / sau
  out = out.replace(new RegExp(`\\b${digitOrWord}\\s+(hundred|sau)\\b`, 'gi'),
    (_, n) => {
      const v = toN(n);
      return isNaN(v) ? _ : String(v * 100);
    });

  // Lone multipliers
  out = out.replace(/\b(sau|hundred)\b/gi, '100');
  out = out.replace(/\b(hazaar|hazar|thousand)\b/gi, '1000');
  out = out.replace(/\b(lakh|laakh)\b/gi, '100000');
  out = out.replace(/\b(crore|karod)\b/gi, '10000000');

  return out;
}

// ---------- Date parsing ----------

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDateISO(d);
}

// Most recent past occurrence of the given weekday (0=Sun..6=Sat).
// If today IS that weekday, returns 7 days ago (i.e. "last Saturday" said on
// Saturday means the previous Saturday, not today).
function pastWeekday(target: number): string {
  const d = new Date();
  const today = d.getDay();
  let diff = today - target;
  if (diff <= 0) diff += 7;
  d.setDate(d.getDate() - diff);
  return formatDateISO(d);
}

function parseDate(text: string): string | null {
  // Order matters — more specific patterns first.

  if (/\b(day before yesterday|parson|parso)\b/i.test(text)) return dateOffset(-2);
  if (/\byesterday\b/i.test(text) || /\bkal\b/i.test(text))   return dateOffset(-1);
  if (/\btoday\b/i.test(text) || /\baaj\b/i.test(text) || /\bnow\b/i.test(text)) return dateOffset(0);

  // "N days ago" / "N days back" / "N din pehle"
  const nDaysAgo = text.match(/\b(\d+)\s+(days?|din)\s+(ago|back|pehle|pahle)\b/i);
  if (nDaysAgo) {
    const n = parseInt(nDaysAgo[1], 10);
    if (!isNaN(n) && n >= 0 && n <= 365) return dateOffset(-n);
  }

  // "last Saturday", "past Monday"
  const lastWk = text.match(/\b(last|past|pichhle|pichle)\s+([a-z]+)\b/i);
  if (lastWk) {
    const w = WEEKDAYS[lastWk[2].toLowerCase()];
    if (w !== undefined) return pastWeekday(w);
  }

  // "on Saturday" / "Saturday" as a bare weekday reference — most recent past
  const bareWk = text.match(/\b(on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
  if (bareWk) {
    const w = WEEKDAYS[bareWk[2].toLowerCase()];
    if (w !== undefined) return pastWeekday(w);
  }

  // "15 Dec" / "15th December" / "Dec 15" / "15 Dec 2025"
  const dm = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})(?:\s+(\d{2,4}))?\b/i);
  if (dm) {
    const day = parseInt(dm[1], 10);
    const mon = MONTHS[dm[2].toLowerCase()];
    if (mon && day >= 1 && day <= 31) {
      let year = dm[3] ? parseInt(dm[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, mon - 1, day);
      // If the date they said hasn't happened yet this year, assume previous year
      // (people log spend in the past, not the future).
      if (!dm[3] && d > new Date()) d.setFullYear(year - 1);
      return formatDateISO(d);
    }
  }
  const md = text.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{2,4}))?\b/i);
  if (md) {
    const mon = MONTHS[md[1].toLowerCase()];
    const day = parseInt(md[2], 10);
    if (mon && day >= 1 && day <= 31) {
      let year = md[3] ? parseInt(md[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, mon - 1, day);
      if (!md[3] && d > new Date()) d.setFullYear(year - 1);
      return formatDateISO(d);
    }
  }

  // Numeric: 15/12, 15-12, 15/12/2025, 15-12-25 (day/month order — Indian convention)
  const numeric = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
  if (numeric) {
    const day = parseInt(numeric[1], 10);
    const mon = parseInt(numeric[2], 10);
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      let year = numeric[3] ? parseInt(numeric[3], 10) : new Date().getFullYear();
      if (year < 100) year += 2000;
      const d = new Date(year, mon - 1, day);
      if (!numeric[3] && d > new Date()) d.setFullYear(year - 1);
      return formatDateISO(d);
    }
  }

  return null;
}

// ---------- Amount parsing ----------

function parseAmount(text: string): number | null {
  const cleanNumber = (raw: string) =>
    parseFloat(raw.replace(/,/g, '').replace(/^0+(?=\d)/, ''));

  // "N rupees M paise" combined — treat as N.MM
  const combo = text.match(
    /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees?|rupaye?|rupya|rupaiya|rs\.?|₹|inr)\s*(?:aur\s*|and\s*)?(\d{1,2})\s*(?:paise?|paisa)\b/i
  );
  if (combo) {
    const rupees = cleanNumber(combo[1]);
    const paise = parseInt(combo[2], 10);
    if (!isNaN(rupees) && !isNaN(paise)) return rupees + paise / 100;
  }

  // "N paise" / "N paisa" alone → N/100 rupees
  const paiseOnly = text.match(/\b(\d+)\s*(?:paise?|paisa)\b/i);
  if (paiseOnly) {
    const p = parseInt(paiseOnly[1], 10);
    if (!isNaN(p) && p > 0) return p / 100;
  }

  // Explicit money markers
  const withMarker =
    text.match(/(?:rs\.?|rupees?|rupaye?|rupya|rupaiya|inr|₹)\s*([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)/i) ||
    text.match(/([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\s*(?:rs\.?|rupees?|rupaye?|rupya|rupaiya|inr|₹)/i) ||
    text.match(/\b(?:paid|spent|kharcha|kharch|diya|denge|for|of|costs?|cost)\s+([0-9]+(?:,[0-9]+)*(?:\.[0-9]+)?)\b/i);
  if (withMarker) {
    const n = cleanNumber(withMarker[1]);
    if (!isNaN(n) && n > 0) return n;
  }

  // Last resort: FIRST standalone number in the text, but only if it's clearly
  // not a date/time (avoid "12/03" or "at 12"). We already normalized Hindi
  // words to digits, so a bare integer here is likely the amount if nothing
  // more specific matched.
  const bare = text.match(/\b([0-9]{2,}(?:\.[0-9]+)?)\b/); // require 2+ digits (skip "5 minutes" etc.)
  if (bare) {
    const n = cleanNumber(bare[1]);
    if (!isNaN(n) && n > 0 && n < 100000000) return n;
  }

  return null;
}

// ---------- Main entry ----------

export function parseVoiceInput(
  transcript: string,
  banks: string[],
  categories: string[]
): ParsedVoice {
  const raw = transcript.trim().replace(/\s+/g, ' ');
  // Normalize Hindi numeric words FIRST so downstream regexes see digits.
  const normalized = normalizeNumbers(raw);
  const text = normalized.toLowerCase();
  const missing: string[] = [];

  // ---------- amount ----------
  const amount = parseAmount(text);
  if (amount === null || isNaN(amount) || amount <= 0) missing.push('amount');

  // ---------- date ----------
  const parsedDate = parseDate(text);
  const date = parsedDate ?? dateOffset(0);

  // ---------- bank ----------
  let bank: string | null = null;
  const bankLookup = banks
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((b) => b && text.includes(b.toLowerCase()));
  if (bankLookup) {
    bank = bankLookup;
  } else {
    const m = text.match(/(?:from\s+)?([a-z]{2,15})\s+bank\b/);
    if (m) {
      const hit = banks.find((b) => b.toLowerCase().includes(m[1]));
      bank = hit || m[1].toUpperCase();
    }
  }
  if (!bank) missing.push('bank');

  // ---------- category ----------
  let category: string | null = null;
  const catLookup = categories
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((c) => c && text.includes(c.toLowerCase()));
  if (catLookup) {
    category = catLookup;
  } else {
    for (const [hintCat, kws] of Object.entries(CATEGORY_HINTS)) {
      if (kws.some((k) => text.includes(k))) {
        const userCat = categories.find(
          (c) => c && c.toLowerCase() === hintCat.toLowerCase()
        );
        category = userCat || hintCat;
        break;
      }
    }
  }
  if (!category) missing.push('category');

  // ---------- description ----------
  let description = '';
  const descMatch = normalized.match(
    /\b(?:for|on|ke\s+liye)\s+(.+?)(?:\s+from\s+|\s+at\s+|\s+in\s+|\s+today\b|\s+yesterday\b|\s+aaj\b|\s+kal\b|\s+parso\b|\s+last\s+|\s+on\s+(?:mon|tue|wed|thu|fri|sat|sun)|$)/i
  );
  if (descMatch) {
    description = descMatch[1].trim();
  } else if (category) {
    description = category;
  } else {
    description = raw
      .replace(/^i\s+(paid|spent)\s+/i, '')
      .replace(/^(paid|spent)\s+/i, '')
      .trim();
  }
  description = description
    .replace(/\s+bank\s*$/i, '')
    .replace(/\s+(today|yesterday|now|aaj|kal|parso|parson)\s*$/i, '')
    .replace(/\brs\.?\b/gi, '')
    .replace(/\brupees?\b/gi, '')
    .replace(/\brupaya?e?\b/gi, '')
    .replace(/\brupaiya\b/gi, '')
    .replace(/\binr\b/gi, '')
    .replace(/\bpaise?\b/gi, '')
    .replace(/\bpaisa\b/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return { amount, description, category, bank, date, transcript: raw, missing };
}

// Build the 4-line format the /quick textarea expects. Date lives in a
// separate input on the page, so it isn't part of the returned lines.
// Blank slots let the user fill them in before submitting.
export function toQuickAddText(p: ParsedVoice): string {
  return [
    p.amount !== null ? String(p.amount) : '',
    p.description || '',
    p.category || '',
    p.bank || '',
  ].join('\n');
}
