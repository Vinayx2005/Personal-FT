'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, Story } from '@/lib/supabase';
import { renderMarkdown } from '@/lib/md';
import { ArrowLeft, Trash2, Save, Send, EyeOff } from 'lucide-react';

interface Props { id: string }

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);

export default function StoryEditor({ id }: Props) {
  const router = useRouter();
  const isNew = id === 'new';
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [row, setRow] = useState<Partial<Story>>({
    slug: '', title: '', excerpt: '', body_md: '',
    cover_url: '', og_title: '', og_description: '', og_image_url: '',
    published_at: null,
    read_time: '', genre: 'Love', date_display: '',
  });

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const { data, error } = await supabase.schema('dilse').from('stories').select('*').eq('id', Number(id)).maybeSingle();
      if (error) { setErr(error.message); return; }
      if (data) setRow(data as Story);
      setLoading(false);
    })();
  }, [id, isNew]);

  const previewHtml = useMemo(() => renderMarkdown(row.body_md || ''), [row.body_md]);

  const save = async (publish?: 'now' | 'draft') => {
    if (!row.title?.trim()) { setErr('Title is required.'); return; }
    if (!row.slug?.trim())  { setErr('Slug is required.'); return; }
    setBusy(true); setErr(null);

    // Auto-compute read_time from word count if the field is left blank.
    // Author can override in the input. 200 wpm — average reading pace.
    const words = (row.body_md || '').trim().split(/\s+/).filter(Boolean).length;
    const autoReadTime = words > 0 ? `${Math.max(1, Math.ceil(words / 200))} min read` : null;

    const payload: Partial<Story> = {
      slug: row.slug!.trim(),
      title: row.title!.trim(),
      excerpt: row.excerpt || null,
      body_md: row.body_md || '',
      cover_url: row.cover_url || null,
      og_title: row.og_title || null,
      og_description: row.og_description || null,
      og_image_url: row.og_image_url || null,
      read_time: (row.read_time?.trim()) || autoReadTime,
      genre: row.genre?.trim() || null,
      date_display: row.date_display?.trim() || null,
    };
    if (publish === 'now')   payload.published_at = new Date().toISOString();
    if (publish === 'draft') payload.published_at = null;

    try {
      if (isNew) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .schema('dilse').from('stories')
          .insert({ ...payload, author_email: user?.email })
          .select()
          .single();
        if (error) throw error;
        router.replace(`/stories/${(data as Story).id}`);
      } else {
        const { error } = await supabase.schema('dilse').from('stories').update(payload).eq('id', Number(id));
        if (error) throw error;
        setRow((r) => ({ ...r, ...payload }));
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    if (!confirm('Delete this story permanently?')) return;
    const { error } = await supabase.schema('dilse').from('stories').delete().eq('id', Number(id));
    if (error) { alert(error.message); return; }
    router.push('/stories');
  };

  if (loading) return <p className="text-white/50 text-sm">Loading…</p>;
  const published = !!row.published_at;

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/stories')} className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
          <ArrowLeft size={12} /> Back to stories
        </button>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button onClick={del} className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10">
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button onClick={() => save()} disabled={busy} className="inline-flex items-center gap-1 text-xs font-semibold text-white/80 bg-white/5 border border-white/15 rounded-full px-3 py-1.5 hover:bg-white/10 disabled:opacity-50">
            <Save size={12} /> Save
          </button>
          {published ? (
            <button onClick={() => save('draft')} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-white/80 bg-white/5 border border-white/15 rounded-full px-3 py-1.5 hover:bg-white/10 disabled:opacity-50">
              <EyeOff size={12} /> Unpublish
            </button>
          ) : (
            <button onClick={() => save('now')} disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold text-white bg-18-orange border border-18-orange rounded-full px-3 py-1.5 hover:brightness-110 disabled:opacity-50">
              <Send size={12} /> Publish
            </button>
          )}
        </div>
      </div>

      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Title *</span>
            <input
              type="text"
              className="cms-input"
              value={row.title || ''}
              onChange={(e) => setRow((r) => ({ ...r, title: e.target.value, slug: r.slug ? r.slug : slugify(e.target.value) }))}
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">
              Slug * (URL: /{row.slug || '…'})
            </span>
            <input
              type="text"
              className="cms-input"
              value={row.slug || ''}
              onChange={(e) => setRow({ ...row, slug: slugify(e.target.value) })}
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Excerpt</span>
            <textarea rows={2} className="cms-input" value={row.excerpt || ''} onChange={(e) => setRow({ ...row, excerpt: e.target.value })} />
          </label>

          {/* Dilse-specific metadata — shown as chips on story cards + header */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Display date</span>
              <input
                type="text"
                placeholder="6/11/2026"
                className="cms-input"
                value={row.date_display || ''}
                onChange={(e) => setRow({ ...row, date_display: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Read time</span>
              <input
                type="text"
                placeholder="auto"
                className="cms-input"
                value={row.read_time || ''}
                onChange={(e) => setRow({ ...row, read_time: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Genre</span>
              <input
                type="text"
                placeholder="Love"
                className="cms-input"
                value={row.genre || ''}
                onChange={(e) => setRow({ ...row, genre: e.target.value })}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Cover image URL</span>
            <input type="text" placeholder="https://…" className="cms-input" value={row.cover_url || ''} onChange={(e) => setRow({ ...row, cover_url: e.target.value })} />
          </label>

          <details className="bg-18-surface border border-18-border rounded-lg px-3 py-2 text-sm">
            <summary className="cursor-pointer text-white/70 select-none">SEO / OG overrides</summary>
            <div className="space-y-2 mt-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">OG title</span>
                <input type="text" className="cms-input" value={row.og_title || ''} onChange={(e) => setRow({ ...row, og_title: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">OG description</span>
                <textarea rows={2} className="cms-input" value={row.og_description || ''} onChange={(e) => setRow({ ...row, og_description: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">OG image URL</span>
                <input type="text" placeholder="https://…" className="cms-input" value={row.og_image_url || ''} onChange={(e) => setRow({ ...row, og_image_url: e.target.value })} />
              </label>
            </div>
          </details>

          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-1 block">Body (Markdown)</span>
            <textarea rows={20} className="cms-input font-mono text-sm leading-relaxed" value={row.body_md || ''} onChange={(e) => setRow({ ...row, body_md: e.target.value })} />
          </label>

          <button onClick={() => setShowPreview((v) => !v)} className="text-xs text-18-orange hover:underline lg:hidden">
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>

        <div className={`${showPreview ? '' : 'hidden lg:block'} bg-18-surface border border-18-border rounded-2xl p-5 max-h-[85vh] overflow-y-auto sticky top-4`}>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-3">Live preview</p>
          {row.cover_url && <img src={row.cover_url} alt="" className="rounded-xl w-full mb-4" />}
          <h1 className="text-2xl font-black text-white mb-1">{row.title || <span className="text-white/30 italic">Untitled</span>}</h1>
          {row.excerpt && <p className="text-sm text-white/60 mb-4">{row.excerpt}</p>}
          <div className="prose-crafted" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    </div>
  );
}
