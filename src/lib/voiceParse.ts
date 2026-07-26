// Heuristic parser for the "I paid X for Y from Z bank" style
// spoken sentences. Not AI — regex + keyword lookup — good enough for the
// common case. Anything ambiguous is left null so the user can fill it in
// before saving.

export interface ParsedVoice {
  amount: number | null;
  description: string;
  category: string | null; // matched category name (as it exists in the DB)
  bank: string | null; // matched bank name (as it exists in the DB)
  date: 'today' | 'yesterday';
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
    'grocery', 'groceries', 'vegetables', 'fruits',
  ],
  Transport: [
    'uber', 'ola', 'cab', 'auto', 'rickshaw', 'petrol', 'diesel', 'fuel',
    'metro', 'bus', 'train', 'taxi', 'ride',
  ],
  Rent: ['rent'],
  Utilities: [
    'electricity', 'water bill', 'gas', 'internet', 'wifi', 'phone bill',
    'mobile recharge', 'broadband', 'utility',
  ],
  Shopping: ['amazon', 'flipkart', 'shopping', 'clothes', 'apparel', 'shoes'],
  Healthcare: ['medicine', 'doctor', 'hospital', 'pharmacy', 'medical'],
  Entertainment: [
    'movie', 'netflix', 'spotify', 'game', 'concert', 'ticket',
  ],
  Travel: ['flight', 'hotel', 'trip', 'travel', 'booking'],
  Subscriptions: ['subscription', 'renewal', 'membership'],
};

export function parseVoiceInput(
  transcript: string,
  banks: string[],
  categories: string[]
): ParsedVoice {
  const raw = transcript.trim().replace(/\s+/g, ' ');
  const text = raw.toLowerCase();
  const missing: string[] = [];

  // ---------- amount ----------
  // Prefer numbers explicitly next to rupees/rs/inr.
  // Fallback: first 2–7 digit number in the sentence.
  const moneyMatch =
    text.match(/(?:rs\.?|rupees?|inr)\s*(\d+(?:[.,]\d+)?)/) ||
    text.match(/(\d+(?:[.,]\d+)?)\s*(?:rs\.?|rupees?|inr)/) ||
    text.match(/\b(\d{2,7}(?:[.,]\d+)?)\b/);
  const amount = moneyMatch ? parseFloat(moneyMatch[1].replace(/,/g, '')) : null;
  if (amount === null || isNaN(amount) || amount <= 0) missing.push('amount');

  // ---------- bank ----------
  // Match one of the user's actual banks first (case-insensitive contains).
  let bank: string | null = null;
  const bankLookup = banks
    .slice()
    .sort((a, b) => b.length - a.length) // longer names first to avoid partial hits
    .find((b) => b && text.includes(b.toLowerCase()));
  if (bankLookup) {
    bank = bankLookup;
  } else {
    // "from X bank" or "X bank" as a soft hint
    const m = text.match(/(?:from\s+)?([a-z]{2,15})\s+bank\b/);
    if (m) {
      // If any known bank contains this hint, prefer that
      const hit = banks.find((b) => b.toLowerCase().includes(m[1]));
      bank = hit || m[1].toUpperCase();
    }
  }
  if (!bank) missing.push('bank');

  // ---------- category ----------
  // First try: any user category appearing verbatim in transcript.
  let category: string | null = null;
  const catLookup = categories
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((c) => c && text.includes(c.toLowerCase()));
  if (catLookup) {
    category = catLookup;
  } else {
    // Second try: match a keyword hint → try to map to a user category
    for (const [hintCat, kws] of Object.entries(CATEGORY_HINTS)) {
      if (kws.some((k) => text.includes(k))) {
        // Case-insensitive match against user's categories for the hint
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
  // Best: the noun phrase after "for" / "on" and before the location/date words.
  let description = '';
  const descMatch = raw.match(
    /\b(?:for|on)\s+(.+?)(?:\s+from\s+|\s+at\s+|\s+in\s+|\s+today\b|\s+yesterday\b|$)/i
  );
  if (descMatch) {
    description = descMatch[1].trim();
  } else if (category) {
    description = category;
  } else {
    description = raw.replace(/^i\s+paid\s+/i, '').replace(/^paid\s+/i, '').trim();
  }
  description = description
    .replace(/\s+bank\s*$/i, '')
    .replace(/\s+(today|yesterday|now)\s*$/i, '')
    .replace(/\brs\.?\b/gi, '')
    .replace(/\brupees?\b/gi, '')
    .replace(/\binr\b/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Sentence-case
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // ---------- date ----------
  let date: 'today' | 'yesterday' = 'today';
  if (/\byesterday\b/.test(text)) date = 'yesterday';

  return { amount, description, category, bank, date, transcript: raw, missing };
}

// Build the 4-line format the /quick textarea expects.
// Blank slots let the user fill them in before submitting.
export function toQuickAddText(p: ParsedVoice): string {
  return [
    p.amount !== null ? String(p.amount) : '',
    p.description || '',
    p.category || '',
    p.bank || '',
  ].join('\n');
}
