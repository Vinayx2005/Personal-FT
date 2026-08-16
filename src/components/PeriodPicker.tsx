'use client';

// DateRangePicker with prev/next chevrons on either side. The chevrons
// walk the range backwards/forwards by the same-shape period —
// day → yesterday, calendar month → last month, custom-N days → the N
// days before, Indian FY → last FY (see shiftRange in lib/dateRanges).
//
// Every dashboard page that exposes a period selector uses this so the
// affordance is identical everywhere: same chevrons, same sizing, same
// hit target, same keyboard behaviour.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import DateRangePicker from './DateRangePicker';
import { DateRange, shiftRange } from '@/lib/dateRanges';

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  className?: string;
}

export default function PeriodPicker({ value, onChange, className = '' }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(shiftRange(value, -1))}
        className="h-8 w-8 shrink-0 rounded-full bg-18-surface border border-18-border text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors"
        aria-label="Previous period"
      >
        <ChevronLeft size={16} />
      </button>
      <DateRangePicker value={value} onChange={onChange} />
      <button
        type="button"
        onClick={() => onChange(shiftRange(value, 1))}
        className="h-8 w-8 shrink-0 rounded-full bg-18-surface border border-18-border text-white/70 hover:text-white hover:border-white/30 flex items-center justify-center transition-colors"
        aria-label="Next period"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
