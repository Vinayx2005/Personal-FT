import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sniffMime } from '@/lib/mimeSniff';

export const runtime = 'nodejs';

// Serves a receipt file from Supabase Storage with the CORRECT content type
// (sniffed from bytes, not the potentially-wrong one stored during upload).
// Query params:
//   path      required — storage path in the "receipts" bucket
//   download  optional — "1" = force download, else preview inline
// Auth: Bearer JWT (any logged-in team member).
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'not signed in' }, { status: 401 });

  const url = new URL(req.url);
  const path = url.searchParams.get('path');
  const isDownload = url.searchParams.get('download') === '1';
  if (!path) return NextResponse.json({ ok: false, error: 'path is required' }, { status: 400 });
  // Basic guard against traversal / bucket escape.
  if (path.startsWith('/') || path.includes('..')) {
    return NextResponse.json({ ok: false, error: 'invalid path' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const userRes = await supabase.auth.getUser(token);
  if (userRes.error || !userRes.data?.user) {
    return NextResponse.json({ ok: false, error: 'invalid session' }, { status: 401 });
  }

  const { data: blob, error: dlErr } = await supabase.storage.from('receipts').download(path);
  if (dlErr || !blob) {
    return NextResponse.json({ ok: false, error: dlErr?.message || 'not found' }, { status: 404 });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const sniffed = sniffMime(bytes);

  // Build a friendly download filename: strip the internal storage prefix, use
  // the sniffed extension. Existing rows have paths like
  //   bulk_1783694478515_pmt9vl.bin
  // Presenting them as "receipt-<id>.pdf" is much nicer.
  const basename = path.split('/').pop() || 'receipt';
  const nameNoExt = basename.replace(/\.[^.]+$/, '');
  const friendly = `${nameNoExt}.${sniffed.extension}`;
  const disposition = isDownload
    ? `attachment; filename="${friendly}"`
    : `inline; filename="${friendly}"`;

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': sniffed.contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': disposition,
      'Cache-Control': 'private, max-age=300',
    },
  });
}

// Small metadata endpoint useful for the client to decide <img> vs <iframe>.
export async function HEAD(req: NextRequest) {
  // Reuse GET but without the body.
  const res = await GET(req);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
