import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Meta Cloud API — WhatsApp webhook.
// GET: verification challenge (only called once by Meta when webhook URL is added).
// POST: incoming messages. Each message body is a 4-line format:
//   line 1: amount (positive number)
//   line 2: description (free text)
//   line 3: category name (must match a categories.name row, case-insensitive)
//   line 4: bank keyword (substring-matches banks.bank_name, case-insensitive)

export const runtime = 'nodejs'; // needs `crypto` for HMAC verification

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const GRAPH_VERSION = 'v22.0';

// Service role client — RLS on transactions requires an authenticated user;
// the webhook has no auth context, so we bypass RLS. Keep this key server-only.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// GET: Meta calls this once when you save the webhook URL, echoing
// hub.challenge back if hub.verify_token matches ours.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('forbidden', { status: 403 });
}

// ---------------------------------------------------------------------------
// POST: incoming message events from Meta.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Verify Meta's HMAC-SHA256 signature over the raw body using our App Secret.
  if (!verifySignature(req.headers.get('x-hub-signature-256'), raw)) {
    return new NextResponse('invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  // Meta always wants a 200 quickly — process, then respond.
  try {
    const change = payload?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || message.type !== 'text') {
      return NextResponse.json({ ok: true, skipped: 'not a text message' });
    }
    const fromPhone: string = message.from; // e.164 without leading '+'
    const text: string = message.text?.body || '';
    const result = await processExpenseMessage(text);
    await sendWhatsAppReply(fromPhone, result.reply);
    return NextResponse.json({ ok: true, result: result.summary });
  } catch (err: any) {
    console.error('whatsapp webhook error:', err);
    // Always 200 to Meta so it doesn't retry — logged for us to inspect.
    return NextResponse.json({ ok: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Message parser + DB insert.
// ---------------------------------------------------------------------------
async function processExpenseMessage(text: string): Promise<{
  summary: string;
  reply: string;
}> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 4) {
    return {
      summary: 'malformed',
      reply:
        '❌ Expected 4 lines:\n' +
        'Line 1: amount\n' +
        'Line 2: description\n' +
        'Line 3: category\n' +
        'Line 4: bank\n\n' +
        'Example:\n500\nGroceries at DMart\nFood & Groceries\nHDFC',
    };
  }

  const [amountStr, description, categoryName, bankKeyword] = lines;

  const amount = parseFloat(amountStr.replace(/[,₹\s]/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return {
      summary: 'invalid amount',
      reply: `❌ Line 1 must be a positive number. Got: "${amountStr}"`,
    };
  }

  // Look up expense categories — pull all at once so we can list them on error.
  const { data: cats } = await supabase
    .from('categories')
    .select('id, name')
    .eq('type', 'expense');
  const category = (cats || []).find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  if (!category) {
    const options = (cats || []).map((c) => c.name).join(', ');
    return {
      summary: 'unknown category',
      reply: `❌ Unknown expense category: "${categoryName}"\n\nOptions: ${options || '(none)'}`,
    };
  }

  // Look up bank — substring/keyword match on bank_name, case-insensitive.
  const { data: banks } = await supabase
    .from('banks')
    .select('id, bank_name')
    .eq('is_active', true);
  const kw = bankKeyword.toLowerCase();
  const matches = (banks || []).filter((b) =>
    b.bank_name.toLowerCase().includes(kw)
  );
  if (matches.length === 0) {
    const options = (banks || []).map((b) => b.bank_name).join(', ');
    return {
      summary: 'unknown bank',
      reply: `❌ No bank matches "${bankKeyword}"\n\nOptions: ${options || '(none)'}`,
    };
  }
  if (matches.length > 1) {
    const options = matches.map((b) => b.bank_name).join(', ');
    return {
      summary: 'ambiguous bank',
      reply: `❌ "${bankKeyword}" matches ${matches.length} banks: ${options}\n\nBe more specific.`,
    };
  }
  const bank = matches[0];

  // Insert as a posted expense dated today.
  const today = new Date().toISOString().slice(0, 10);
  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert({
      transaction_type: 'expense',
      bank_id: bank.id,
      category_id: category.id,
      description,
      amount,
      transaction_date: today,
      payee_name: '',
      notes: 'via WhatsApp',
      status: 'posted',
    })
    .select('id')
    .single();

  if (error) {
    return {
      summary: 'db insert failed',
      reply: `❌ Save failed: ${error.message}`,
    };
  }

  const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);

  return {
    summary: `saved id=${inserted.id}`,
    reply:
      `✅ Expense logged\n` +
      `Amount: ${inr}\n` +
      `Description: ${description}\n` +
      `Category: ${category.name}\n` +
      `Bank: ${bank.bank_name}\n` +
      `Date: ${today}`,
  };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature check over the raw request body.
// Meta signs with your App Secret and sends the digest as `x-hub-signature-256: sha256=<hex>`.
// ---------------------------------------------------------------------------
function verifySignature(header: string | null, rawBody: string): boolean {
  if (!APP_SECRET || !header) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  // Timing-safe compare
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Send a text reply back via Cloud API.
// ---------------------------------------------------------------------------
async function sendWhatsAppReply(toPhone: string, body: string): Promise<void> {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    console.warn('WhatsApp reply skipped — access token / phone number id missing');
    return;
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('WhatsApp send failed:', res.status, errText);
  }
}
