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
  'current_month',
  'last_month',
  'custom',
];

export default function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  // When the user explicitly clicks the "Custom" chip while the current value
  // still matches a preset, we need to reveal the from/to inputs without
  // changing what they're looking at. `preset` derives from `value`, so we
  // can't rely on it alone — track the "user asked for custom" intent here.
  // Cleared whenever a non-custom preset is picked.
  const [customRequested, setCustomRequested] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Derive the currently-active preset from `value` on every render (rather
  // than tracking it in local state) so external mutations — e.g. the
  // prev/next chevrons in PeriodPicker calling shiftRange — always show
  // the correct chip highlighted. Any range that doesn't match a known
  // preset shape falls through to 'custom'.
  const preset: PresetKey = useMemo(() => {
    // Match each preset by comparing to what rangeFor(preset) would return
    // for today. Cheaper and easier to read than reproducing shape logic.
    for (const p of PRESET_ORDER) {
      if (p === 'custom') continue;
      const r = rangeFor(p);
      if (r.from === value.from && r.to === value.to) return p;
    }
    return 'custom';
  }, [value.from, value.to]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setCustomRequested(false);
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Derive the button label from `value` (not from the local `preset` state)
  // so external range changes — e.g. Entries' prev/next period chevrons —
  // reflect immediately. Also recognises common shapes to keep the label
  // short: a full calendar month renders as "Jul 2026", a single day as
  // its dd-mm-yyyy, an Indian FY as "FY 26-27".
  const label = useMemo(() => {
    const parse = (s: string) => {
      const [y, m, d] = s.slice(0, 10).split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };
    const from = parse(value.from);
    const to = parse(value.to);

    if (value.from === value.to) return formatDate(value.from);

    const lastOfFromMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const isFullMonth =
      from.getDate() === 1 &&
      to.getFullYear() === from.getFullYear() &&
      to.getMonth() === from.getMonth() &&
      to.getDate() === lastOfFromMonth.getDate();
    if (isFullMonth) {
      return from.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    }

    return `${formatDate(value.from)} → ${formatDate(value.to)}`;
  }, [value]);

  const selectPreset = (p: PresetKey) => {
    if (p === 'custom') {
      // Reveal the from/to inputs without changing the current range.
      setCustomRequested(true);
      return;
    }
    // Non-custom preset — apply and close. Clear the "requested" flag so
    // next open respects the actual range shape.
    setCustomRequested(false);
    onChange(rangeFor(p));
    setOpen(false);
  };

  const showCustomInputs = preset === 'custom' || customRequested;

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-18-sm border-2 border-18-border bg-18-surface text-sm text-white hover:border-18-orange transition-colors"
      >
        <Calendar size={16} />
        <span className="font-semibold">{label}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          {/* Mobile-only dark backdrop. On desktop the panel is a small
              popover anchored to the button, so no scrim is needed —
              click-outside handles dismissal there. */}
          <div
            className="sm:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => {
              // Backdrop dismiss without applying — same reset as Apply.
              setCustomRequested(false);
              setOpen(false);
            }}
          />
          <div
            className="
              fixed inset-x-4 bottom-24 z-50 max-h-[70vh] overflow-y-auto
              sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-2
              sm:max-h-none sm:overflow-visible sm:w-[320px]
              card p-4 shadow-2xl
            "
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <p className="text-xs uppercase font-bold text-18-dark-text mb-2">Presets</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {PRESET_ORDER.map((p) => {
                // Highlight the chip that matches the current value; also
                // highlight 'Custom' when the user has clicked into the
                // custom inputs (before they've picked dates that break out
                // of the current preset shape).
                const active = p === 'custom' ? showCustomInputs : preset === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectPreset(p)}
                    className={`text-left text-sm px-3 py-2 rounded-lg ${
                      active
                        ? 'bg-18-orange text-white font-semibold'
                        : 'text-white bg-white/[0.03] border border-white/5 hover:bg-18-surface-2'
                    }`}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                );
              })}
            </div>

            {showCustomInputs && (
              <div className="space-y-2">
                <div>
                  <label className="form-label">From</label>
                  <input
                    type="date"
                    className="form-input"
                    value={value.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      // If the user picked a From later than To, swap them so
                      // downstream `.gte / .lte` filters don't quietly return
                      // an empty set.
                      if (from && value.to && from > value.to) {
                        onChange({ from: value.to, to: from });
                      } else {
                        onChange({ ...value, from });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input
                    type="date"
                    className="form-input"
                    value={value.to}
                    onChange={(e) => {
                      const to = e.target.value;
                      if (to && value.from && to < value.from) {
                        onChange({ from: to, to: value.from });
                      } else {
                        onChange({ ...value, to });
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Applying commits whatever from/to the user picked.
                    // Clear the requested flag so the next open reflects
                    // the actual value's preset shape (which may now be
                    // 'custom' anyway if the picked pair doesn't match).
                    setCustomRequested(false);
                    setOpen(false);
                  }}
                  className="btn btn-primary w-full"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
