// POST /api/parse-expense/audio
// Multipart upload of a voice-note audio blob (whatever MediaRecorder gave
// us — webm/opus on Chrome/Firefox, mp4/aac on Safari). We base64-encode
// the bytes into Gemini's `inlineData` and let the model transcribe +
// extract expense fields in a single call.
//
// Fields expected in the multipart body:
//   audio       — the Blob from MediaRecorder
//   banks       — JSON-stringified string[]  (user's bank names for matching)
//   categories  — JSON-stringified string[]  (user's expense categories)
//
// Reply: same shape as the text route — { amount, description, category,
// bank, date, missing } plus a `transcript` field so the client can show
// what Gemini heard (useful for debugging odd parses).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// gemini-flash-latest is Google's stable alias that always points to the
// currently-supported flash model — no code change needed when they
// deprecate a version. Override with GEMINI_MODEL env var if you want to
// pin a specific one (e.g. "gemini-2.5-flash"). Hit /api/gemini-models to
// see what's actually available on your key.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are an expense parser for an Indian personal-finance app.
You will receive an audio recording of a user speaking (English or Hinglish).
Transcribe it, then extract:
  transcript:  the raw transcription of the audio (natural sentence)
  amount:      number in rupees. Understand Indian numerics: "sau"=100, "hazaar"=1000, "lakh"=100000, "crore"=10000000; "do hazaar"=2000, "paanch sau"=500. Handle paise as decimals like 99.50.
  description: short natural phrase for what it was
  category:    MUST equal one of the user's provided categories (case-insensitive), OR a reasonable NEW name if none fit
  bank:        MUST equal one of the user's provided banks (case-insensitive contains match), OR null if unclear
  date:        ISO YYYY-MM-DD in the user's local calendar. Understand: today/aaj, yesterday/kal, day before yesterday/parso, "N days ago", "last Monday", "on Saturday", "15 Dec", "15/12/2025"
  missing:     array of field names ("amount", "category", "bank") you could NOT extract confidently

Return ONLY the JSON object matching the schema. No commentary, no markdown.`;

export const runtime = 'nodejs';
export const maxDuration = 30; // Gemini audio can take 5-15s on a long clip.

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 501 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Auth
  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch (err: any) {
    return NextResponse.json({ error: 'Bad multipart body', detail: err?.message }, { status: 400 });
  }

  const audio = form.get('audio');
  // FormData.get returns FormDataEntryValue = File | string | null. In
  // Next.js's runtime, File is available globally; we check via `typeof`
  // rather than `instanceof File` so we don't need a DOM lib reference.
  if (!audio || typeof audio === 'string') {
    return NextResponse.json({ error: 'Missing audio field' }, { status: 400 });
  }
  const audioBlob = audio as Blob;
  // Cap at 15 MB so we don't blow up the Vercel function memory on a
  // pathologically long recording (~2 hours of opus). Gemini's inline_data
  // cap is 20 MB.
  if (audioBlob.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: 'Audio too large — keep it under a few minutes' }, { status: 413 });
  }

  const banksRaw = (form.get('banks') as string) || '[]';
  const categoriesRaw = (form.get('categories') as string) || '[]';
  let banks: string[] = [];
  let categories: string[] = [];
  try {
    banks = JSON.parse(banksRaw).filter((s: any) => typeof s === 'string');
    categories = JSON.parse(categoriesRaw).filter((s: any) => typeof s === 'string');
  } catch {
    return NextResponse.json({ error: 'banks/categories must be JSON string arrays' }, { status: 400 });
  }

  // Today in caller's local timezone (offset passed as a header).
  const tzOffsetMin = parseInt(req.headers.get('x-tz-offset-min') || '', 10);
  const offsetMinutes = Number.isFinite(tzOffsetMin) ? tzOffsetMin : 330; // IST default
  const localNow = new Date(Date.now() + offsetMinutes * 60_000);
  const todayIso = localNow.toISOString().slice(0, 10);

  // Base64 the audio for inline_data.
  const arrayBuf = await audioBlob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  // Strip codec parameters ("audio/webm;codecs=opus" → "audio/webm") — some
  // Gemini regions reject the parameterised form.
  const containerType = (audioBlob.type || 'audio/webm').split(';')[0].trim();
  // Gemini's officially supported audio types are wav / mp3 / aac / ogg /
  // aiff / flac. It does NOT accept "audio/mp4" as a container label even
  // though the AAC bytes inside are exactly what audio/aac would carry.
  // Safari (both desktop and iOS Safari + the installed PWA) records into
  // audio/mp4 by default — so without this relabel, every voice note from
  // an iPhone gets rejected with a cryptic Gemini 400. Same bytes, right
  // label, works.
  const mimeType =
    containerType === 'audio/mp4' || containerType === 'audio/x-m4a'
      ? 'audio/aac'
      : containerType || 'audio/webm';

  const userPrompt = `Today is ${todayIso}.
User's banks: ${banks.length ? banks.join(', ') : '(none set up)'}
User's expense categories: ${categories.length ? categories.join(', ') : '(none yet — you may invent a name)'}

Listen to the attached audio and return the parsed expense JSON.`;

  const geminiBody = {
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          amount: { type: 'number' },
          description: { type: 'string' },
          category: { type: 'string', nullable: true },
          bank: { type: 'string', nullable: true },
          date: { type: 'string' },
          missing: { type: 'array', items: { type: 'string' } },
        },
        required: ['transcript', 'amount', 'description', 'date', 'missing'],
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

  const clean = {
    transcript: typeof parsed.transcript === 'string' ? parsed.transcript.trim() : '',
    amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
    description: typeof parsed.description === 'string' ? parsed.description.trim() : '',
    category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : null,
    bank: typeof parsed.bank === 'string' && parsed.bank.trim() ? parsed.bank.trim() : null,
    date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayIso,
    missing: Array.isArray(parsed.missing) ? parsed.missing.filter((m: any) => typeof m === 'string') : [],
  };

  return NextResponse.json({ ok: true, source: 'gemini-audio', ...clean });
}
