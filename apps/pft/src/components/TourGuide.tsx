'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowRight, X } from 'lucide-react';

// Bump the version suffix if the tour changes materially — existing users
// will then see the refreshed tour once.
// Keys are scoped by user id so a browser that ran the tour for User A
// still shows the tour when User B signs in on the same browser.
const stepKey = (uid: string) => `pft_tour_step_v1_${uid}`;
const doneKey = (uid: string) => `pft_tour_done_v1_${uid}`;

interface Step {
  // The pathname where this step's target element lives. If the user isn't
  // there yet, the tour navigates them automatically.
  page: string;
  // How to find the anchored element. `selector` is preferred; `findByText`
  // is a fallback for buttons that don't have stable attributes.
  selector?: string;
  findByText?: string;
  title: string;
  body: string;
}

// Each step anchors to an ELEMENT on its target page (not sidebar links —
// those are behind a hamburger on mobile). Advancing via "Next" auto-
// navigates to the next step's page.
const STEPS: Step[] = [
  {
    page: '/dashboard',
    findByText: 'Current Balance',
    title: 'Your money at a glance',
    body: 'The dashboard shows your live balance, income, expenses, and savings — always the first place to check.',
  },
  {
    page: '/dashboard/quick',
    selector: 'button[aria-label*="voice"], button[aria-label*="Voice"]',
    title: 'Log with your voice',
    body: 'Tap this mic and say something like "Paid 500 for groceries from HDFC". Personal FT parses it and files it in the right category.',
  },
  {
    page: '/dashboard/expenses',
    findByText: 'Add Expense',
    title: 'Prefer typing?',
    body: 'Every expense also lives here. Tap Add Expense for a full form, or use CSV import for bulk uploads.',
  },
  {
    page: '/dashboard/budgets',
    selector: 'input[inputmode="decimal"]',
    title: 'Set a monthly budget',
    body: 'Type an amount for any category — it auto-saves as you type. No Save button, no extra clicks.',
  },
  {
    page: '/dashboard/reports',
    findByText: 'Download Report',
    title: "You're all set",
    body: 'Weekly, open Reports and download the PDF. You get a Financial Health score and a 90-day action plan tailored to your numbers. Replay this tour any time with ?tour=start.',
  },
];

// Find the anchored element for a step. Returns null until the element
// exists in the DOM (page navigations, data loading, etc. can delay it).
const findTarget = (step: Step): HTMLElement | null => {
  if (step.selector) {
    const el = document.querySelector<HTMLElement>(step.selector);
    if (el) return el;
  }
  if (step.findByText) {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, a'));
    const el = nodes.find((n) => (n.textContent || '').trim().includes(step.findByText!));
    if (el) return el;
  }
  return null;
};

// Small rect helper — outlines the target and positions the tooltip.
interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function TourGuide() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ---- Bootstrap: decide whether to run the tour ----
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // Need the current user first — all flags are keyed by their id so a
      // browser that ran the tour under account A still shows it for B.
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setUserId(user.id);

      const forced =
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('tour') === 'start';

      if (forced) {
        localStorage.removeItem(doneKey(user.id));
        localStorage.setItem(stepKey(user.id), '0');
        setStepIdx(0);
        setActive(true);
        return;
      }
      if (localStorage.getItem(doneKey(user.id)) === 'yes') return;

      // Only auto-fire for genuinely new accounts — anyone with a bank has
      // used the app before. Cheap `head:true` count avoids fetching rows.
      const { count } = await supabase
        .from('banks')
        .select('id', { count: 'exact', head: true });
      if (cancelled) return;
      if ((count ?? 0) > 0) {
        localStorage.setItem(doneKey(user.id), 'yes');
        return;
      }
      const stored = parseInt(localStorage.getItem(stepKey(user.id)) || '0', 10);
      setStepIdx(Number.isFinite(stored) && stored >= 0 && stored < STEPS.length ? stored : 0);
      setActive(true);
    };
    boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-navigate the user to the current step's page ----
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    if (!step) return;
    if (pathname !== step.page) {
      router.push(step.page);
    }
  }, [active, stepIdx, pathname, router]);

  // ---- Locate the anchored element (polls briefly while the page renders) ----
  useLayoutEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    if (!step || pathname !== step.page) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const el = findTarget(step);
      if (el) {
        // Scroll target into view (accounting for the mobile top-bar height).
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const r = el.getBoundingClientRect();
        setRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
        return;
      }
      // Element not yet mounted — try again shortly. Cap after ~4s.
      if (tries++ < 40) {
        raf = window.setTimeout(measure, 100) as unknown as number;
      } else {
        setRect(null);
      }
    };
    measure();

    // Refresh on scroll / resize so the outline follows the target.
    const refresh = () => {
      const el = findTarget(step);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);

    return () => {
      cancelled = true;
      if (raf) window.clearTimeout(raf);
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [active, stepIdx, pathname]);

  const finish = () => {
    if (userId) {
      localStorage.setItem(doneKey(userId), 'yes');
      localStorage.removeItem(stepKey(userId));
    }
    setActive(false);
    setRect(null);
  };

  const next = () => {
    if (stepIdx >= STEPS.length - 1) {
      finish();
      return;
    }
    const nxt = stepIdx + 1;
    if (userId) localStorage.setItem(stepKey(userId), String(nxt));
    setStepIdx(nxt);
    setRect(null);
  };

  if (!active) return null;
  const step = STEPS[stepIdx];
  if (!step) return null;

  // Where to put the tooltip: below the target by default; above if it
  // would run past the viewport bottom. Horizontally clamped to viewport
  // with a 12px gutter.
  const gap = 12;
  const tooltipWidth = Math.min(320, typeof window !== 'undefined' ? window.innerWidth - 24 : 320);
  const tooltipHeight = 220; // approx — for placement math
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;

  let tipTop = 0;
  let tipLeft = 0;
  let placement: 'above' | 'below' | 'center' = 'center';

  if (rect) {
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceBelow >= tooltipHeight + gap) {
      placement = 'below';
      tipTop = rect.top + rect.height + gap;
    } else if (rect.top >= tooltipHeight + gap) {
      placement = 'above';
      tipTop = rect.top - tooltipHeight - gap;
    } else {
      // Not enough room either way — center vertically as a fallback.
      placement = 'center';
      tipTop = Math.max(12, (vh - tooltipHeight) / 2);
    }
    tipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    tipLeft = Math.max(12, Math.min(vw - tooltipWidth - 12, tipLeft));
  } else {
    // No target yet — center the tooltip while we wait / navigate.
    tipTop = Math.max(12, (vh - tooltipHeight) / 2);
    tipLeft = Math.max(12, (vw - tooltipWidth) / 2);
  }

  // Rectangular spotlight around the target, with an 8px padding.
  const spotPad = 8;
  const spot = rect
    ? {
        x: rect.left - spotPad,
        y: rect.top - spotPad,
        w: rect.width + spotPad * 2,
        h: rect.height + spotPad * 2,
      }
    : null;

  const isLast = stepIdx === STEPS.length - 1;

  return (
    <>
      {/* Backdrop with a spotlight cutout on the target. pointer-events on
          the mask so users can still tap the highlighted element itself. */}
      <svg
        className="fixed inset-0 z-[70] pointer-events-none"
        width="100vw"
        height="100vh"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="pft-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spot && (
              <rect
                x={spot.x}
                y={spot.y}
                width={spot.w}
                height={spot.h}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#pft-tour-mask)"
        />
        {/* Orange ring around the spotlight for extra emphasis */}
        {spot && (
          <rect
            x={spot.x}
            y={spot.y}
            width={spot.w}
            height={spot.h}
            rx={12}
            ry={12}
            fill="none"
            stroke="rgba(243,115,53,0.9)"
            strokeWidth="2"
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        className="fixed z-[71] bg-18-surface border border-18-orange/60 rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.9)] p-5"
        style={{
          top: `${tipTop}px`,
          left: `${tipLeft}px`,
          width: `${tooltipWidth}px`,
        }}
        role="dialog"
        aria-labelledby="tour-title"
      >
        {/* Header: progress + skip */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx
                    ? 'w-5 bg-18-orange'
                    : i < stepIdx
                    ? 'w-1.5 bg-18-orange/50'
                    : 'w-1.5 bg-18-border'
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="text-white/50 hover:text-white text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1"
            title="Skip the tour"
          >
            Skip
            <X size={12} />
          </button>
        </div>

        <h3 id="tour-title" className="text-base font-black text-white mb-1.5">
          {step.title}
        </h3>
        <p className="text-sm text-white/70 leading-relaxed mb-5">{step.body}</p>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
            Step {stepIdx + 1} of {STEPS.length}
          </span>
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 bg-18-orange text-white text-sm font-bold px-4 py-2 rounded-full hover:brightness-110 transition-all shadow-[0_8px_20px_-6px_rgba(243,115,53,0.6)]"
          >
            {isLast ? 'Got it' : 'Next'}
            {!isLast && <ArrowRight size={14} />}
          </button>
        </div>
        {/* Placement hint arrow for debug — kept off */}
        <span className="sr-only">{placement}</span>
      </div>
    </>
  );
}
