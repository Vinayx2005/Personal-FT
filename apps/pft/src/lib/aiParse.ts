// Client-side parser wrapper. Calls the /api/parse-expense route (Gemini)
// and returns the same ParsedVoice shape as the regex parser. If the API
// is disabled (no GEMINI_API_KEY on the server → 501), errors, or takes
// too long, it falls back to the local regex parser so voice input keeps
// working end-to-end.

import { supabase } from './supabase';
import { parseVoiceInput, ParsedVoice } from './voiceParse';
import { formatDateISO } from './utils';

const AI_TIMEOUT_MS = 6_000; // Gemini 2.5 Flash is usually under 2s.

export async function parseExpense(
  transcript: string,
  banks: string[],
  categories: string[]
): Promise<ParsedVoice & { source: 'gemini' | 'regex' }> {
  // Try Gemini first via our server route.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) throw new Error('no session');

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);

    // Pass the browser's local timezone offset so the server anchors "today"
    // in the user's calendar instead of UTC.
    const tzOffsetMin = -new Date().getTimezoneOffset(); // JS returns minutes-behind-UTC; flip to minutes-ahead

    const res = await fetch('/api/parse-expense', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'X-TZ-Offset-Min': String(tzOffsetMin),
      },
      body: JSON.stringify({ transcript, banks, categories }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      // Log Gemini's own detail (model-not-found, quota, etc.) so devs can
      // debug from browser devtools. The catch block below falls back to
      // the regex parser, so the user still gets a preview card — they
      // never see a scary technical error for TEXT sends.
      const b = await res.json().catch(() => ({}));
      const detail = typeof b?.detail === 'string' ? ` — ${b.detail.slice(0, 200)}` : '';
      throw new Error(`${b?.error || 'api'} ${res.status}${detail}`);
    }
    const body = await res.json();

    // Recompute missing fields locally: Gemini's list is advisory, but the
    // client's Confirm-Save gate needs a canonical list to disable the
    // button on. Keep this in sync with the same check in the /quick page.
    const missing: string[] = [];
    if (body.amount === null || typeof body.amount !== 'number' || body.amount <= 0) missing.push('amount');
    if (!body.category) missing.push('category');
    if (!body.bank) missing.push('bank');

    return {
      amount: body.amount,
      description: body.description || '',
      category: body.category,
      bank: body.bank,
      date: body.date || formatDateISO(new Date()),
      transcript,
      missing,
      source: 'gemini',
    };
  } catch (err) {
    // Fall through to the local regex parser. This is the ONLY safety net —
    // voice input must never appear to hang because the AI backend is down.
    if (typeof console !== 'undefined') {
      console.warn('[aiParse] falling back to regex parser:', (err as Error)?.message || err);
    }
    const parsed = parseVoiceInput(transcript, banks, categories);
    return { ...parsed, source: 'regex' };
  }
}
