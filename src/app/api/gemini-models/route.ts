// GET /api/gemini-models
// Lists every model your GEMINI_API_KEY can access, filtered to the ones
// that support generateContent. Handy for debugging "model not found" 404s
// and picking a name for the GEMINI_MODEL env var override.
//
// Auth-gated to a signed-in user so anonymous callers can't fingerprint
// your key's tier.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface GeminiModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  version?: string;
}

export async function GET(req: NextRequest) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 501 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
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

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}&pageSize=200`
    );
  } catch (err: any) {
    // Return a JSON body on network failure — matches the shape the caller
    // is already parsing, avoids leaking an unhandled 500 with an HTML page.
    return NextResponse.json(
      { error: 'Gemini network error', detail: err?.message },
      { status: 502 }
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Gemini ${res.status}`, detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }
  const data = await res.json();
  const all = (data.models || []) as GeminiModel[];
  // Filter to models we can actually call for /api/parse-expense.
  const usable = all
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({
      // Strip the "models/" prefix — that's what goes in GEMINI_MODEL.
      id: m.name.replace(/^models\//, ''),
      displayName: m.displayName,
      version: m.version,
      inputLimit: m.inputTokenLimit,
      outputLimit: m.outputTokenLimit,
    }));

  return NextResponse.json({
    ok: true,
    currentDefault: process.env.GEMINI_MODEL || 'gemini-flash-latest',
    usableCount: usable.length,
    // Return a compact list, sorted so newest-versioned + flash-first is on top.
    models: usable.sort((a, b) => {
      const aFlash = a.id.includes('flash') ? 0 : 1;
      const bFlash = b.id.includes('flash') ? 0 : 1;
      if (aFlash !== bFlash) return aFlash - bFlash;
      return b.id.localeCompare(a.id);
    }),
  });
}
