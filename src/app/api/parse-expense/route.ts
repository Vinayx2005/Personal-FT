// POST /api/parse-expense
// Takes a user's spoken/typed expense sentence + their actual banks +
// their actual expense categories, calls Gemini to turn it into structured
// JSON, and returns the parsed fields. Auth-gated so this can't be abused
// to burn the free-tier quota anonymously.
//
// Body:  { transcript: string, banks: string[], categories: string[] }
// Reply: { amount, description, category, bank, date, missing }
//
// Falls back to a 502 when Gemini errors — the client-side helper then
// re-runs the local regex parser, so voice input degrades gracefully.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// gemini-flash-latest = stable alias to whatever flash model Google is
// currently supporting. See audio route for details + how to override.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are an expense parser for an Indian personal-finance app.
Given a user's spoken or typed message, extract:
  amount:      number in rupees (understand Indian numerics: "sau"=100, "hazaar"=1000, "lakh"=100000, "crore"=10000000; "do hazaar"=2000, "paanch sau"=500; paise as decimals like 99.50)
  description: short natural phrase for what it was
  category:    MUST equal one of the user's provided categories (case-insensitive), OR a reasonable NEW name if none fit
  bank:        MUST equal one of the user's provided banks (case-insensitive contains match), OR null if unclear
  date:        ISO YYYY-MM-DD in the user's local calendar. Understand: today/aaj, yesterday/kal, day before yesterday/parso, "N days ago", "last Monday", "on Saturday", "15 Dec", "15/12/2025"
  missing:     array of field names ("amount", "category", "bank") that you could NOT extract confidently

Return ONLY the JSON object matching the schema. No commentary, no markdown.`;

interface ParseBody {
  transcript?: string;
  banks?: string[];
  categories?: string[];
}

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    // Signals to the client-side helper to fall back to the regex parser.
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 501 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Auth — verify the caller's JWT so anonymous callers can't burn quota.
  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ParseBody;
  const transcript = (body.transcript || '').trim();
  const banks = Array.isArray(body.banks) ? body.banks.filter(Boolean) : [];
  const categories = Array.isArray(body.categories) ? body.categories.filter(Boolean) : [];
  if (!transcript) {
    return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
  }

  // Today in the caller's timezone. The client couldn't compute this here so
  // pass the offset via a header — falls back to IST (+05:30) which is right
  // for the vast majority of this app's audience.
  const tzOffsetMin = parseInt(req.headers.get('x-tz-offset-min') || '', 10);
  const offsetMinutes = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 330;
  const localNow = new Date(Date.now() + offsetMinutes * 60_000);
  const todayIso = localNow.toISOString().slice(0, 10);

  const userPrompt = `Today is ${todayIso}.
User's banks: ${banks.length ? banks.join(', ') : '(none set up)'}
User's expense categories: ${categories.length ? categories.join(', ') : '(none yet — you may invent a name)'}

Message: """${transcript}"""`;

  const geminiBody = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      // Force structured JSON out — no need to strip markdown fences or hope.
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          description: { type: 'string' },
          category: { type: 'string', nullable: true },
          bank: { type: 'string', nullable: true },
          date: { type: 'string' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['amount', 'description', 'date', 'missing'],
      },
      temperature: 0.1,
    },
  };

  let geminiRes: Response;
  try {
    geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Gemini network error', detail: err?.message }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => '');
    return NextResponse.json(
      { error: `Gemini ${geminiRes.status}`, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = await geminiRes.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ error: 'Empty Gemini response', raw: data }, { status: 502 });
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Non-JSON Gemini response', raw: text.slice(0, 500) }, { status: 502 });
  }

  // Basic sanity: coerce and clamp fields to the shape the client expects.
  // The client-side helper still runs its own missing-fields recomputation on
  // top of this, so we don't need to be paranoid.
  const clean = {
    amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : null,
    bank: typeof parsed.bank === 'string' && parsed.bank.trim() ? parsed.bank.trim() : null,
    date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayIso,
    missing: Array.isArray(parsed.missing) ? parsed.missing.filter((m: any) => typeof m === 'string') : [],
  };

  return NextResponse.json({ ok: true, source: 'gemini', ...clean });
}
