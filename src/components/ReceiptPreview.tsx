'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { FileText, Image as ImageIcon, FileArchive, Loader2 } from 'lucide-react';

// Small preview box for a receipt attached to an expense / journal entry.
// - For image types, shows an actual thumbnail (fetched via /api/receipts/serve
//   so the browser gets the corrected MIME even for old .bin uploads).
// - For PDFs and other types, shows a labelled icon card.
// Clicking navigates to the full-page viewer (/dashboard/receipts/view?path=…)
// which handles preview + download.
export default function ReceiptPreview({ path }: { path: string }) {
  const [contentType, setContentType] = useState<string>('');
  const [thumbUrl, setThumbUrl] = useState<string>('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('not signed in');
        // HEAD to get the sniffed content type without downloading.
        const head = await fetch(`/api/receipts/serve?path=${encodeURIComponent(path)}`, {
          method: 'HEAD',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!head.ok) throw new Error(`HTTP ${head.status}`);
        const ct = head.headers.get('content-type') || 'application/octet-stream';
        if (cancelled) return;
        setContentType(ct);

        // For images, fetch bytes so we can render a real thumbnail.
        if (ct.startsWith('image/')) {
          const res = await fetch(`/api/receipts/serve?path=${encodeURIComponent(path)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          revoke = url;
          setThumbUrl(url);
        }
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);

  const filename = path.split('/').pop() || 'receipt';
  const href = `/dashboard/receipts/view?path=${encodeURIComponent(path)}`;

  const kindLabel = (() => {
    if (!contentType) return 'File';
    if (contentType === 'application/pdf') return 'PDF';
    if (contentType.startsWith('image/')) return 'Image';
    if (contentType.includes('word')) return 'Word';
    if (contentType.includes('sheet') || contentType.includes('excel')) return 'Spreadsheet';
    if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'Slides';
    return contentType.split('/').pop()?.toUpperCase() || 'File';
  })();

  const KindIcon = contentType.startsWith('image/')
    ? ImageIcon
    : contentType === 'application/pdf'
    ? FileText
    : FileArchive;

  return (
    <Link
      href={href}
      className="block w-full max-w-xs rounded border border-18-border hover:border-18-orange overflow-hidden bg-white transition-colors"
      title="Click to view full-size"
    >
      <div className="aspect-[4/3] bg-gray-50 flex items-center justify-center overflow-hidden">
        {state === 'loading' ? (
          <Loader2 size={22} className="animate-spin text-18-dark-text" />
        ) : state === 'error' ? (
          <div className="text-xs text-red-600 p-3 text-center">
            Preview unavailable — click to open
          </div>
        ) : thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="Receipt" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-18-dark-text">
            <KindIcon size={36} />
            <span className="text-xs font-semibold uppercase tracking-wide">{kindLabel}</span>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-18-border">
        <p className="text-xs text-18-charcoal font-semibold truncate">{filename}</p>
        <p className="text-[10px] text-18-dark-text uppercase">Click to view · download available</p>
      </div>
    </Link>
  );
}
