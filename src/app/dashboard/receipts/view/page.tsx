'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Download, Loader2, FileX, ExternalLink, FileText } from 'lucide-react';

// Full-page receipt viewer. Fetches the file via the auth-gated
// /api/receipts/serve endpoint (which corrects the stored MIME on the fly),
// renders it inline in an <iframe> for PDFs / <img> for images, and offers
// a Download button.
export default function ReceiptViewerPage() {
  const params = useSearchParams();
  const router = useRouter();
  const path = params.get('path') || '';

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [contentType, setContentType] = useState<string>('');
  const [size, setSize] = useState<number>(0);

  const filename = useMemo(() => {
    if (!path) return 'receipt';
    return path.split('/').pop() || 'receipt';
  }, [path]);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      if (!path) {
        setState('error');
        setError('No receipt path in the URL.');
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('You are not signed in.');

        const res = await fetch(`/api/receipts/serve?path=${encodeURIComponent(path)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        const ct = res.headers.get('content-type') || 'application/octet-stream';
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
        setContentType(ct);
        setSize(blob.size);
        setState('ready');
      } catch (e: any) {
        if (cancelled) return;
        setState('error');
        setError(e?.message || 'Could not load the receipt.');
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);

  const download = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('You are not signed in.');
      const res = await fetch(
        `/api/receipts/serve?path=${encodeURIComponent(path)}&download=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      // Prefer the Content-Disposition-provided filename (has the sniffed ext).
      const cd = res.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      const suggested = m ? m[1] : filename;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggested;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Download failed: ${e?.message || e}`);
    }
  };

  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  const sizeKb = size ? Math.max(1, Math.round(size / 1024)) : 0;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-18-dark-text hover:text-18-orange"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-3">
          {sizeKb > 0 && (
            <span className="text-xs text-18-dark-text">
              {contentType} · {sizeKb.toLocaleString()} KB
            </span>
          )}
          {state === 'ready' && blobUrl && (
            <button
              type="button"
              onClick={() => window.open(blobUrl, '_blank', 'noopener')}
              className="btn btn-outline inline-flex items-center gap-2"
              title="Open the file in a new browser tab"
            >
              <ExternalLink size={16} /> Open in new tab
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={state !== 'ready'}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Download size={16} /> Download
          </button>
        </div>
      </div>

      <div className="flex-1 card !p-0 overflow-hidden bg-gray-100" style={{ minHeight: 500 }}>
        {state === 'loading' && (
          <div className="flex items-center justify-center h-full p-12 text-18-dark-text">
            <Loader2 className="animate-spin" size={20} />
            <span className="ml-2">Loading receipt…</span>
          </div>
        )}
        {state === 'error' && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-red-600">
            <FileX size={40} className="mb-2" />
            <p className="font-semibold">Could not load this receipt</p>
            <p className="text-sm text-18-dark-text mt-1">{error}</p>
          </div>
        )}
        {state === 'ready' && blobUrl && (
          <>
            {isImage ? (
              <div className="flex items-center justify-center h-full p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={blobUrl} alt="Receipt" className="max-w-full max-h-full object-contain" />
              </div>
            ) : isPdf ? (
              // Blob-URL PDFs render unreliably inside <iframe>/<embed> — some
              // Chrome builds show only a black background. Open the PDF in a
              // new tab where the browser's normal PDF viewer handles it.
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <FileText size={64} className="text-18-orange mb-4" />
                <p className="text-lg font-semibold text-18-charcoal mb-1">
                  {filename}
                </p>
                <p className="text-sm text-18-dark-text mb-6">
                  {contentType} · {sizeKb.toLocaleString()} KB
                </p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    type="button"
                    onClick={() => window.open(blobUrl, '_blank', 'noopener')}
                    className="btn btn-primary inline-flex items-center gap-2"
                  >
                    <ExternalLink size={16} /> View PDF
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="btn btn-outline inline-flex items-center gap-2"
                  >
                    <Download size={16} /> Download
                  </button>
                </div>
                <p className="text-xs text-18-dark-text mt-6 max-w-md">
                  PDF opens in a new browser tab using your browser&apos;s built-in
                  PDF viewer — that&apos;s the most reliable way to view it across
                  all browsers.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-12">
                <p className="text-18-charcoal font-semibold mb-2">Preview not supported</p>
                <p className="text-sm text-18-dark-text mb-4">
                  Detected type: <code>{contentType}</code>
                </p>
                <button type="button" onClick={download} className="btn btn-primary">
                  <Download size={16} /> Download to view
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
