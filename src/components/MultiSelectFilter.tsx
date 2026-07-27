'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  value: number;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}

// Compact checkbox popover filter — used above the Expenses / Income tables
// for Category and Bank multi-select. Closes on click-outside or Esc.
export default function MultiSelectFilter({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (v: number) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  };

  const lower = label.toLowerCase();
  // Naive English pluralization — good enough for the labels used here.
  const plural = lower.endsWith('y') ? `${lower.slice(0, -1)}ies` : `${lower}s`;
  const summary =
    selected.size === 0
      ? `All ${plural}`
      : selected.size === 1
      ? options.find((o) => o.value === Array.from(selected)[0])?.label || `1 ${lower}`
      : `${selected.size} ${plural}`;

  const hasActive = selected.size > 0;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 text-sm rounded-full px-4 py-2 border transition-colors ${
          hasActive
            ? 'bg-18-orange/15 border-18-orange/50 text-white'
            : 'bg-18-surface border-18-border text-white/80 hover:border-18-orange/40'
        }`}
      >
        <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">
          {label}
        </span>
        <span className="font-semibold">{summary}</span>
        {hasActive && (
          <span
            role="button"
            title="Clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange(new Set());
            }}
            className="rounded-full hover:bg-white/10 p-0.5"
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 left-0 min-w-[240px] max-w-[calc(100vw-2rem)] max-h-72 overflow-y-auto bg-18-surface border border-18-border rounded-xl shadow-2xl p-2">
          {options.length === 0 ? (
            <p className="text-xs text-white/50 p-3">No options.</p>
          ) : (
            options.map((o) => {
              const checked = selected.has(o.value);
              return (
                <label
                  key={o.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm ${
                    checked ? 'bg-18-orange/10 text-white' : 'text-white/80 hover:bg-white/5'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.value)}
                    className="h-4 w-4 accent-18-orange"
                  />
                  <span className="truncate">{o.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
