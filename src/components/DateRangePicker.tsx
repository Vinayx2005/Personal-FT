'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  DateRange,
  PRESET_LABELS,
  PresetKey,
  rangeFor,
} from '@/lib/dateRanges';
import { formatDate } from '@/lib/utils';

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
}

const PRESET_ORDER: PresetKey[] = [
  'today',
  'yesterday',
  'last_7',
  'last_week',
  'last_14',
  'last_30',
  'last_month',
  'current_month',
  'current_fy',
  'last_fy',
  'custom',
];

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetKey>('current_month');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const label = useMemo(() => {
    if (preset !== 'custom') return PRESET_LABELS[preset];
    return `${formatDate(value.from)} → ${formatDate(value.to)}`;
  }, [preset, value]);

  const selectPreset = (p: PresetKey) => {
    setPreset(p);
    if (p !== 'custom') {
      onChange(rangeFor(p));
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-18-sm border-2 border-18-border bg-white text-sm text-18-charcoal hover:border-18-orange transition-colors"
      >
        <Calendar size={16} />
        <span className="font-semibold">{label}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 card p-4 shadow-lg left-0 right-auto sm:left-auto sm:right-0 w-[min(320px,calc(100vw-1.5rem))] sm:w-[320px]">
          <p className="text-xs uppercase font-bold text-18-dark-text mb-2">Presets</p>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {PRESET_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => selectPreset(p)}
                className={`text-left text-sm px-2 py-1 rounded ${
                  preset === p
                    ? 'bg-18-orange text-white font-semibold'
                    : 'text-18-charcoal hover:bg-18-bg'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="space-y-2">
              <div>
                <label className="form-label">From</label>
                <input
                  type="date"
                  className="form-input"
                  value={value.from}
                  onChange={(e) => onChange({ ...value, from: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">To</label>
                <input
                  type="date"
                  className="form-input"
                  value={value.to}
                  onChange={(e) => onChange({ ...value, to: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn btn-primary w-full"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
