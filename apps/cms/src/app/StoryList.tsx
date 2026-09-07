'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, Story } from '@/lib/supabase';
import { Plus, BookOpen } from 'lucide-react';

export default function StoryList() {
  const [rows, setRows] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.schema('dilse').from('stories').select('*').order('created_at', { ascending: false });
      if (error) console.error(error);
      setRows((data || []) as Story[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Stories</h1>
          <p className="text-xs text-white/50 mt-0.5">Published to dilse.craftedbyteja.com</p>
        </div>
        <Link
          href="/stories/new"
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-18-orange rounded-full px-4 py-2 hover:brightness-110"
        >
          <Plus size={14} /> New story
        </Link>
      </div>

      {loading ? (
        <p className="text-white/50 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="bg-18-surface border border-18-border rounded-2xl p-8 text-center">
          <BookOpen size={20} className="text-white/40 mx-auto mb-2" />
          <p className="text-white/60 text-sm">No stories yet. Hit &ldquo;New story&rdquo; up top.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const published = !!s.published_at;
            return (
              <li key={s.id}>
                <Link
                  href={`/stories/${s.id}`}
                  className="block bg-18-surface border border-18-border rounded-xl p-3 hover:border-18-orange/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border ${
                        published
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-white/50 bg-white/5 border-white/10'
                      }`}
                    >
                      {published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white mt-1.5 truncate">
                    {s.title || <span className="text-white/40 italic">Untitled</span>}
                  </p>
                  <p className="text-[11px] text-white/50 mt-0.5">
                    /{s.slug || <span className="text-white/40 italic">no-slug</span>}
                    {' · '}
                    {s.published_at
                      ? new Date(s.published_at).toLocaleDateString('en-IN')
                      : `edited ${new Date(s.updated_at).toLocaleDateString('en-IN')}`}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
